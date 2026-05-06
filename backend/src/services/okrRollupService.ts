import { prisma } from "src/app";
import { Decimal } from "@prisma/client/runtime/library";
import {
  getConfidenceLevelMapping,
  resolveConfidenceLevelFromProgress,
} from "src/services/okrMeasurementService";

// =============================================================================
// OKR ROLLUP ENGINE — Dynamic Metric-Aware Scoring
// =============================================================================

function clampPercent(value: Decimal) {
  return Decimal.max(new Decimal(0), Decimal.min(value, new Decimal(100)));
}

function toDecimal(value: any): Decimal | null {
  if (value === null || value === undefined) return null;
  return new Decimal(value);
}

function avgDecimals(values: Decimal[]) {
  return values.length > 0
    ? values.reduce((sum, v) => sum.add(v), new Decimal(0)).div(values.length)
    : new Decimal(0);
}

function hasDecimal(value: Decimal | null | undefined): value is Decimal {
  return value !== null && value !== undefined;
}

function avgOrNull(values: Decimal[]) {
  return values.length > 0 ? avgDecimals(values) : null;
}

function sumOrNull(values: Decimal[]) {
  return values.length > 0
    ? values.reduce((sum, v) => sum.add(v), new Decimal(0))
    : null;
}

function getProgressPercent(node: any): Decimal | null {
  return toDecimal(node?.progress_percent ?? node?.progress_pct);
}

function getWeightPercent(node: any): Decimal | null {
  return toDecimal(node?.weight_percent ?? node?.weight_pct);
}

function contributesToParentScore(node: any): boolean {
  return (
    node?.contributes_to_parent_score !== false &&
    node?.contribute_to_score !== false
  );
}

function contributesToParentValue(node: any): boolean {
  return (
    node?.contributes_to_parent_value !== false &&
    node?.contribute_to_value !== false
  );
}

function weightedAvgOrSimpleAvg(
  items: Array<{ score: Decimal | null; weight?: Decimal | null }>,
) {
  const valid = items.filter((item) => hasDecimal(item.score));
  if (valid.length === 0) return null;

  const weighted = valid.filter(
    (item) => hasDecimal(item.weight) && item.weight.gt(0),
  );

  if (weighted.length > 0) {
    let totalWeight = new Decimal(0);
    let weightedScoreSum = new Decimal(0);

    for (const item of weighted) {
      totalWeight = totalWeight.add(item.weight!);
      weightedScoreSum = weightedScoreSum.add(item.score!.mul(item.weight!));
    }

    return totalWeight.gt(0)
      ? weightedScoreSum.div(totalWeight)
      : new Decimal(0);
  }

  // Fallback to simple average
  return avgDecimals(valid.map((v) => v.score as Decimal));
}

async function calculateConfidenceLevel(
  companyId: number,
  score: Decimal | null,
) {
  if (!score) return null;
  const mapping = await getConfidenceLevelMapping({ companyId });
  return resolveConfidenceLevelFromProgress({
    progressPercent: score.toNumber(),
    mapping,
  });
}

function computeNodeScoreValue(node: any, metric: any) {
  const finalScore = toDecimal(node?.final_score);
  const finalValue = toDecimal(node?.final_value);
  const progressPercent = getProgressPercent(node);
  const targetValue = toDecimal(node?.target_value);
  const currentValue = toDecimal(node?.current_value);

  const completed =
    Boolean(node?.completed_at) ||
    ["completed", "done", "closed"].includes(
      String(node?.status_code || "").toLowerCase(),
    );

  let score: Decimal | null = finalScore;
  if (!score && progressPercent) {
    score = clampPercent(progressPercent);
  }

  if (!score && targetValue && currentValue && targetValue.gt(0)) {
    score = clampPercent(currentValue.div(targetValue).mul(100));
  }

  if (!score && metric?.allows_binary_completion) {
    score = completed ? new Decimal(100) : new Decimal(0);
  }

  let value: Decimal | null = finalValue ?? currentValue;
  if (!value && completed && targetValue) {
    value = targetValue;
  }

  return { score, value };
}

/**
 * Compute a KR's score based on its metric definition type.
 * - Binary metrics: 0 or 100
 * - Target-value metrics: (currentValue / targetValue) * 100, capped at 100
 * - No-target metrics: use latest progress completion flag
 */
async function computeEmployeeKRScore(employeeKrId: number, tx: any = prisma) {
  const kr = await tx.employeeKeyResult.findUnique({
    where: { id: employeeKrId },
    include: {
      metricDefinition: true,
      progressUpdates: { orderBy: { created_at: "desc" }, take: 1 },
      monthlyPlans: {
        include: {
          weeklyPlans: {
            include: {
              metricDefinition: true,
              dailyPlans: {
                include: { metricDefinition: true },
                orderBy: { created_at: "asc" },
              },
            },
            orderBy: { week_number: "asc" },
          },
        },
        orderBy: { month_number: "asc" },
      },
      subtasks: {
        include: { metricDefinition: true },
        orderBy: { sequence_order: "asc" },
      },
    },
  });
  if (!kr) throw new Error("Employee KR not found.");

  const metric = kr.metricDefinition;
  if (!metric) throw new Error("Metric definition not found for KR.");
  const latestProgress = kr.progressUpdates[0];

  let score: Decimal | null = null;
  let value: Decimal | null = null;
  let indirectScore: Decimal | null = null;
  let indirectValue: Decimal | null = null;

  // 1) Weekly score/value from daily plans where available
  const monthlyPlans = kr.monthlyPlans ?? [];
  const weeklyAggregates = monthlyPlans.flatMap((monthPlan: any) =>
    (monthPlan.weeklyPlans ?? []).map((week: any) => {
      const base = computeNodeScoreValue(week, week.metricDefinition ?? metric);

      const directDailyScores: Decimal[] = [];
      const directDailyValues: Decimal[] = [];
      const indirectDailyScores: Decimal[] = [];
      const indirectDailyValues: Decimal[] = [];

      for (const dailyPlan of week.dailyPlans ?? []) {
        const m = computeNodeScoreValue(
          dailyPlan,
          dailyPlan.metricDefinition ?? week.metricDefinition ?? metric,
        );

        const contributesScore = contributesToParentScore(dailyPlan);
        if (contributesScore && hasDecimal(m.score)) {
          directDailyScores.push(m.score);
        }
        if (!contributesScore && hasDecimal(m.score)) {
          indirectDailyScores.push(m.score);
        }

        const contributesValue = contributesToParentValue(dailyPlan);
        if (contributesValue && hasDecimal(m.value)) {
          directDailyValues.push(m.value);
        }
        if (!contributesValue && hasDecimal(m.value)) {
          indirectDailyValues.push(m.value);
        }
      }

      return {
        ...week,
        monthPlanId: monthPlan.id,
        employee_month_plan_id: monthPlan.id,
        aggregateScore:
          (week.dailyPlans ?? []).length > 0
            ? weightedAvgOrSimpleAvg(
                (week.dailyPlans ?? []).map((m: any) => {
                  const results = computeNodeScoreValue(
                    m,
                    m.metricDefinition ?? week.metricDefinition ?? metric,
                  );
                  return {
                    score: contributesToParentScore(m) ? results.score : null,
                    weight: getWeightPercent(m),
                  };
                }),
              )
            : base.score,
        aggregateValue:
          directDailyValues.length > 0
            ? directDailyValues.reduce(
                (sum: Decimal, v: Decimal) => sum.add(v),
                new Decimal(0),
              )
            : base.value,
        indirectScore: avgOrNull(indirectDailyScores),
        indirectValue: sumOrNull(indirectDailyValues),
      };
    }),
  );

  // 2) Monthly score/value from weekly (if linked) or own monthly measurement
  const monthlyAggregates = monthlyPlans.map((monthPlan: any) => {
    const base = computeNodeScoreValue(monthPlan, metric);
    const linkedWeeks = weeklyAggregates.filter(
      (w: any) => w.employee_month_plan_id === monthPlan.id,
    );

    const weekScores = linkedWeeks
      .filter(
        (w: any) => contributesToParentScore(w) && hasDecimal(w.aggregateScore),
      )
      .map((w: any) => w.aggregateScore as Decimal);

    const weekValues = linkedWeeks
      .filter(
        (w: any) => contributesToParentValue(w) && hasDecimal(w.aggregateValue),
      )
      .map((w: any) => w.aggregateValue as Decimal);

    const weekIndirectScores = [
      ...linkedWeeks
        .filter(
          (w: any) =>
            !contributesToParentScore(w) && hasDecimal(w.aggregateScore),
        )
        .map((w: any) => w.aggregateScore as Decimal),
      ...linkedWeeks
        .filter((w: any) => hasDecimal(w.indirectScore))
        .map((w: any) => w.indirectScore as Decimal),
    ];

    const weekIndirectValues = [
      ...linkedWeeks
        .filter(
          (w: any) =>
            !contributesToParentValue(w) && hasDecimal(w.aggregateValue),
        )
        .map((w: any) => w.aggregateValue as Decimal),
      ...linkedWeeks
        .filter((w: any) => hasDecimal(w.indirectValue))
        .map((w: any) => w.indirectValue as Decimal),
    ];

    return {
      ...monthPlan,
      monthPlanId: monthPlan.id,
      aggregateScore:
        linkedWeeks.length > 0
          ? weightedAvgOrSimpleAvg(
              linkedWeeks.map((w: any) => ({
                score: contributesToParentScore(w) ? w.aggregateScore : null,
                weight: getWeightPercent(w),
              })),
            )
          : base.score,
      aggregateValue:
        weekValues.length > 0
          ? weekValues.reduce(
              (sum: Decimal, v: Decimal) => sum.add(v),
              new Decimal(0),
            )
          : base.value,
      indirectScore: avgOrNull(weekIndirectScores),
      indirectValue: sumOrNull(weekIndirectValues),
    };
  });

  // 3) KR score/value from month → weekly → subtask → progress fallback
  // Use the highest level that has usable aggregate output, not just existing rows.
  const monthScoreCandidates = monthlyAggregates
    .filter(
      (m: any) => contributesToParentScore(m) && hasDecimal(m.aggregateScore),
    )
    .map((m: any) => m.aggregateScore as Decimal);
  const monthValueCandidates = monthlyAggregates
    .filter(
      (m: any) => contributesToParentValue(m) && hasDecimal(m.aggregateValue),
    )
    .map((m: any) => m.aggregateValue as Decimal);

  const monthIndirectScoreCandidates = [
    ...monthlyAggregates
      .filter(
        (m: any) =>
          !contributesToParentScore(m) && hasDecimal(m.aggregateScore),
      )
      .map((m: any) => m.aggregateScore as Decimal),
    ...monthlyAggregates
      .filter((m: any) => hasDecimal(m.indirectScore))
      .map((m: any) => m.indirectScore as Decimal),
  ];

  const monthIndirectValueCandidates = [
    ...monthlyAggregates
      .filter(
        (m: any) =>
          !contributesToParentValue(m) && hasDecimal(m.aggregateValue),
      )
      .map((m: any) => m.aggregateValue as Decimal),
    ...monthlyAggregates
      .filter((m: any) => hasDecimal(m.indirectValue))
      .map((m: any) => m.indirectValue as Decimal),
  ];

  const hasMonthAggregateData =
    monthScoreCandidates.length > 0 ||
    monthValueCandidates.length > 0 ||
    monthIndirectScoreCandidates.length > 0 ||
    monthIndirectValueCandidates.length > 0;

  if (hasMonthAggregateData) {
    score =
      monthScoreCandidates.length > 0
        ? weightedAvgOrSimpleAvg(
            monthlyAggregates.map((m: any) => ({
              score: contributesToParentScore(m) ? m.aggregateScore : null,
              weight: getWeightPercent(m),
            })),
          )
        : null;
    value =
      monthValueCandidates.length > 0
        ? monthValueCandidates.reduce(
            (sum: Decimal, v: Decimal) => sum.add(v),
            new Decimal(0),
          )
        : null;

    indirectScore = avgOrNull(monthIndirectScoreCandidates);
    indirectValue = sumOrNull(monthIndirectValueCandidates);
  } else {
    const weekScoreCandidates = weeklyAggregates
      .filter(
        (w: any) => contributesToParentScore(w) && hasDecimal(w.aggregateScore),
      )
      .map((w: any) => w.aggregateScore as Decimal);
    const weekValueCandidates = weeklyAggregates
      .filter(
        (w: any) => contributesToParentValue(w) && hasDecimal(w.aggregateValue),
      )
      .map((w: any) => w.aggregateValue as Decimal);

    const weekIndirectScoreCandidates = [
      ...weeklyAggregates
        .filter(
          (w: any) =>
            !contributesToParentScore(w) && hasDecimal(w.aggregateScore),
        )
        .map((w: any) => w.aggregateScore as Decimal),
      ...weeklyAggregates
        .filter((w: any) => hasDecimal(w.indirectScore))
        .map((w: any) => w.indirectScore as Decimal),
    ];

    const weekIndirectValueCandidates = [
      ...weeklyAggregates
        .filter(
          (w: any) =>
            !contributesToParentValue(w) && hasDecimal(w.aggregateValue),
        )
        .map((w: any) => w.aggregateValue as Decimal),
      ...weeklyAggregates
        .filter((w: any) => hasDecimal(w.indirectValue))
        .map((w: any) => w.indirectValue as Decimal),
    ];

    const hasWeekAggregateData =
      weekScoreCandidates.length > 0 ||
      weekValueCandidates.length > 0 ||
      weekIndirectScoreCandidates.length > 0 ||
      weekIndirectValueCandidates.length > 0;

    if (hasWeekAggregateData) {
      score =
        weekScoreCandidates.length > 0
          ? weightedAvgOrSimpleAvg(
              weeklyAggregates.map((w: any) => ({
                score: contributesToParentScore(w) ? w.aggregateScore : null,
                weight: getWeightPercent(w),
              })),
            )
          : null;
      value =
        weekValueCandidates.length > 0
          ? weekValueCandidates.reduce(
              (sum: Decimal, v: Decimal) => sum.add(v),
              new Decimal(0),
            )
          : null;

      indirectScore = avgOrNull(weekIndirectScoreCandidates);
      indirectValue = sumOrNull(weekIndirectValueCandidates);
    } else if (kr.subtasks.length > 0) {
      const subtaskResults = kr.subtasks.map((task: any) => ({
        task,
        result: computeNodeScoreValue(task, task.metricDefinition ?? metric),
      }));

      const subtaskScoreCandidates = subtaskResults
        .filter(
          (x: any) =>
            contributesToParentScore(x.task) && hasDecimal(x.result.score),
        )
        .map((x: any) => x.result.score as Decimal);

      const subtaskValueCandidates = subtaskResults
        .filter(
          (x: any) =>
            contributesToParentValue(x.task) && hasDecimal(x.result.value),
        )
        .map((x: any) => x.result.value as Decimal);

      const subtaskIndirectScoreCandidates = subtaskResults
        .filter(
          (x: any) =>
            !contributesToParentScore(x.task) && hasDecimal(x.result.score),
        )
        .map((x: any) => x.result.score as Decimal);

      const subtaskIndirectValueCandidates = subtaskResults
        .filter(
          (x: any) =>
            !contributesToParentValue(x.task) && hasDecimal(x.result.value),
        )
        .map((x: any) => x.result.value as Decimal);

      const hasSubtaskAggregateData =
        subtaskScoreCandidates.length > 0 ||
        subtaskValueCandidates.length > 0 ||
        subtaskIndirectScoreCandidates.length > 0 ||
        subtaskIndirectValueCandidates.length > 0;

      if (hasSubtaskAggregateData) {
        score =
          subtaskScoreCandidates.length > 0
            ? weightedAvgOrSimpleAvg(
                subtaskResults.map((x: any) => ({
                  score: contributesToParentScore(x.task)
                    ? x.result.score
                    : null,
                  weight: getWeightPercent(x.task),
                })),
              )
            : null;
        value =
          subtaskValueCandidates.length > 0
            ? subtaskValueCandidates.reduce(
                (sum: Decimal, v: Decimal) => sum.add(v),
                new Decimal(0),
              )
            : null;

        indirectScore = avgOrNull(subtaskIndirectScoreCandidates);
        indirectValue = sumOrNull(subtaskIndirectValueCandidates);
      }
    }
  }

  if (!score) {
    if (metric.allows_binary_completion) {
      const isCompleted = latestProgress?.is_completed ?? false;
      score = isCompleted ? new Decimal(100) : new Decimal(0);
      value = isCompleted ? toDecimal(kr.target_value) : new Decimal(0);
    } else if (
      metric.requires_target_value &&
      kr.target_value &&
      latestProgress?.current_value
    ) {
      const currentVal = new Decimal(latestProgress.current_value);
      const targetVal = new Decimal(kr.target_value);
      if (targetVal.gt(0)) {
        score = clampPercent(currentVal.div(targetVal).mul(100));
      }
      value = currentVal;
    } else if (latestProgress?.current_value) {
      score = clampPercent(new Decimal(latestProgress.current_value));
      value = new Decimal(latestProgress.current_value);
    }
  }

  score = score ?? new Decimal(0);
  value = value ?? (kr.target_value ? new Decimal(0) : null);
  indirectScore = indirectScore ?? new Decimal(0);
  indirectValue = indirectValue ?? new Decimal(0);

  const confidenceLevel = await calculateConfidenceLevel(kr.company_id, score);

  // 5) Persist on the KR
  await tx.employeeKeyResult.update({
    where: { id: employeeKrId },
    data: {
      final_score: score,
      final_value: value,
      indirect_score: indirectScore,
      indirect_value: indirectValue,
    },
  });

  // 6) Update monthly plans based on aggregates
  for (const month of monthlyAggregates) {
    if (!month.monthPlanId) continue;

    const updates: Record<string, any> = {};
    if (hasDecimal(month.aggregateValue)) {
      updates.current_value = month.aggregateValue;

      if (!hasDecimal(month.aggregateScore)) {
        const target = toDecimal(month.target_value);
        if (target && target.gt(0)) {
          updates.progress_pct = clampPercent(
            month.aggregateValue.div(target).mul(100),
          );
        }
      }
    }

    if (hasDecimal(month.aggregateScore)) {
      updates.progress_pct = month.aggregateScore;
    }

    if (Object.keys(updates).length > 0) {
      await tx.employeeMonthPlan.update({
        where: { id: month.monthPlanId },
        data: updates,
      });
    }
  }

  // 7) Update confidence on weeks
  for (const week of weeklyAggregates) {
    const wConf = await calculateConfidenceLevel(
      kr.company_id,
      week.aggregateScore,
    );
    await tx.weeklyPlan.update({
      where: { id: week.id },
      data: {
        progress_pct: week.aggregateScore,
        current_value: week.aggregateValue,
        confidence_level: wConf,
      },
    });
  }

  return {
    score,
    value,
    indirectScore,
    indirectValue,
    isFinancial: metric.is_financial,
    supportsWeightedScore: metric.supports_weighted_score,
    supportsValueRollup: metric.supports_value_rollup,
  };
}

/**
 * Roll up all Employee KRs into their parent Employee Objective.
 * Uses weighted average of KR scores where contributes_to_objective_score=true.
 */
/**
 * Refined version that propagates upward.
 */
export async function rollupEmployeeObjective(
  objectiveId: number,
  tx: any = prisma,
  skipUpward: boolean = false,
) {
  const objectiveMeta = await tx.employeeObjective.findUnique({
    where: { id: objectiveId },
    select: { department_id: true },
  });
  if (objectiveMeta?.department_id) {
    return rollupDepartmentObjective(objectiveId, tx, skipUpward);
  }

  const result = await _rollupEmployeeObjectiveInternal(objectiveId, tx);

  if (!skipUpward) {
    const obj = await tx.employeeObjective.findUnique({
      where: { id: objectiveId },
      select: { chosen_parent_kr_id: true, chosen_parent_employee_kr_id: true },
    });
    if (obj?.chosen_parent_kr_id) {
      await rollupFromDepartmentKr(obj.chosen_parent_kr_id, tx);
    } else if (obj?.chosen_parent_employee_kr_id) {
      await rollupEmployeeKR(obj.chosen_parent_employee_kr_id, tx);
    }
  }
  return result;
}

async function _rollupEmployeeObjectiveInternal(
  objectiveId: number,
  tx: any = prisma,
) {
  const objective = await tx.employeeObjective.findUnique({
    where: { id: objectiveId },
    include: {
      keyResults: {
        include: {
          metricDefinition: true,
          progressUpdates: { orderBy: { created_at: "desc" }, take: 1 },
        },
      },
      parentEmployeeKr: {
        include: { metricDefinition: true },
      },
    },
  });
  if (!objective) throw new Error("Employee objective not found.");

  const isParentFinancial =
    objective.parentEmployeeKr?.metricDefinition?.is_financial === true;

  // First, recompute each KR's score
  for (const kr of objective.keyResults) {
    await computeEmployeeKRScore(kr.id, tx);
  }

  // Re-fetch after score update
  const updatedKRs = await tx.employeeKeyResult.findMany({
    where: { employee_objective_id: objectiveId },
    include: { metricDefinition: true },
  });

  // Weighted average for score
  let totalWeight = new Decimal(0);
  let weightedScoreSum = new Decimal(0);
  let totalValue = new Decimal(0);
  const indirectScoreCandidates: Decimal[] = [];
  let indirectValue = new Decimal(0);
  let allMandatoryComplete = true;

  for (const kr of updatedKRs) {
    const weight = kr.weight_percent ?? new Decimal(0);
    const score = kr.final_score ?? new Decimal(0);

    if (
      kr.contributes_to_objective_score &&
      kr.metricDefinition?.supports_weighted_score
    ) {
      totalWeight = totalWeight.add(weight);
      weightedScoreSum = weightedScoreSum.add(score.mul(weight));
    }

    if (
      kr.contributes_to_objective_value &&
      kr.metricDefinition?.supports_value_rollup
    ) {
      // Exclude non-financial supporting KRs from financial value total
      if (isParentFinancial) {
        if (kr.metricDefinition.is_financial) {
          totalValue = totalValue.add(kr.final_value ?? new Decimal(0));
        }
      } else {
        totalValue = totalValue.add(kr.final_value ?? new Decimal(0));
      }
    }

    if (
      kr.contributes_to_objective_score === false &&
      hasDecimal(kr.final_score)
    ) {
      indirectScoreCandidates.push(kr.final_score);
    }

    // Only bubble up a KR's own indirect_score when the KR itself IS a direct
    // contributor — non-contributing KRs already land in indirect via final_score
    // above, so adding their indirect_score too would double-count grandchildren.
    if (
      kr.contributes_to_objective_score !== false &&
      hasDecimal((kr as any).indirect_score)
    ) {
      indirectScoreCandidates.push((kr as any).indirect_score as Decimal);
    }

    if (kr.metricDefinition?.supports_value_rollup) {
      const shouldIncludeValue =
        !isParentFinancial || kr.metricDefinition.is_financial;

      if (shouldIncludeValue) {
        if (
          kr.contributes_to_objective_value === false &&
          hasDecimal(kr.final_value)
        ) {
          indirectValue = indirectValue.add(kr.final_value);
        }

        // Same guard for value: only propagate indirect_value from direct KRs
        if (
          kr.contributes_to_objective_value !== false &&
          hasDecimal((kr as any).indirect_value)
        ) {
          indirectValue = indirectValue.add(
            (kr as any).indirect_value as Decimal,
          );
        }
      }
    }

    if (
      kr.is_mandatory_for_completion &&
      (!kr.final_score || kr.final_score.lt(100))
    ) {
      allMandatoryComplete = false;
    }
  }

  let finalScore: Decimal;
  if (totalWeight.gt(0)) {
    finalScore = weightedScoreSum.div(totalWeight);
  } else {
    // Fallback: simple average of all KR scores where contributes_to_objective_score=true
    // This handles cases where weight_percent=0/null or supports_weighted_score=false
    const fallbackScores = updatedKRs
      .filter(
        (kr: any) =>
          kr.contributes_to_objective_score !== false &&
          hasDecimal(kr.final_score) &&
          kr.final_score.gt(0),
      )
      .map((kr: any) => kr.final_score as Decimal);
    finalScore =
      fallbackScores.length > 0 ? avgDecimals(fallbackScores) : new Decimal(0);
  }

  // Fallback for value: if no value came through the gated path, sum all contributing KR values
  if (totalValue.eq(0)) {
    const fallbackValues = updatedKRs
      .filter(
        (kr: any) =>
          kr.contributes_to_objective_value !== false &&
          hasDecimal(kr.final_value) &&
          kr.final_value.gt(0),
      )
      .map((kr: any) => kr.final_value as Decimal);
    if (fallbackValues.length > 0) {
      totalValue = fallbackValues.reduce(
        (sum: Decimal, v: Decimal) => sum.add(v),
        new Decimal(0),
      );
    }
  }

  const indirectScore =
    indirectScoreCandidates.length > 0
      ? avgDecimals(indirectScoreCandidates)
      : new Decimal(0);

  await tx.employeeObjective.update({
    where: { id: objectiveId },
    data: {
      final_score: finalScore,
      final_value: totalValue,
      indirect_score: indirectScore,
      indirect_value: indirectValue,
    },
  });

  return {
    objectiveId,
    finalScore,
    finalValue: totalValue,
    indirectScore,
    indirectValue,
    allMandatoryComplete,
  };
}

/**
 * Roll up contributor Employee Objectives into their parent Employee KR.
 */
export async function rollupEmployeeKR(
  employeeKrId: number,
  tx: any = prisma,
  skipUpward: boolean = false,
) {
  const empKr = await tx.employeeKeyResult.findUnique({
    where: { id: employeeKrId },
    include: {
      contributors: {
        where: { status_code: "active" },
        include: {
          employeeObjectives: {
            select: {
              id: true,
              final_score: true,
              final_value: true,
              indirect_score: true,
              indirect_value: true,
            },
          },
        },
      },
      metricDefinition: true,
    },
  });
  if (!empKr) throw new Error("Employee KR not found.");

  // Roll up each contributor's employee objectives first (skip upward to avoid loops)
  for (const contributor of empKr.contributors) {
    const empObj = contributor.employeeObjectives;
    if (empObj) {
      await rollupEmployeeObjective(empObj.id, tx, true);
    }
  }

  // Re-fetch after rollup
  const refreshed = await tx.employeeKeyResult.findUnique({
    where: { id: employeeKrId },
    include: {
      contributors: {
        where: { status_code: "active" },
        include: {
          employeeObjectives: {
            select: {
              final_score: true,
              final_value: true,
              indirect_score: true,
              indirect_value: true,
            },
          },
        },
      },
    },
  });

  // Average of contributor scores
  const allScores: Decimal[] = [];
  let totalValue = new Decimal(0);
  const indirectScores: Decimal[] = [];
  let indirectValue = new Decimal(0);

  for (const contributor of refreshed!.contributors) {
    const empObj = contributor.employeeObjectives;
    if (!empObj) continue;
    if (empObj.final_score) allScores.push(empObj.final_score);
    totalValue = totalValue.add(empObj.final_value ?? new Decimal(0));
    if (hasDecimal((empObj as any).indirect_score)) {
      indirectScores.push((empObj as any).indirect_score as Decimal);
    }
    if (hasDecimal((empObj as any).indirect_value)) {
      indirectValue = indirectValue.add(
        (empObj as any).indirect_value as Decimal,
      );
    }
  }

  let avgScore = new Decimal(0);
  let avgIndirectScore = new Decimal(0);

  if (allScores.length > 0) {
    avgScore = allScores
      .reduce((sum, s) => sum.add(s), new Decimal(0))
      .div(allScores.length);
    avgIndirectScore =
      indirectScores.length > 0 ? avgDecimals(indirectScores) : new Decimal(0);
  } else {
    // Fallback to own plans/subtasks if no contributors
    const results = await computeEmployeeKRScore(employeeKrId, tx);
    avgScore = results.score;
    totalValue = results.value ?? new Decimal(0);
    avgIndirectScore = results.indirectScore;
    indirectValue = results.indirectValue;
  }

  await tx.employeeKeyResult.update({
    where: { id: employeeKrId },
    data: {
      final_score: avgScore,
      final_value: totalValue,
      indirect_score: avgIndirectScore,
      indirect_value: indirectValue,
    },
  });

  // NOTE: Do NOT cascade upward here. The caller (recalculateRollUp) is responsible
  // for upward propagation to avoid infinite recursion (rollupEmployeeObjective
  // may call rollupEmployeeKR when there's chosen_parent_employee_kr_id).

  return {
    employeeKrId,
    avgScore,
    totalValue,
    indirectScore: avgIndirectScore,
    indirectValue,
  };
}

/**
 * Roll up contributor Employee Objectives into their parent Department KR.
 * NOTE: "Department KR" is an EmployeeKeyResult whose parent EmployeeObjective
 * has department_id set. There is no separate DepartmentKeyResult model.
 */
export async function rollupDepartmentKR(
  departmentKrId: number,
  tx: any = prisma,
) {
  const deptKr = await tx.employeeKeyResult.findUnique({
    where: { id: departmentKrId },
    include: {
      contributors: {
        include: {
          employeeObjectives: {
            select: {
              id: true,
              final_score: true,
              final_value: true,
              indirect_score: true,
              indirect_value: true,
            },
          },
        },
      },
      metricDefinition: true,
    },
  });
  if (!deptKr) throw new Error("Department KR not found.");

  // Roll up each contributor's employee objectives first
  for (const contributor of deptKr.contributors) {
    if (contributor.employeeObjectives) {
      await rollupEmployeeObjective(contributor.employeeObjectives.id, tx);
    }
  }

  // Re-fetch after rollup
  const refreshed = await tx.employeeKeyResult.findUnique({
    where: { id: departmentKrId },
    include: {
      contributors: {
        where: { status_code: "active" },
        include: {
          employeeObjectives: {
            select: {
              final_score: true,
              final_value: true,
              indirect_score: true,
              indirect_value: true,
            },
          },
        },
      },
    },
  });

  // Average of contributor scores
  const allScores: Decimal[] = [];
  let totalValue = new Decimal(0);
  const indirectScores: Decimal[] = [];
  let indirectValue = new Decimal(0);

  for (const contributor of refreshed!.contributors) {
    const empObj = contributor.employeeObjectives;
    if (empObj) {
      if (empObj.final_score) allScores.push(empObj.final_score);
      totalValue = totalValue.add(empObj.final_value ?? new Decimal(0));
      if (hasDecimal((empObj as any).indirect_score)) {
        indirectScores.push((empObj as any).indirect_score as Decimal);
      }
      if (hasDecimal((empObj as any).indirect_value)) {
        indirectValue = indirectValue.add(
          (empObj as any).indirect_value as Decimal,
        );
      }
    }
  }

  let avgScore: Decimal | null =
    allScores.length > 0
      ? allScores
          .reduce((sum, s) => sum.add(s), new Decimal(0))
          .div(allScores.length)
      : new Decimal(0);
  let avgIndirectScore: Decimal | null =
    indirectScores.length > 0 ? avgDecimals(indirectScores) : new Decimal(0);

  // Fallback to monthly/weekly measurable plans when no contributor objectives exist
  if (allScores.length === 0 && totalValue.eq(0)) {
    const planBased = await tx.employeeKeyResult.findUnique({
      where: { id: departmentKrId },
      include: {
        monthlyPlans: {
          include: {
            weeklyPlans: {
              include: {
                metricDefinition: true,
                dailyPlans: { include: { metricDefinition: true } },
              },
              orderBy: { week_number: "asc" },
            },
          },
          orderBy: { month_number: "asc" },
        },
        metricDefinition: true,
      },
    });

    if (planBased) {
      const monthlyPlans = planBased.monthlyPlans ?? [];
      const weeklyAggregates = monthlyPlans.flatMap((monthPlan: any) =>
        (monthPlan.weeklyPlans ?? []).map((week: any) => {
          const base = computeNodeScoreValue(
            week,
            week.metricDefinition ?? planBased.metricDefinition,
          );

          const directDailyScores: Decimal[] = [];
          const directDailyValues: Decimal[] = [];
          const indirectDailyScores: Decimal[] = [];
          const indirectDailyValues: Decimal[] = [];

          for (const dailyPlan of week.dailyPlans ?? []) {
            const d = computeNodeScoreValue(
              dailyPlan,
              dailyPlan.metricDefinition ??
                week.metricDefinition ??
                planBased.metricDefinition,
            );

            const contributesScore = contributesToParentScore(dailyPlan);
            if (contributesScore && hasDecimal(d.score)) {
              directDailyScores.push(d.score);
            }
            if (!contributesScore && hasDecimal(d.score)) {
              indirectDailyScores.push(d.score);
            }

            const contributesValue = contributesToParentValue(dailyPlan);
            if (contributesValue && hasDecimal(d.value)) {
              directDailyValues.push(d.value);
            }
            if (!contributesValue && hasDecimal(d.value)) {
              indirectDailyValues.push(d.value);
            }
          }

          return {
            ...week,
            monthPlanId: monthPlan.id,
            employee_month_plan_id: monthPlan.id,
            aggregateScore:
              (week.dailyPlans ?? []).length > 0
                ? weightedAvgOrSimpleAvg(
                    (week.dailyPlans ?? []).map((d: any) => {
                      const results = computeNodeScoreValue(
                        d,
                        d.metricDefinition ??
                          week.metricDefinition ??
                          planBased.metricDefinition,
                      );
                      return {
                        score: contributesToParentScore(d)
                          ? results.score
                          : null,
                        weight: getWeightPercent(d),
                      };
                    }),
                  )
                : base.score,
            aggregateValue:
              directDailyValues.length > 0
                ? directDailyValues.reduce(
                    (sum: Decimal, v: Decimal) => sum.add(v),
                    new Decimal(0),
                  )
                : base.value,
            indirectScore: avgOrNull(indirectDailyScores),
            indirectValue: sumOrNull(indirectDailyValues),
          };
        }),
      );

      const monthlyAggregates = monthlyPlans.map((monthPlan: any) => {
        const base = computeNodeScoreValue(
          monthPlan,
          planBased.metricDefinition,
        );
        const linkedWeeks = weeklyAggregates.filter(
          (w: any) => w.employee_month_plan_id === monthPlan.id,
        );

        const weekScores = linkedWeeks
          .filter(
            (w: any) =>
              contributesToParentScore(w) && hasDecimal(w.aggregateScore),
          )
          .map((w: any) => w.aggregateScore as Decimal);

        const weekValues = linkedWeeks
          .filter(
            (w: any) =>
              contributesToParentValue(w) && hasDecimal(w.aggregateValue),
          )
          .map((w: any) => w.aggregateValue as Decimal);

        const weekIndirectScores = [
          ...linkedWeeks
            .filter(
              (w: any) =>
                !contributesToParentScore(w) && hasDecimal(w.aggregateScore),
            )
            .map((w: any) => w.aggregateScore as Decimal),
          ...linkedWeeks
            .filter((w: any) => hasDecimal(w.indirectScore))
            .map((w: any) => w.indirectScore as Decimal),
        ];

        const weekIndirectValues = [
          ...linkedWeeks
            .filter(
              (w: any) =>
                !contributesToParentValue(w) && hasDecimal(w.aggregateValue),
            )
            .map((w: any) => w.aggregateValue as Decimal),
          ...linkedWeeks
            .filter((w: any) => hasDecimal(w.indirectValue))
            .map((w: any) => w.indirectValue as Decimal),
        ];

        return {
          ...monthPlan,
          monthPlanId: monthPlan.id,
          aggregateScore:
            linkedWeeks.length > 0
              ? weightedAvgOrSimpleAvg(
                  linkedWeeks.map((w: any) => ({
                    score: contributesToParentScore(w)
                      ? w.aggregateScore
                      : null,
                    weight: getWeightPercent(w),
                  })),
                )
              : base.score,
          aggregateValue:
            weekValues.length > 0
              ? weekValues.reduce(
                  (sum: Decimal, v: Decimal) => sum.add(v),
                  new Decimal(0),
                )
              : base.value,
          indirectScore: avgOrNull(weekIndirectScores),
          indirectValue: sumOrNull(weekIndirectValues),
        };
      });

      const monthScores = monthlyAggregates
        .filter(
          (m: any) =>
            contributesToParentScore(m) && hasDecimal(m.aggregateScore),
        )
        .map((m: any) => m.aggregateScore as Decimal);

      const monthValueItems = monthlyAggregates
        .filter(
          (m: any) =>
            contributesToParentValue(m) && hasDecimal(m.aggregateValue),
        )
        .map((m: any) => m.aggregateValue as Decimal);

      const monthIndirectScores = [
        ...monthlyAggregates
          .filter(
            (m: any) =>
              !contributesToParentScore(m) && hasDecimal(m.aggregateScore),
          )
          .map((m: any) => m.aggregateScore as Decimal),
        ...monthlyAggregates
          .filter((m: any) => hasDecimal(m.indirectScore))
          .map((m: any) => m.indirectScore as Decimal),
      ];

      const monthIndirectValues = [
        ...monthlyAggregates
          .filter(
            (m: any) =>
              !contributesToParentValue(m) && hasDecimal(m.aggregateValue),
          )
          .map((m: any) => m.aggregateValue as Decimal),
        ...monthlyAggregates
          .filter((m: any) => hasDecimal(m.indirectValue))
          .map((m: any) => m.indirectValue as Decimal),
      ];

      const hasMonthAggregateData =
        monthScores.length > 0 ||
        monthValueItems.length > 0 ||
        monthIndirectScores.length > 0 ||
        monthIndirectValues.length > 0;

      if (hasMonthAggregateData) {
        const computedScore =
          monthScores.length > 0
            ? weightedAvgOrSimpleAvg(
                monthlyAggregates.map((m: any) => ({
                  score: contributesToParentScore(m) ? m.aggregateScore : null,
                  weight: getWeightPercent(m),
                })),
              )
            : new Decimal(0);
        avgScore = computedScore ?? new Decimal(0);
        totalValue = monthValueItems.reduce(
          (sum: Decimal, v: Decimal) => sum.add(v),
          new Decimal(0),
        );
        avgIndirectScore =
          monthIndirectScores.length > 0
            ? avgDecimals(monthIndirectScores)
            : new Decimal(0);
        indirectValue = monthIndirectValues.reduce(
          (sum: Decimal, v: Decimal) => sum.add(v),
          new Decimal(0),
        );
      } else {
        const weekScores = weeklyAggregates
          .filter(
            (w: any) =>
              contributesToParentScore(w) && hasDecimal(w.aggregateScore),
          )
          .map((w: any) => w.aggregateScore as Decimal);
        if (weekScores.length > 0) {
          const computedWeekScore = weightedAvgOrSimpleAvg(
            weeklyAggregates.map((w: any) => ({
              score: contributesToParentScore(w) ? w.aggregateScore : null,
              weight: getWeightPercent(w),
            })),
          );
          avgScore = computedWeekScore ?? new Decimal(0);
        }

        const weekValues = weeklyAggregates
          .filter(
            (w: any) =>
              contributesToParentValue(w) && hasDecimal(w.aggregateValue),
          )
          .map((w: any) => w.aggregateValue as Decimal);
        totalValue = weekValues.reduce(
          (sum: Decimal, v: Decimal) => sum.add(v),
          new Decimal(0),
        );

        const weekIndirectScores = [
          ...weeklyAggregates
            .filter(
              (w: any) =>
                !contributesToParentScore(w) && hasDecimal(w.aggregateScore),
            )
            .map((w: any) => w.aggregateScore as Decimal),
          ...weeklyAggregates
            .filter((w: any) => hasDecimal(w.indirectScore))
            .map((w: any) => w.indirectScore as Decimal),
        ];

        const weekIndirectValues = [
          ...weeklyAggregates
            .filter(
              (w: any) =>
                !contributesToParentValue(w) && hasDecimal(w.aggregateValue),
            )
            .map((w: any) => w.aggregateValue as Decimal),
          ...weeklyAggregates
            .filter((w: any) => hasDecimal(w.indirectValue))
            .map((w: any) => w.indirectValue as Decimal),
        ];

        avgIndirectScore =
          weekIndirectScores.length > 0
            ? avgDecimals(weekIndirectScores)
            : new Decimal(0);
        indirectValue = weekIndirectValues.reduce(
          (sum: Decimal, v: Decimal) => sum.add(v),
          new Decimal(0),
        );

        // Sync confidence for sub-layers
        for (const week of weeklyAggregates) {
          const wConf = await calculateConfidenceLevel(
            planBased.company_id,
            week.aggregateScore,
          );
          await tx.weeklyPlan.update({
            where: { id: week.id },
            data: {
              progress_pct: week.aggregateScore,
              current_value: week.aggregateValue,
              confidence_level: wConf,
            },
          });
        }
      }
    }
  }

  await tx.employeeKeyResult.update({
    where: { id: departmentKrId },
    data: {
      final_score: avgScore,
      final_value: totalValue,
      indirect_score: avgIndirectScore,
      indirect_value: indirectValue,
    },
  });

  // NOTE: Do NOT cascade to rollupDepartmentObjective here. The caller is responsible
  // for upward propagation to avoid infinite recursion (rollupDepartmentObjective
  // calls rollupDepartmentKR for each KR, so rollupDepartmentKR must not call back up).

  return {
    departmentKrId,
    avgScore,
    totalValue,
    indirectScore: avgIndirectScore,
    indirectValue,
  };
}

/**
 * Roll up Department KRs into their parent Department Objective.
 * NOTE: "Department Objective" is an EmployeeObjective with department_id set,
 * linked to CompanyKeyResult via chosen_parent_kr_id (parentCompanyKr relation).
 */
export async function rollupDepartmentObjective(
  deptObjectiveId: number,
  tx: any = prisma,
  skipUpward: boolean = false,
) {
  const objective = await tx.employeeObjective.findUnique({
    where: { id: deptObjectiveId },
    include: {
      keyResults: { include: { metricDefinition: true } },
      parentCompanyKr: { include: { metricDefinition: true } },
    },
  });
  if (!objective) throw new Error("Department objective not found.");
  const isParentFinancial =
    objective.parentCompanyKr?.metricDefinition?.is_financial === true;

  // Roll up each dept KR first
  for (const kr of objective.keyResults) {
    await rollupDepartmentKR(kr.id, tx);
  }

  // Re-fetch
  const updatedKRs = await tx.employeeKeyResult.findMany({
    where: { employee_objective_id: deptObjectiveId },
    include: { metricDefinition: true },
  });

  let totalWeight = new Decimal(0);
  let weightedScoreSum = new Decimal(0);
  let totalValue = new Decimal(0);
  const indirectScoreCandidates: Decimal[] = [];
  let indirectValue = new Decimal(0);

  for (const kr of updatedKRs) {
    const weight = kr.weight_percent ?? new Decimal(0);
    const score = kr.final_score ?? new Decimal(0);

    if (
      kr.contributes_to_objective_score &&
      kr.metricDefinition?.supports_weighted_score
    ) {
      totalWeight = totalWeight.add(weight);
      weightedScoreSum = weightedScoreSum.add(score.mul(weight));
    }

    if (
      kr.contributes_to_objective_value &&
      kr.metricDefinition?.supports_value_rollup
    ) {
      if (isParentFinancial) {
        if (kr.metricDefinition.is_financial) {
          totalValue = totalValue.add(kr.final_value ?? new Decimal(0));
        }
      } else {
        totalValue = totalValue.add(kr.final_value ?? new Decimal(0));
      }
    }

    if (
      kr.contributes_to_objective_score === false &&
      hasDecimal(kr.final_score)
    ) {
      indirectScoreCandidates.push(kr.final_score);
    }

    // Only propagate a KR's own indirect_score when the KR itself IS direct
    if (
      kr.contributes_to_objective_score !== false &&
      hasDecimal((kr as any).indirect_score)
    ) {
      indirectScoreCandidates.push((kr as any).indirect_score as Decimal);
    }

    if (kr.metricDefinition?.supports_value_rollup) {
      const shouldIncludeValue =
        !isParentFinancial || kr.metricDefinition.is_financial;

      if (shouldIncludeValue) {
        if (
          kr.contributes_to_objective_value === false &&
          hasDecimal(kr.final_value)
        ) {
          indirectValue = indirectValue.add(kr.final_value);
        }

        if (
          kr.contributes_to_objective_value !== false &&
          hasDecimal((kr as any).indirect_value)
        ) {
          indirectValue = indirectValue.add(
            (kr as any).indirect_value as Decimal,
          );
        }
      }
    }
  }

  let finalScore: Decimal;
  if (totalWeight.gt(0)) {
    finalScore = weightedScoreSum.div(totalWeight);
  } else {
    // Fallback: simple average of all KR scores where contributes_to_objective_score=true
    const fallbackScores = updatedKRs
      .filter(
        (kr: any) =>
          kr.contributes_to_objective_score !== false &&
          hasDecimal(kr.final_score) &&
          kr.final_score.gt(0),
      )
      .map((kr: any) => kr.final_score as Decimal);
    finalScore =
      fallbackScores.length > 0 ? avgDecimals(fallbackScores) : new Decimal(0);
  }

  if (totalValue.eq(0)) {
    const fallbackValues = updatedKRs
      .filter(
        (kr: any) =>
          kr.contributes_to_objective_value !== false &&
          hasDecimal(kr.final_value) &&
          kr.final_value.gt(0),
      )
      .map((kr: any) => kr.final_value as Decimal);
    if (fallbackValues.length > 0) {
      totalValue = fallbackValues.reduce(
        (sum: Decimal, v: Decimal) => sum.add(v),
        new Decimal(0),
      );
    }
  }

  const indirectScore =
    indirectScoreCandidates.length > 0
      ? avgDecimals(indirectScoreCandidates)
      : new Decimal(0);

  await tx.employeeObjective.update({
    where: { id: deptObjectiveId },
    data: {
      final_score: finalScore,
      final_value: totalValue,
      indirect_score: indirectScore,
      indirect_value: indirectValue,
    },
  });

  if (!skipUpward) {
    // Cascade up to Company KR
    const obj = await tx.employeeObjective.findUnique({
      where: { id: deptObjectiveId },
      select: { chosen_parent_kr_id: true },
    });
    if (obj?.chosen_parent_kr_id) {
      await rollupCompanyKR(obj.chosen_parent_kr_id, tx);
    }
  }

  return {
    deptObjectiveId,
    finalScore,
    finalValue: totalValue,
    indirectScore,
    indirectValue,
  };
}

/**
 * Roll up Department Objectives into their parent Company KR.
 * NOTE: CompanyKeyResult.employeeObjectives is the relation to EmployeeObjective
 * records (department-level) linked via chosen_parent_kr_id.
 */
export async function rollupCompanyKR(companyKrId: number, tx: any = prisma) {
  if (
    !(await tx.companyKeyResult.findUnique({
      where: { id: companyKrId },
      select: { id: true },
    }))
  ) {
    throw new Error("Company KR not found.");
  }

  // Do NOT re-roll department objectives here — callers are responsible for
  // rolling up from the bottom before calling rollupCompanyKR. Re-rolling here
  // caused double-work and recursive loops via rollupDepartmentObjective →
  // rollupCompanyKR → rollupDepartmentObjective.

  // Read already-computed department objective scores
  const refreshedDeptObjs = await tx.employeeObjective.findMany({
    where: { chosen_parent_kr_id: companyKrId },
    select: {
      final_score: true,
      final_value: true,
      indirect_score: true,
      indirect_value: true,
    },
  });

  const scores = refreshedDeptObjs
    .filter((o: any) => o.final_score)
    .map((o: any) => o.final_score!);
  const avgScore =
    scores.length > 0
      ? scores
          .reduce((sum: Decimal, s: Decimal) => sum.add(s), new Decimal(0))
          .div(scores.length)
      : new Decimal(0);
  const totalValue = refreshedDeptObjs.reduce(
    (sum: Decimal, o: any) => sum.add(o.final_value ?? new Decimal(0)),
    new Decimal(0),
  );

  const indirectScores = refreshedDeptObjs
    .filter((o: any) => hasDecimal(o.indirect_score))
    .map((o: any) => o.indirect_score as Decimal);

  const avgIndirectScore =
    indirectScores.length > 0 ? avgDecimals(indirectScores) : new Decimal(0);

  const totalIndirectValue = refreshedDeptObjs.reduce(
    (sum: Decimal, o: any) => sum.add(o.indirect_value ?? new Decimal(0)),
    new Decimal(0),
  );

  await tx.companyKeyResult.update({
    where: { id: companyKrId },
    data: {
      final_score: avgScore,
      final_value: totalValue,
      indirect_score: avgIndirectScore,
      indirect_value: totalIndirectValue,
    },
  });

  // NOTE: Do NOT cascade to rollupCompanyObjective here. The caller is responsible
  // for upward propagation to avoid infinite recursion (rollupCompanyObjective
  // calls rollupCompanyKR for each KR, so rollupCompanyKR must not call back up).

  return {
    companyKrId,
    avgScore,
    totalValue,
    indirectScore: avgIndirectScore,
    indirectValue: totalIndirectValue,
  };
}

/**
 * Roll up Company KRs into their parent Company Objective.
 */
export async function rollupCompanyObjective(
  companyObjectiveId: number,
  tx: any = prisma,
) {
  // A Company Objective doesn't have a parent KR to pull a definitive "is_financial" flag.
  // We will evaluate based on if ANY score-contributing company KR is financial.
  // Wait, no. If a Company KR is financial, it already holds a financial value.
  // We just sum them if they are financial or if ALL are non-financial.
  // To keep it simple, we just sum up everything that says supports_value_rollup.
  // Actually, standard practice for top level is to sum financial ones if they exist, or non-financial ones if they don't.
  // For now we'll just respect supports_value_rollup because the top-level "Objective" value is arbitrary without a specific metric constraint.
  const objective = await tx.companyObjective.findUnique({
    where: { id: companyObjectiveId },
    include: { keyResults: { include: { metricDefinition: true } } },
  });
  if (!objective) throw new Error("Company objective not found.");

  // Roll up each company KR
  for (const kr of objective.keyResults) {
    await rollupCompanyKR(kr.id, tx);
  }

  // Re-fetch
  const updatedKRs = await tx.companyKeyResult.findMany({
    where: { objective_id: companyObjectiveId },
    include: { metricDefinition: true },
  });

  let totalWeight = new Decimal(0);
  let weightedScoreSum = new Decimal(0);
  let totalValue = new Decimal(0);
  const indirectScoreCandidates: Decimal[] = [];
  let indirectValue = new Decimal(0);

  for (const kr of updatedKRs) {
    const weight = kr.weight_percent ?? new Decimal(0);
    const score = kr.final_score ?? new Decimal(0);

    if (
      kr.contributes_to_objective_score &&
      kr.metricDefinition?.supports_weighted_score
    ) {
      totalWeight = totalWeight.add(weight);
      weightedScoreSum = weightedScoreSum.add(score.mul(weight));
    }

    if (
      kr.contributes_to_objective_value &&
      kr.metricDefinition?.supports_value_rollup
    ) {
      totalValue = totalValue.add(kr.final_value ?? new Decimal(0));
    }

    if (
      kr.contributes_to_objective_score === false &&
      hasDecimal(kr.final_score)
    ) {
      indirectScoreCandidates.push(kr.final_score);
    }

    // Only propagate a KR's own indirect_score when the KR itself IS direct
    if (
      kr.contributes_to_objective_score !== false &&
      hasDecimal((kr as any).indirect_score)
    ) {
      indirectScoreCandidates.push((kr as any).indirect_score as Decimal);
    }

    if (kr.metricDefinition?.supports_value_rollup) {
      if (
        kr.contributes_to_objective_value === false &&
        hasDecimal(kr.final_value)
      ) {
        indirectValue = indirectValue.add(kr.final_value);
      }

      if (
        kr.contributes_to_objective_value !== false &&
        hasDecimal((kr as any).indirect_value)
      ) {
        indirectValue = indirectValue.add(
          (kr as any).indirect_value as Decimal,
        );
      }
    }
  }

  let finalScore: Decimal;
  if (totalWeight.gt(0)) {
    finalScore = weightedScoreSum.div(totalWeight);
  } else {
    // Fallback: simple average of all KR scores where contributes_to_objective_score=true
    const fallbackScores = updatedKRs
      .filter(
        (kr: any) =>
          kr.contributes_to_objective_score !== false &&
          hasDecimal(kr.final_score) &&
          kr.final_score.gt(0),
      )
      .map((kr: any) => kr.final_score as Decimal);
    finalScore =
      fallbackScores.length > 0 ? avgDecimals(fallbackScores) : new Decimal(0);
  }

  if (totalValue.eq(0)) {
    const fallbackValues = updatedKRs
      .filter(
        (kr: any) =>
          kr.contributes_to_objective_value !== false &&
          hasDecimal(kr.final_value) &&
          kr.final_value.gt(0),
      )
      .map((kr: any) => kr.final_value as Decimal);
    if (fallbackValues.length > 0) {
      totalValue = fallbackValues.reduce(
        (sum: Decimal, v: Decimal) => sum.add(v),
        new Decimal(0),
      );
    }
  }

  const indirectScore =
    indirectScoreCandidates.length > 0
      ? avgDecimals(indirectScoreCandidates)
      : new Decimal(0);

  await tx.companyObjective.update({
    where: { id: companyObjectiveId },
    data: {
      final_score: finalScore,
      final_value: totalValue,
      indirect_score: indirectScore,
      indirect_value: indirectValue,
    },
  });

  return {
    companyObjectiveId,
    finalScore,
    finalValue: totalValue,
    indirectScore,
    indirectValue,
  };
}

/**
 * Cascade rollup from a Department KR (EmployeeKeyResult) all the way up to Company Objective.
 */
export async function rollupFromDepartmentKr(
  departmentKrId: number,
  tx: any = prisma,
) {
  // Fetch parent objective id first
  const departmentKr = await tx.employeeKeyResult.findUnique({
    where: { id: departmentKrId },
    select: { employee_objective_id: true },
  });
  if (!departmentKr) throw new Error("Department KR not found for cascade.");

  // rollupDepartmentObjective already rolls up all KRs of the objective
  // (including departmentKrId), so we don't need a separate rollupDepartmentKR call.
  const departmentObjectiveResult = await rollupDepartmentObjective(
    departmentKr.employee_objective_id,
    tx,
  );

  const departmentObjective = await tx.employeeObjective.findUnique({
    where: { id: departmentKr.employee_objective_id },
    select: { chosen_parent_kr_id: true },
  });
  if (!departmentObjective || !departmentObjective.chosen_parent_kr_id)
    throw new Error(
      "Department objective not found for cascade or missing company KR link.",
    );

  const companyKrResult = await rollupCompanyKR(
    departmentObjective.chosen_parent_kr_id,
    tx,
  );

  const companyKr = await tx.companyKeyResult.findUnique({
    where: { id: departmentObjective.chosen_parent_kr_id },
    select: { objective_id: true },
  });
  if (!companyKr) throw new Error("Company KR not found for cascade.");

  const companyObjectiveResult = await rollupCompanyObjective(
    companyKr.objective_id,
    tx,
  );

  return {
    departmentKrId,
    departmentObjectiveId: departmentKr.employee_objective_id,
    companyKrId: departmentObjective.chosen_parent_kr_id,
    companyObjectiveId: companyKr.objective_id,
    departmentObjective: departmentObjectiveResult,
    companyKr: companyKrResult,
    companyObjective: companyObjectiveResult,
  };
}

/**
 * Cascade rollup from an Employee Objective up to Company Objective.
 */
export async function rollupFromEmployeeObjective(
  employeeObjectiveId: number,
  tx: any = prisma,
) {
  const employeeObjective = await tx.employeeObjective.findUnique({
    where: { id: employeeObjectiveId },
    select: { chosen_parent_kr_id: true, chosen_parent_employee_kr_id: true },
  });
  if (!employeeObjective)
    throw new Error("Employee objective not found for cascade.");

  // 1. Recompute the employee objective itself first
  const employeeObjectiveResult = await rollupEmployeeObjective(
    employeeObjectiveId,
    tx,
  );

  if (employeeObjective.chosen_parent_kr_id) {
    return rollupFromDepartmentKr(employeeObjective.chosen_parent_kr_id, tx);
  } else if ((employeeObjective as any).chosen_parent_employee_kr_id) {
    const parentKrId = (employeeObjective as any).chosen_parent_employee_kr_id;
    // Recursive cascade through employee layers
    await rollupEmployeeKR(parentKrId, tx);
    const parentKr = await tx.employeeKeyResult.findUnique({
      where: { id: parentKrId },
      select: { employee_objective_id: true },
    });
    if (parentKr) {
      return rollupFromEmployeeObjective(parentKr.employee_objective_id, tx);
    }
  }

  return employeeObjectiveResult;
}

/**
 * Full bottom-up rollup for the entire cycle.
 * Employee KRs → Employee Objectives → Department KRs → Department Objectives → Company KRs → Company Objectives
 */
export async function refreshFullRollup(companyId: number, cycleId: number) {
  return await prisma.$transaction(
    async (tx) => {
      const companyObjectives = await tx.companyObjective.findMany({
        where: { company_id: companyId, cycle_id: cycleId },
        select: { id: true },
      });

      const results = [];
      for (const obj of companyObjectives) {
        const result = await rollupCompanyObjective(obj.id, tx);
        results.push(result);
      }

      return {
        cycleId,
        companyId,
        objectivesProcessed: results.length,
        results,
      };
    },
    {
      maxWait: 10000, // increased from 5000ms to handle more wait time
      timeout: 120000, // increased from 30000ms (30s) to 120000ms (2 minutes) for complex rollups
    },
  );
}

/**
 * Get completion status for an entity, checking mandatory KR dependencies.
 */
export async function getCompletionStatus(
  entityId: number,
  level: "EMPLOYEE" | "DEPARTMENT" | "COMPANY",
) {
  if (level === "EMPLOYEE") {
    const krs = await prisma.employeeKeyResult.findMany({
      where: { employee_objective_id: entityId },
    });
    const mandatoryKRs = krs.filter((kr) => kr.is_mandatory_for_completion);
    const allMandatoryDone = mandatoryKRs.every(
      (kr) => kr.final_score && kr.final_score.gte(100),
    );
    const totalKRs = krs.length;
    const completedKRs = krs.filter(
      (kr) => kr.final_score && kr.final_score.gte(100),
    ).length;

    return {
      entityId,
      level,
      totalKRs,
      completedKRs,
      mandatoryKRs: mandatoryKRs.length,
      mandatoryCompleted: mandatoryKRs.filter(
        (kr) => kr.final_score && kr.final_score.gte(100),
      ).length,
      allMandatoryDone,
      completionRate: totalKRs > 0 ? (completedKRs / totalKRs) * 100 : 0,
      isBlocked: mandatoryKRs.length > 0 && !allMandatoryDone,
    };
  }

  if (level === "DEPARTMENT") {
    const krs = await prisma.employeeKeyResult.findMany({
      where: { employee_objective_id: entityId },
    });
    const mandatoryKRs = krs.filter((kr) => kr.is_mandatory_for_completion);
    const allMandatoryDone = mandatoryKRs.every(
      (kr) => kr.final_score && kr.final_score.gte(100),
    );
    const totalKRs = krs.length;
    const completedKRs = krs.filter(
      (kr) => kr.final_score && kr.final_score.gte(100),
    ).length;

    return {
      entityId,
      level,
      totalKRs,
      completedKRs,
      mandatoryKRs: mandatoryKRs.length,
      mandatoryCompleted: mandatoryKRs.filter(
        (kr) => kr.final_score && kr.final_score.gte(100),
      ).length,
      allMandatoryDone,
      completionRate: totalKRs > 0 ? (completedKRs / totalKRs) * 100 : 0,
      isBlocked: mandatoryKRs.length > 0 && !allMandatoryDone,
    };
  }

  // COMPANY
  const krs = await prisma.companyKeyResult.findMany({
    where: { objective_id: entityId },
  });
  const mandatoryKRs = krs.filter((kr) => kr.is_mandatory_for_completion);
  const allMandatoryDone = mandatoryKRs.every(
    (kr) => kr.final_score && kr.final_score.gte(100),
  );
  const totalKRs = krs.length;
  const completedKRs = krs.filter(
    (kr) => kr.final_score && kr.final_score.gte(100),
  ).length;

  return {
    entityId,
    level,
    totalKRs,
    completedKRs,
    mandatoryKRs: mandatoryKRs.length,
    mandatoryCompleted: mandatoryKRs.filter(
      (kr) => kr.final_score && kr.final_score.gte(100),
    ).length,
    allMandatoryDone,
    completionRate: totalKRs > 0 ? (completedKRs / totalKRs) * 100 : 0,
    isBlocked: mandatoryKRs.length > 0 && !allMandatoryDone,
  };
}

/**
 * Financial breakdown: separate financial vs non-financial KRs.
 */
export async function getFinancialBreakdown(
  companyId: number,
  cycleId: number,
) {
  const companyKRs = await prisma.companyKeyResult.findMany({
    where: {
      company_id: companyId,
      objective: { cycle_id: cycleId },
    },
    include: { metricDefinition: true, objective: { select: { title: true } } },
  });

  const financial = companyKRs.filter(
    (kr) => kr.metricDefinition!.is_financial,
  );
  const nonFinancial = companyKRs.filter(
    (kr) => !kr.metricDefinition!.is_financial,
  );

  const financialTotal = financial.reduce(
    (sum, kr) => sum.add(kr.final_value ?? new Decimal(0)),
    new Decimal(0),
  );
  const financialAvgScore =
    financial.length > 0
      ? financial
          .reduce(
            (sum, kr) => sum.add(kr.final_score ?? new Decimal(0)),
            new Decimal(0),
          )
          .div(financial.length)
      : new Decimal(0);

  return {
    financial: {
      count: financial.length,
      totalValue: financialTotal,
      avgScore: financialAvgScore,
      items: financial.map((kr) => ({
        id: kr.id,
        title: kr.title,
        objectiveTitle: kr.objective.title,
        score: kr.final_score,
        value: kr.final_value,
        unit: kr.unit_of_measure,
        target: kr.target_value,
      })),
    },
    nonFinancial: {
      count: nonFinancial.length,
      items: nonFinancial.map((kr) => ({
        id: kr.id,
        title: kr.title,
        objectiveTitle: kr.objective.title,
        score: kr.final_score,
        value: kr.final_value,
      })),
    },
  };
}

/**
 * RECURSIVE BOTTOM-UP ROLLUP ENGINE
 * Daily → Weekly → Monthly → Quarterly KR → Objective → Company KR → Company Objective.
 *
 * For the lower three levels (daily/weekly/monthly) we use the spec's simple
 * weighted aggregation:
 *   progress_pct = SUM(child.progress_pct * child.weight_pct) / SUM(child.weight_pct)
 *   current_value = start_value + (target_value - start_value) * (progress_pct/100)
 * Only children with contribute_to_score = TRUE participate in score aggregation.
 * For value aggregation we additionally require contribute_to_value = TRUE on
 * the entity itself.
 *
 * For employee_key_result and above we delegate to the metric-aware rollups
 * already implemented further up in this file.
 */

type RollupNodeType =
  | "daily_plan"
  | "weekly_plan"
  | "monthly_plan"
  | "employee_key_result"
  | "employee_objective"
  | "company_key_result"
  | "company_objective";

function decOrZero(v: any): Decimal {
  if (v === null || v === undefined) return new Decimal(0);
  return new Decimal(v);
}

async function rollupWeeklyPlanFromDailies(
  weeklyPlanId: number,
  tx: any = prisma,
) {
  const weekly = await tx.weeklyPlan.findUnique({
    where: { id: weeklyPlanId },
  });
  if (!weekly) return;

  const dailies = await tx.dailyPlan.findMany({
    where: { weekly_plan_id: weeklyPlanId, contribute_to_score: true },
    select: { progress_pct: true },
  });

  let progress: Decimal;
  if (dailies.length === 0) {
    progress = new Decimal(0);
  } else {
    // Daily plans are atomic units → equal weight (=1) per spec.
    const total = dailies.reduce(
      (sum: Decimal, d: any) => sum.add(decOrZero(d.progress_pct)),
      new Decimal(0),
    );
    progress = total.div(dailies.length);
  }
  progress = clampPercent(progress);

  const start = decOrZero(weekly.start_value);
  const target = decOrZero(weekly.target_value);
  const current = weekly.contribute_to_value
    ? start.add(target.sub(start).mul(progress).div(100))
    : decOrZero(weekly.current_value);

  await tx.weeklyPlan.update({
    where: { id: weeklyPlanId },
    data: { progress_pct: progress, current_value: current },
  });
}

async function rollupMonthlyPlanFromWeeklies(
  monthlyPlanId: number,
  tx: any = prisma,
) {
  const monthly = await tx.employeeMonthPlan.findUnique({
    where: { id: monthlyPlanId },
  });
  if (!monthly) return;

  const weeklies = await tx.weeklyPlan.findMany({
    where: {
      employee_month_plan_id: monthlyPlanId,
      contribute_to_score: true,
    },
    select: { progress_pct: true, weight_pct: true },
  });

  let progress: Decimal;
  if (weeklies.length === 0) {
    progress = new Decimal(0);
  } else {
    let weightedSum = new Decimal(0);
    let weightTotal = new Decimal(0);
    for (const w of weeklies) {
      const wt = decOrZero(w.weight_pct);
      const pp = decOrZero(w.progress_pct);
      weightedSum = weightedSum.add(pp.mul(wt));
      weightTotal = weightTotal.add(wt);
    }
    progress = weightTotal.gt(0)
      ? weightedSum.div(weightTotal)
      : new Decimal(0);
  }
  progress = clampPercent(progress);

  const start = decOrZero(monthly.start_value);
  const target = decOrZero(monthly.target_value);
  const current = monthly.contribute_to_value
    ? start.add(target.sub(start).mul(progress).div(100))
    : decOrZero(monthly.current_value);

  await tx.employeeMonthPlan.update({
    where: { id: monthlyPlanId },
    data: { progress_pct: progress, current_value: current },
  });
}

export async function recalculateRollUp(
  nodeType: RollupNodeType,
  nodeId: number,
  tx: any = prisma,
): Promise<void> {
  switch (nodeType) {
    case "daily_plan": {
      const daily = await tx.dailyPlan.findUnique({
        where: { id: nodeId },
        select: { weekly_plan_id: true },
      });
      if (daily?.weekly_plan_id) {
        return recalculateRollUp("weekly_plan", daily.weekly_plan_id, tx);
      }
      return;
    }

    case "weekly_plan": {
      await rollupWeeklyPlanFromDailies(nodeId, tx);
      const weekly = await tx.weeklyPlan.findUnique({
        where: { id: nodeId },
        select: { employee_month_plan_id: true },
      });
      if (weekly?.employee_month_plan_id) {
        return recalculateRollUp(
          "monthly_plan",
          weekly.employee_month_plan_id,
          tx,
        );
      }
      return;
    }

    case "monthly_plan": {
      await rollupMonthlyPlanFromWeeklies(nodeId, tx);
      const monthly = await tx.employeeMonthPlan.findUnique({
        where: { id: nodeId },
        select: { employee_kr_id: true },
      });
      if (monthly?.employee_kr_id) {
        return recalculateRollUp(
          "employee_key_result",
          monthly.employee_kr_id,
          tx,
        );
      }
      return;
    }

    case "employee_key_result": {
      // Use rollupEmployeeKR which handles both contributor-aggregated KRs
      // (parent KRs with employee contributors) and own-plan KRs (fallback to
      // computeEmployeeKRScore). skipUpward=true so we control the upward
      // propagation ourselves via recalculateRollUp below.
      await rollupEmployeeKR(nodeId, tx, true);
      const kr = await tx.employeeKeyResult.findUnique({
        where: { id: nodeId },
        select: { employee_objective_id: true },
      });
      if (!kr) return;

      if (kr.employee_objective_id) {
        await rollupEmployeeObjective(kr.employee_objective_id, tx, true);
        return recalculateRollUp(
          "employee_objective",
          kr.employee_objective_id,
          tx,
        );
      }
      return;
    }

    case "employee_objective": {
      // First compute the employee objective score from its KRs
      await rollupEmployeeObjective(nodeId, tx, true);

      const obj = await tx.employeeObjective.findUnique({
        where: { id: nodeId },
        select: {
          chosen_parent_kr_id: true,
          chosen_parent_employee_kr_id: true,
        },
      });
      if (obj?.chosen_parent_kr_id) {
        return recalculateRollUp(
          "company_key_result",
          obj.chosen_parent_kr_id,
          tx,
        );
      } else if (obj?.chosen_parent_employee_kr_id) {
        return recalculateRollUp(
          "employee_key_result",
          obj.chosen_parent_employee_kr_id,
          tx,
        );
      }
      return;
    }

    case "company_key_result": {
      const kr = await tx.companyKeyResult.findUnique({
        where: { id: nodeId },
        select: { objective_id: true },
      });
      if (kr?.objective_id) {
        await rollupCompanyKR(nodeId, tx);
        return recalculateRollUp("company_objective", kr.objective_id, tx);
      }
      return;
    }

    case "company_objective": {
      await rollupCompanyObjective(nodeId, tx);
      return;
    }

    default:
      console.warn(`[RollupEngine] Unknown node type: ${nodeType}`);
  }
}
