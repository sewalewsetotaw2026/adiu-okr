import { prisma } from "src/app";
import { Decimal } from "@prisma/client/runtime/library";
import {
  resolveConfigValue,
  getPlanningCadence,
} from "src/services/okrConfigResolverService";

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

function getRollupValue(node: any): Decimal {
  const currentValue = toDecimal(node?.current_value);
  if (currentValue) return currentValue;
  return new Decimal(0);
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

  const config = await resolveConfigValue({
    companyId,
    configKey: "confidence_level_mapping",
  });

  const mapping: any = config || {
    off_track_lte_percent: 50,
    on_track_gte_percent: 60,
    at_risk_lte_percent: 40,
  };

  const s = score.toNumber();

  if (s >= mapping.on_track_gte_percent) return "ON_TRACK";
  if (s <= mapping.at_risk_lte_percent) return "AT_RISK";
  if (s <= mapping.off_track_lte_percent) return "OFF_TRACK";

  // Default fallback if between At risk and On track boundaries
  return "OFF_TRACK";
}

function computeNodeScoreValue(node: any, metric: any) {
  const finalScore = toDecimal(node?.final_score);
  const progressPercent = toDecimal(node?.progress_percent);
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

  let value: Decimal | null = currentValue;
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
      monthPlanItems: {
        include: {
          monthPlan: { include: { items: true } },
        },
        orderBy: { id: "asc" },
      },
      weeklyPlans: {
        include: {
          metricDefinition: true,
          tasks: {
            include: {
              dailyPlans: { include: { metricDefinition: true } },
              metricDefinition: true,
            },
          },
        },
        orderBy: { week_number: "asc" },
      },
      subtasks: {
        include: { metricDefinition: true },
        orderBy: { sequence_order: "asc" },
      },
      employeeObjective: {
        select: { id: true, company_id: true, cycle_id: true },
      },
    },
  });
  if (!kr) throw new Error("Employee KR not found.");

  const metric = kr.metricDefinition;
  if (!metric) throw new Error("Metric definition not found for KR.");

  const activeCadence = await getPlanningCadence(
    kr.company_id,
    kr.employeeObjective.cycle_id,
  );

  const latestProgress = kr.progressUpdates[0];

  let score: Decimal | null = null;
  let value: Decimal | null = null;
  let indirectScore: Decimal | null = null;
  let indirectValue: Decimal | null = null;

  // 1) Weekly score/value from milestones where available
  console.log("hello");
  const weeklyAggregates: any[] = [];
  for (const week of kr.weeklyPlans ?? []) {
    const base = computeNodeScoreValue(week, week.metricDefinition ?? metric);

    const directTasksScores: Decimal[] = [];
    const directTasksValues: Decimal[] = [];

    for (const task of week.tasks ?? []) {
      const results = computeNodeScoreValue(
        task,
        task.metricDefinition ?? week.metricDefinition ?? metric,
      );

      const directDailyScores: Decimal[] = [];
      const directDailyValues: Decimal[] = [];

      for (const dailyPlan of task.dailyPlans ?? []) {
        const m = computeNodeScoreValue(
          dailyPlan,
          dailyPlan.metricDefinition ??
            task.metricDefinition ??
            week.metricDefinition ??
            metric,
        );

        if (
          dailyPlan.contributes_to_parent_score !== false &&
          hasDecimal(m.score)
        ) {
          directDailyScores.push(m.score);
        }
        if (
          dailyPlan.contributes_to_parent_value !== false &&
          hasDecimal(m.value)
        ) {
          directDailyValues.push(m.value);
        }
      }

      // Task score is either its direct value or avg of dailies
      const taskScore =
        directDailyScores.length > 0
          ? avgDecimals(directDailyScores)
          : results.score;
      const taskValue =
        directDailyValues.length > 0
          ? directDailyValues.reduce((s, v) => s.add(v), new Decimal(0))
          : results.value;

      if (task.contributes_to_parent_score !== false && hasDecimal(taskScore)) {
        directTasksScores.push(taskScore);
      }
      if (task.contributes_to_parent_value !== false && hasDecimal(taskValue)) {
        directTasksValues.push(taskValue);
      }

      // NEW: Persist task value back to DB
      await tx.weeklyTask.update({
        where: { id: task.id },
        data: {
          current_value: taskValue,
          final_score: taskScore,
        },
      });
    }

    const totalTarget = (week.tasks || []).reduce(
      (sum: Decimal, t: any) =>
        sum.add(toDecimal(t.target_value) ?? new Decimal(0)),
      new Decimal(0),
    );

    weeklyAggregates.push({
      ...week,
      aggregateScore:
        directTasksScores.length > 0
          ? avgDecimals(directTasksScores)
          : base.score,
      aggregateValue:
        directTasksValues.length > 0
          ? directTasksValues.reduce(
              (sum: Decimal, v: Decimal) => sum.add(v),
              new Decimal(0),
            )
          : base.value,
      aggregateTarget: totalTarget.gt(0)
        ? totalTarget
        : toDecimal(week.target_value),
    });
  }

  // NEW: Persist weekly aggregates back to the WeeklyPlan records so the UI stays in sync
  for (const week of weeklyAggregates) {
    const weekScore = week.aggregateScore ?? new Decimal(0);
    const weekValue = week.aggregateValue;

    await tx.weeklyPlan.update({
      where: { id: week.id },
      data: {
        final_score: weekScore,
        current_value: weekValue,
        target_value: week.aggregateTarget,
        status_code: weekScore.gte(100)
          ? "completed"
          : weekScore.gt(0)
            ? "active"
            : week.status_code,
      },
    });
  }

  // 2) Monthly score/value from weekly (if linked) or own monthly measurement
  const monthlyAggregates = kr.monthPlanItems.map((item: any) => {
    const month = item.monthPlan;
    // For the KR score calculation, we use the item's target/current value
    const base = computeNodeScoreValue(item, metric);
    const linkedWeeks = weeklyAggregates.filter((w: any) => {
      // 1. If the week is explicitly linked to a specific monthly task, check for a match.
      if (w.employee_month_plan_item_id) {
        return w.employee_month_plan_item_id === item.id;
      }
      // 2. Fallback: If no item link, attribute to the month plan in general.
      // To avoid progress duplication across multiple tasks, we only attribute unlinked weeks
      // to the first task found for this KR in the monthly plan.
      if (w.employee_month_plan_id === month.id) {
        const firstItemForKr = month.items.find(
          (i: any) => i.employee_kr_id === item.employee_kr_id,
        );
        return firstItemForKr?.id === item.id;
      }
      return false;
    });

    const weekScores = linkedWeeks
      .filter(
        (w: any) =>
          w.contributes_to_parent_score !== false &&
          hasDecimal(w.aggregateScore),
      )
      .map((w: any) => w.aggregateScore as Decimal);

    const weekValues = linkedWeeks
      .filter(
        (w: any) =>
          w.contributes_to_parent_value !== false &&
          hasDecimal(w.aggregateValue),
      )
      .map((w: any) => w.aggregateValue as Decimal);

    const weekIndirectScores = [
      ...linkedWeeks
        .filter(
          (w: any) =>
            w.contributes_to_parent_score === false &&
            hasDecimal(w.aggregateScore),
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
            w.contributes_to_parent_value === false &&
            hasDecimal(w.aggregateValue),
        )
        .map((w: any) => w.aggregateValue as Decimal),
      ...linkedWeeks
        .filter((w: any) => hasDecimal(w.indirectValue))
        .map((w: any) => w.indirectValue as Decimal),
    ];

    return {
      ...item,
      monthPlanId: month.id,
      aggregateScore:
        linkedWeeks.length > 0
          ? weightedAvgOrSimpleAvg(
              linkedWeeks.map((w: any) => ({
                score:
                  w.contributes_to_parent_score !== false
                    ? w.aggregateScore
                    : null,
                weight: w.weight_percent ? toDecimal(w.weight_percent) : null,
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
      (m: any) =>
        m.contributes_to_parent_score !== false && hasDecimal(m.aggregateScore),
    )
    .map((m: any) => m.aggregateScore as Decimal);
  const monthValueCandidates = monthlyAggregates
    .filter(
      (m: any) =>
        m.contributes_to_parent_value !== false && hasDecimal(m.aggregateValue),
    )
    .map((m: any) => m.aggregateValue as Decimal);

  const monthIndirectScoreCandidates = [
    ...monthlyAggregates
      .filter(
        (m: any) =>
          m.contributes_to_parent_score === false &&
          hasDecimal(m.aggregateScore),
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
          m.contributes_to_parent_value === false &&
          hasDecimal(m.aggregateValue),
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
              score:
                m.contributes_to_parent_score !== false
                  ? m.aggregateScore
                  : null,
              weight: m.weight_percent ? toDecimal(m.weight_percent) : null,
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
        (w: any) =>
          w.contributes_to_parent_score !== false &&
          hasDecimal(w.aggregateScore),
      )
      .map((w: any) => w.aggregateScore as Decimal);
    const weekValueCandidates = weeklyAggregates
      .filter(
        (w: any) =>
          w.contributes_to_parent_value !== false &&
          hasDecimal(w.aggregateValue),
      )
      .map((w: any) => w.aggregateValue as Decimal);

    const weekIndirectScoreCandidates = [
      ...weeklyAggregates
        .filter(
          (w: any) =>
            w.contributes_to_parent_score === false &&
            hasDecimal(w.aggregateScore),
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
            w.contributes_to_parent_value === false &&
            hasDecimal(w.aggregateValue),
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
                score:
                  w.contributes_to_parent_score !== false
                    ? w.aggregateScore
                    : null,
                weight: w.weight_percent ? toDecimal(w.weight_percent) : null,
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
            x.task.contributes_to_parent_score !== false &&
            hasDecimal(x.result.score),
        )
        .map((x: any) => x.result.score as Decimal);

      const subtaskValueCandidates = subtaskResults
        .filter(
          (x: any) =>
            x.task.contributes_to_parent_value !== false &&
            hasDecimal(x.result.value),
        )
        .map((x: any) => x.result.value as Decimal);

      const subtaskIndirectScoreCandidates = subtaskResults
        .filter(
          (x: any) =>
            x.task.contributes_to_parent_score === false &&
            hasDecimal(x.result.score),
        )
        .map((x: any) => x.result.score as Decimal);

      const subtaskIndirectValueCandidates = subtaskResults
        .filter(
          (x: any) =>
            x.task.contributes_to_parent_value === false &&
            hasDecimal(x.result.value),
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
                  score:
                    x.task.contributes_to_parent_score !== false
                      ? x.result.score
                      : null,
                  weight: x.task.weight_percent
                    ? toDecimal(x.task.weight_percent)
                    : null,
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
      current_value: value,
      indirect_score: indirectScore,
      indirect_value: indirectValue,
    },
  });

  // 6) Update month plan items
  for (const item of monthlyAggregates) {
    // Update the item's current value based on weekly/monthly aggregates
    await tx.employeeMonthPlanItem.update({
      where: { id: item.id },
      data: { current_value: item.aggregateValue },
    });
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
        final_score: week.aggregateScore,
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
  deep: boolean = false,
) {
  const result = await _rollupEmployeeObjectiveInternal(objectiveId, tx, deep);

  if (!skipUpward) {
    const obj = await tx.employeeObjective.findUnique({
      where: { id: objectiveId },
      select: { chosen_parent_kr_id: true, chosen_parent_employee_kr_id: true },
    });
    if (obj?.chosen_parent_kr_id) {
      await rollupCompanyKR(obj.chosen_parent_kr_id, tx, skipUpward);
    } else if (obj?.chosen_parent_employee_kr_id) {
      await rollupEmployeeKR(obj.chosen_parent_employee_kr_id, tx, skipUpward);
    }
  }
  return result;
}

async function _rollupEmployeeObjectiveInternal(
  objectiveId: number,
  tx: any = prisma,
  deep: boolean = false,
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
      parentCompanyKr: {
        include: { metricDefinition: true },
      },
      parentEmployeeKr: {
        include: { metricDefinition: true },
      },
    },
  });
  if (!objective) throw new Error("Employee objective not found.");

  const isParentFinancial =
    objective.parentCompanyKr?.metricDefinition?.is_financial === true ||
    objective.parentEmployeeKr?.metricDefinition?.is_financial === true;

  // First, recompute each KR's score if deep rollup is requested
  if (deep) {
    for (const kr of objective.keyResults) {
      await rollupEmployeeKR(kr.id, tx, true, true);
    }
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
  let totalTarget = new Decimal(0);
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
          totalValue = totalValue.add(getRollupValue(kr));
        }
      } else {
        totalValue = totalValue.add(getRollupValue(kr));
      }

      totalTarget = totalTarget.add(
        toDecimal(kr.target_value) ?? new Decimal(0),
      );
    }

    if (
      kr.contributes_to_objective_score === false &&
      hasDecimal(kr.final_score)
    ) {
      indirectScoreCandidates.push(kr.final_score);
    }

    if (hasDecimal((kr as any).indirect_score)) {
      indirectScoreCandidates.push((kr as any).indirect_score as Decimal);
    }

    if (kr.metricDefinition?.supports_value_rollup) {
      const shouldIncludeValue =
        !isParentFinancial || kr.metricDefinition.is_financial;

      if (shouldIncludeValue) {
        if (
          kr.contributes_to_objective_value === false &&
          hasDecimal(toDecimal(kr.current_value))
        ) {
          indirectValue = indirectValue.add(getRollupValue(kr));
        }

        if (hasDecimal((kr as any).indirect_value)) {
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

  const finalScore = totalWeight.gt(0)
    ? weightedScoreSum.div(totalWeight)
    : new Decimal(0);
  const indirectScore =
    indirectScoreCandidates.length > 0
      ? avgDecimals(indirectScoreCandidates)
      : new Decimal(0);

  const existingTarget = toDecimal(objective.target_value) ?? new Decimal(0);
  const progressPercent = existingTarget.gt(0)
    ? totalValue.div(existingTarget).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await tx.employeeObjective.update({
    where: { id: objectiveId },
    data: {
      final_score: finalScore,
      current_value: totalValue,
      progress_percent: progressPercent,
      indirect_score: indirectScore,
      indirect_value: indirectValue,
    },
  });

  // Re-roll up Month Plans for this objective AFTER KRs are updated.
  // IMPORTANT: When a manager KR has contributors, computeEmployeeKRScore is bypassed,
  // so EmployeeMonthPlanItem.current_value is never updated via that path.
  // We must refresh each item here from the KR's (freshly rolled-up) current_value
  // before aggregating the month plan — otherwise the plan total stays stale.
  const monthPlans = await tx.employeeMonthPlan.findMany({
    where: { employee_objective_id: objectiveId },
    include: { items: true },
  });

  for (const plan of monthPlans) {
    // Refresh each item's current_value from the KR's updated current_value.
    // Group items by KR to see if we need proportional redistribution.
    const itemsByKr: Record<number, any[]> = {};
    for (const item of plan.items) {
      if (!itemsByKr[item.employee_kr_id]) itemsByKr[item.employee_kr_id] = [];
      itemsByKr[item.employee_kr_id].push(item);
    }

    for (const [krIdStr, items] of Object.entries(itemsByKr)) {
      const krId = parseInt(krIdStr);
      const kr = updatedKRs.find((k: any) => k.id === krId);
      if (!kr) continue;

      const krCurrent = toDecimal(kr.current_value) ?? new Decimal(0);
      const krTarget = toDecimal(kr.target_value) ?? new Decimal(0);

      // Check if existing items already sum up to the KR current value.
      const currentSum = items.reduce(
        (sum, i) => sum.add(toDecimal(i.current_value) ?? new Decimal(0)),
        new Decimal(0),
      );

      // If they match (or there's only one item), we don't need to redistribute.
      // This preserves granular progress tracking from weekly tasks.
      if (currentSum.eq(krCurrent)) {
        continue;
      }

      // Otherwise, distribute proportionally across items that share the same KR.
      for (const item of items) {
        const itemTarget = toDecimal(item.target_value) ?? new Decimal(0);
        const itemCurrent =
          krTarget.gt(0) && itemTarget.gt(0)
            ? krCurrent.mul(itemTarget).div(krTarget).toDecimalPlaces(2)
            : krCurrent;

        await tx.employeeMonthPlanItem.update({
          where: { id: item.id },
          data: { current_value: itemCurrent },
        });
        // Mutate local reference so the aggregations below see the fresh value.
        (item as any).current_value = itemCurrent;
      }
    }

    const itemScores = plan.items.map((i: any) => {
      if (i.target_value && new Decimal(i.target_value).gt(0)) {
        const current = i.current_value
          ? new Decimal(i.current_value)
          : new Decimal(0);
        const target = new Decimal(i.target_value);
        return clampPercent(current.div(target).mul(100));
      }
      return new Decimal(0);
    });

    const planScore = avgDecimals(itemScores);
    const planValue = plan.items.reduce(
      (sum: Decimal, i: any) => sum.add(new Decimal(i.current_value || 0)),
      new Decimal(0),
    );
    const planTarget = plan.items.reduce(
      (sum: Decimal, i: any) => sum.add(new Decimal(i.target_value || 0)),
      new Decimal(0),
    );
    const planProgress = planTarget.gt(0)
      ? planValue.div(planTarget).mul(100).toDecimalPlaces(2)
      : new Decimal(0);

    await tx.employeeMonthPlan.update({
      where: { id: plan.id },
      data: {
        final_score: planScore,
        current_value: planValue,
        progress_percent: planProgress,
      },
    });
  }

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
  deep: boolean = false,
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

  // Roll up each contributor's employee objectives first if deep rollup is requested
  if (deep) {
    for (const contributor of empKr.contributors) {
      for (const empObj of contributor.employeeObjectives) {
        // Avoid recursive bounce-back into this parent KR while precomputing contributors.
        await rollupEmployeeObjective(empObj.id, tx, true, true);
      }
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
              current_value: true,
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
    for (const empObj of contributor.employeeObjectives) {
      if (empObj.final_score) allScores.push(empObj.final_score);
      totalValue = totalValue.add(getRollupValue(empObj));
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
      current_value: totalValue,
      indirect_score: avgIndirectScore,
      indirect_value: indirectValue,
    },
  });

  // NEW: Granular weekly/monthly rollup from contributors if alignment exists.
  // This ensures subordinate progress hits the CORRECT manager task instead of being divided.
  if (allScores.length > 0) {
    const managerWeeklyPlans = await tx.weeklyPlan.findMany({
      where: { employee_kr_id: employeeKrId },
      include: { tasks: true },
    });

    const contributorObjectiveIds = refreshed!.contributors.flatMap((c: any) =>
      c.employeeObjectives.map((o: any) => o.id),
    );

    for (const managerPlan of managerWeeklyPlans) {
      for (const managerTask of managerPlan.tasks) {
        // Find subordinate weekly plans aligned to this manager task.
        const alignedSubWeeks = await tx.weeklyPlan.findMany({
          where: {
            parent_weekly_task_id: managerTask.id,
            employeeKr: {
              employee_objective_id: { in: contributorObjectiveIds },
            },
            status_code: { in: ["approved", "published"] },
          },
          select: { current_value: true },
        });

        if (alignedSubWeeks.length > 0) {
          const subValueSum = alignedSubWeeks.reduce(
            (sum: Decimal, w: any) =>
              sum.add(toDecimal(w.current_value) ?? new Decimal(0)),
            new Decimal(0),
          );

          // Manager's task current_value = (Manager's own DailyPlans) + (Subordinates' WeeklyPlans)
          const managerOwnDailies = await tx.dailyPlan.findMany({
            where: { weekly_task_id: managerTask.id },
            select: { current_value: true },
          });
          const managerOwnValue = managerOwnDailies.reduce(
            (sum: Decimal, d: any) =>
              sum.add(toDecimal(d.current_value) ?? new Decimal(0)),
            new Decimal(0),
          );

          console.log("own value manager")
          console.log("the sub value", subValueSum);
          const newTaskValue = subValueSum;

          await tx.weeklyTask.update({
            where: { id: managerTask.id },
            data: { current_value: newTaskValue },
          });

          // Cascade up to Monthly Plan Item and Month Plan
          await syncCurrentValueCascadeFromWeeklyTask(managerTask.id, tx);
        }
      }
    }

    // NEW: Also check for Monthly Plan Item alignments directly.
    // This handles cases where there might not be a weekly link, but there is a monthly one.
    const managerMonthItems = await tx.employeeMonthPlanItem.findMany({
      where: { employee_kr_id: employeeKrId },
    });

    for (const mItem of managerMonthItems) {
      // 1. Manager's own work (linked manager weeks)
      const managerWeeks = await tx.weeklyPlan.findMany({
        where: { employee_month_plan_item_id: mItem.id },
        select: { current_value: true },
      });
      const ownValue = managerWeeks.reduce(
        (sum: Decimal, w: any) =>
          sum.add(toDecimal(w.current_value) ?? new Decimal(0)),
        new Decimal(0),
      );

      // 2. Subordinate's work (aligned subordinate month items)
      const alignedSubItems = await tx.employeeMonthPlanItem.findMany({
        where: { parent_employee_month_plan_item_id: mItem.id },
        select: { current_value: true },
      });
      const subItemSum = alignedSubItems.reduce(
        (sum: Decimal, i: any) =>
          sum.add(toDecimal(i.current_value) ?? new Decimal(0)),
        new Decimal(0),
      );

      const finalItemValue = subItemSum.gt(0) ? subItemSum : ownValue;

      await tx.employeeMonthPlanItem.update({
        where: { id: mItem.id },
        data: { current_value: finalItemValue },
      });

      // Trigger a refresh of the monthly plan total
      await tx.employeeMonthPlan.update({
        where: { id: mItem.employee_month_plan_id },
        data: { updated_at: new Date() },
      });
    }
  }

  const kr = await tx.employeeKeyResult.findUnique({
    where: { id: employeeKrId },
    select: { employee_objective_id: true },
  });
  if (kr?.employee_objective_id && !skipUpward) {
    await rollupEmployeeObjective(kr.employee_objective_id, tx, false, deep);
  }

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
 */
export async function rollupDepartmentKR(
  departmentKrId: number,
  tx: any = prisma,
) {
  const deptKr = await tx.departmentKeyResult.findUnique({
    where: { id: departmentKrId },
    include: {
      contributors: {
        include: {
          employeeObjectives: {
            select: {
              id: true,
              final_score: true,
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
    for (const empObj of contributor.employeeObjectives) {
      // Avoid recursive bounce-back into this parent KR while precomputing contributors.
      await rollupEmployeeObjective(empObj.id, tx, true);
    }
  }

  // Re-fetch after rollup
  const refreshed = await tx.departmentKeyResult.findUnique({
    where: { id: departmentKrId },
    include: {
      contributors: {
        where: { status_code: "active" },
        include: {
          employeeObjectives: {
            select: {
              final_score: true,
              current_value: true,
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
    for (const empObj of contributor.employeeObjectives) {
      if (empObj.final_score) allScores.push(empObj.final_score);
      totalValue = totalValue.add(getRollupValue(empObj));
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

  // Fallback to department monthly/weekly measurable plans when no contributor objectives exist
  if (allScores.length === 0 && totalValue.eq(0)) {
    const planBased = await tx.departmentKeyResult.findUnique({
      where: { id: departmentKrId },
      include: {
        monthPlans: { include: { metricDefinition: true } },
        weeklyPlans: {
          include: {
            metricDefinition: true,
            dailyPlans: {
              include: { metricDefinition: true },
            },
          },
        },
        metricDefinition: true,
      },
    });

    if (planBased) {
      const weeklyAggregates = planBased.weeklyPlans.map((week: any) => {
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

          if (
            dailyPlan.contributes_to_parent_score !== false &&
            hasDecimal(d.score)
          ) {
            directDailyScores.push(d.score);
          }
          if (
            dailyPlan.contributes_to_parent_score === false &&
            hasDecimal(d.score)
          ) {
            indirectDailyScores.push(d.score);
          }

          if (
            dailyPlan.contributes_to_parent_value !== false &&
            hasDecimal(d.value)
          ) {
            directDailyValues.push(d.value);
          }
          if (
            dailyPlan.contributes_to_parent_value === false &&
            hasDecimal(d.value)
          ) {
            indirectDailyValues.push(d.value);
          }
        }

        return {
          ...week,
          aggregateScore:
            week.dailyPlans.length > 0
              ? weightedAvgOrSimpleAvg(
                  week.dailyPlans.map((d: any) => {
                    const results = computeNodeScoreValue(
                      d,
                      d.metricDefinition ??
                        week.metricDefinition ??
                        planBased.metricDefinition,
                    );
                    return {
                      score:
                        d.contributes_to_parent_score !== false
                          ? results.score
                          : null,
                      weight: d.weight_percent
                        ? toDecimal(d.weight_percent)
                        : null,
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
      });

      const monthScores = planBased.monthPlans
        .filter((m: any) => m.contributes_to_parent_score !== false)
        .map(
          (m: any) =>
            computeNodeScoreValue(
              m,
              m.metricDefinition ?? planBased.metricDefinition,
            ).score,
        )
        .filter((s: any) => Boolean(s)) as Decimal[];

      const monthValueItems = planBased.monthPlans
        .filter((m: any) => m.contributes_to_parent_value !== false)
        .map(
          (m: any) =>
            computeNodeScoreValue(
              m,
              m.metricDefinition ?? planBased.metricDefinition,
            ).value,
        )
        .filter((v: any) => Boolean(v)) as Decimal[];

      const monthIndirectScores = planBased.monthPlans
        .filter((m: any) => m.contributes_to_parent_score === false)
        .map(
          (m: any) =>
            computeNodeScoreValue(
              m,
              m.metricDefinition ?? planBased.metricDefinition,
            ).score,
        )
        .filter((s: any) => Boolean(s)) as Decimal[];

      const monthIndirectValues = planBased.monthPlans
        .filter((m: any) => m.contributes_to_parent_value === false)
        .map(
          (m: any) =>
            computeNodeScoreValue(
              m,
              m.metricDefinition ?? planBased.metricDefinition,
            ).value,
        )
        .filter((v: any) => Boolean(v)) as Decimal[];

      const hasMonthAggregateData =
        monthScores.length > 0 ||
        monthValueItems.length > 0 ||
        monthIndirectScores.length > 0 ||
        monthIndirectValues.length > 0;

      if (hasMonthAggregateData) {
        const computedScore =
          monthScores.length > 0
            ? weightedAvgOrSimpleAvg(
                planBased.monthPlans.map((m: any) => ({
                  score:
                    m.contributes_to_parent_score !== false
                      ? computeNodeScoreValue(
                          m,
                          m.metricDefinition ?? planBased.metricDefinition,
                        ).score
                      : null,
                  weight: m.weight_percent ? toDecimal(m.weight_percent) : null,
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
          .filter((w: any) => w.contributes_to_parent_score !== false)
          .map((w: any) => w.aggregateScore)
          .filter((s: any) => Boolean(s)) as Decimal[];
        if (weekScores.length > 0) {
          const computedWeekScore = weightedAvgOrSimpleAvg(
            weeklyAggregates.map((w: any) => ({
              score:
                w.contributes_to_parent_score !== false
                  ? w.aggregateScore
                  : null,
              weight: w.weight_percent ? toDecimal(w.weight_percent) : null,
            })),
          );
          avgScore = computedWeekScore ?? new Decimal(0);
        }

        const weekValues = weeklyAggregates
          .filter((w: any) => w.contributes_to_parent_value !== false)
          .map((w: any) => w.aggregateValue)
          .filter((v: any) => Boolean(v)) as Decimal[];
        totalValue = weekValues.reduce(
          (sum: Decimal, v: Decimal) => sum.add(v),
          new Decimal(0),
        );

        const weekIndirectScores = [
          ...(weeklyAggregates
            .filter((w: any) => w.contributes_to_parent_score === false)
            .map((w: any) => w.aggregateScore)
            .filter((s: any) => Boolean(s)) as Decimal[]),
          ...(weeklyAggregates
            .map((w: any) => w.indirectScore)
            .filter((s: any) => Boolean(s)) as Decimal[]),
        ];

        const weekIndirectValues = [
          ...(weeklyAggregates
            .filter((w: any) => w.contributes_to_parent_value === false)
            .map((w: any) => w.aggregateValue)
            .filter((v: any) => Boolean(v)) as Decimal[]),
          ...(weeklyAggregates
            .map((w: any) => w.indirectValue)
            .filter((v: any) => Boolean(v)) as Decimal[]),
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
        for (const month of planBased.monthPlans) {
          const mResults = computeNodeScoreValue(
            month,
            month.metricDefinition ?? planBased.metricDefinition,
          );
          const mConf = await calculateConfidenceLevel(
            planBased.company_id,
            mResults.score,
          );
          await tx.departmentMonthPlan.update({
            where: { id: month.id },
            data: { final_score: mResults.score, confidence_level: mConf },
          });
        }
        for (const week of weeklyAggregates) {
          const wConf = await calculateConfidenceLevel(
            planBased.company_id,
            week.aggregateScore,
          );
          await tx.departmentWeeklyPlan.update({
            where: { id: week.id },
            data: { final_score: week.aggregateScore, confidence_level: wConf },
          });
        }
      }
    }
  }

  await tx.departmentKeyResult.update({
    where: { id: departmentKrId },
    data: {
      final_score: avgScore,
      current_value: totalValue,
      indirect_score: avgIndirectScore,
      indirect_value: indirectValue,
    },
  });

  const kr = await tx.departmentKeyResult.findUnique({
    where: { id: departmentKrId },
    select: { department_objective_id: true },
  });
  if (kr?.department_objective_id) {
    await rollupDepartmentObjective(kr.department_objective_id, tx);
  }

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
 */
export async function rollupDepartmentObjective(
  deptObjectiveId: number,
  tx: any = prisma,
) {
  const objective = await tx.departmentObjective.findUnique({
    where: { id: deptObjectiveId },
    include: {
      keyResults: { include: { metricDefinition: true } },
      companyKr: { include: { metricDefinition: true } },
    },
  });
  if (!objective) throw new Error("Department objective not found.");
  const isParentFinancial =
    objective.companyKr?.metricDefinition?.is_financial === true;

  // Roll up each dept KR first
  for (const kr of objective.keyResults) {
    await rollupDepartmentKR(kr.id, tx);
  }

  // Re-fetch
  const updatedKRs = await tx.departmentKeyResult.findMany({
    where: { department_objective_id: deptObjectiveId },
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
          totalValue = totalValue.add(getRollupValue(kr));
        }
      } else {
        totalValue = totalValue.add(getRollupValue(kr));
      }
    }

    if (
      kr.contributes_to_objective_score === false &&
      hasDecimal(kr.final_score)
    ) {
      indirectScoreCandidates.push(kr.final_score);
    }

    if (hasDecimal((kr as any).indirect_score)) {
      indirectScoreCandidates.push((kr as any).indirect_score as Decimal);
    }

    if (kr.metricDefinition?.supports_value_rollup) {
      const shouldIncludeValue =
        !isParentFinancial || kr.metricDefinition.is_financial;

      if (shouldIncludeValue) {
        if (
          kr.contributes_to_objective_value === false &&
          hasDecimal(toDecimal(kr.current_value))
        ) {
          indirectValue = indirectValue.add(getRollupValue(kr));
        }

        if (hasDecimal((kr as any).indirect_value)) {
          indirectValue = indirectValue.add(
            (kr as any).indirect_value as Decimal,
          );
        }
      }
    }
  }

  const finalScore = totalWeight.gt(0)
    ? weightedScoreSum.div(totalWeight)
    : new Decimal(0);
  const indirectScore =
    indirectScoreCandidates.length > 0
      ? avgDecimals(indirectScoreCandidates)
      : new Decimal(0);

  await tx.departmentObjective.update({
    where: { id: deptObjectiveId },
    data: {
      final_score: finalScore,
      current_value: totalValue,
      indirect_score: indirectScore,
      indirect_value: indirectValue,
    },
  });

  const obj = await tx.departmentObjective.findUnique({
    where: { id: deptObjectiveId },
    select: { company_kr_id: true },
  });
  if (obj?.company_kr_id) {
    await rollupCompanyKR(obj.company_kr_id, tx);
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
 */
export async function rollupCompanyKR(
  companyKrId: number,
  tx: any = prisma,
  skipUpward: boolean = false,
  deep: boolean = false,
) {
  const companyKr = await tx.companyKeyResult.findUnique({
    where: { id: companyKrId },
    include: {
      employeeObjectives: { select: { id: true } },
    },
  });
  if (!companyKr) throw new Error("Company KR not found.");

  // Roll up each linked employee objective first if deep rollup is requested
  if (deep) {
    for (const empObj of companyKr.employeeObjectives) {
      await rollupEmployeeObjective(empObj.id, tx, true, true);
    }
  }

  // Re-fetch
  const refreshedDeptObjs = await tx.employeeObjective.findMany({
    where: { chosen_parent_kr_id: companyKrId },
    select: {
      final_score: true,
      current_value: true,
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
    (sum: Decimal, o: any) => sum.add(getRollupValue(o)),
    new Decimal(0),
  );
  const totalTarget = refreshedDeptObjs.reduce(
    (sum: Decimal, o: any) =>
      sum.add(toDecimal(o.target_value) ?? new Decimal(0)),
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

  const existingTarget = toDecimal(companyKr.target_value) ?? new Decimal(0);
  const progressPercent = existingTarget.gt(0)
    ? totalValue.div(existingTarget).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await tx.companyKeyResult.update({
    where: { id: companyKrId },
    data: {
      final_score: avgScore,
      current_value: totalValue,
      progress_percent: progressPercent,
      indirect_score: avgIndirectScore,
      indirect_value: totalIndirectValue,
    },
  });

  const kr = await tx.companyKeyResult.findUnique({
    where: { id: companyKrId },
    select: { objective_id: true },
  });
  if (kr?.objective_id && !skipUpward) {
    await rollupCompanyObjective(kr.objective_id, tx, false, deep);
  }

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
  skipUpward: boolean = false,
  deep: boolean = false,
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

  // Roll up each company KR if deep rollup is requested
  if (deep) {
    // Use skipUpward=true to avoid recursive bounce-back into this same objective.
    for (const kr of objective.keyResults) {
      await rollupCompanyKR(kr.id, tx, true, true);
    }
  }

  // Re-fetch
  const updatedKRs = await tx.companyKeyResult.findMany({
    where: { objective_id: companyObjectiveId },
    include: { metricDefinition: true },
  });

  let totalWeight = new Decimal(0);
  let weightedScoreSum = new Decimal(0);
  let totalValue = new Decimal(0);
  let totalTarget = new Decimal(0);
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
      totalValue = totalValue.add(getRollupValue(kr));
      totalTarget = totalTarget.add(
        toDecimal(kr.target_value) ?? new Decimal(0),
      );
    }

    if (
      kr.contributes_to_objective_score === false &&
      hasDecimal(kr.final_score)
    ) {
      indirectScoreCandidates.push(kr.final_score);
    }

    if (hasDecimal((kr as any).indirect_score)) {
      indirectScoreCandidates.push((kr as any).indirect_score as Decimal);
    }

    if (kr.metricDefinition?.supports_value_rollup) {
      if (
        kr.contributes_to_objective_value === false &&
        hasDecimal(toDecimal(kr.current_value))
      ) {
        indirectValue = indirectValue.add(getRollupValue(kr));
      }

      if (hasDecimal((kr as any).indirect_value)) {
        indirectValue = indirectValue.add(
          (kr as any).indirect_value as Decimal,
        );
      }
    }
  }

  const finalScore = totalWeight.gt(0)
    ? weightedScoreSum.div(totalWeight)
    : new Decimal(0);
  const indirectScore =
    indirectScoreCandidates.length > 0
      ? avgDecimals(indirectScoreCandidates)
      : new Decimal(0);

  const existingTarget = toDecimal(objective.target_value) ?? new Decimal(0);
  const progressPercent = existingTarget.gt(0)
    ? totalValue.div(existingTarget).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await tx.companyObjective.update({
    where: { id: companyObjectiveId },
    data: {
      final_score: finalScore,
      current_value: totalValue,
      progress_percent: progressPercent,
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
 * Cascade rollup from a Department KR all the way up to Company Objective.
 */
export async function rollupFromDepartmentKr(
  departmentKrId: number,
  tx: any = prisma,
) {
  const departmentKrResult = await rollupDepartmentKR(departmentKrId, tx);

  const departmentKr = await tx.departmentKeyResult.findUnique({
    where: { id: departmentKrId },
    select: { department_objective_id: true },
  });
  if (!departmentKr) throw new Error("Department KR not found for cascade.");

  const departmentObjectiveResult = await rollupDepartmentObjective(
    departmentKr.department_objective_id,
    tx,
  );

  const departmentObjective = await tx.departmentObjective.findUnique({
    where: { id: departmentKr.department_objective_id },
    select: { company_kr_id: true },
  });
  if (!departmentObjective)
    throw new Error("Department objective not found for cascade.");

  const companyKrResult = await rollupCompanyKR(
    departmentObjective.company_kr_id,
    tx,
  );

  const companyKr = await tx.companyKeyResult.findUnique({
    where: { id: departmentObjective.company_kr_id },
    select: { objective_id: true },
  });
  if (!companyKr) throw new Error("Company KR not found for cascade.");

  const companyObjectiveResult = await rollupCompanyObjective(
    companyKr.objective_id,
    tx,
  );

  return {
    departmentKrId,
    departmentObjectiveId: departmentKr.department_objective_id,
    companyKrId: departmentObjective.company_kr_id,
    companyObjectiveId: companyKr.objective_id,
    departmentKr: departmentKrResult,
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
  deep: boolean = false,
) {
  const employeeObjective = await tx.employeeObjective.findUnique({
    where: { id: employeeObjectiveId },
    select: { chosen_parent_kr_id: true, chosen_parent_employee_kr_id: true },
  });
  if (!employeeObjective)
    throw new Error("Employee objective not found for cascade.");

  // 1. Recompute the employee objective itself first, but do not auto-escalate yet.
  // We control escalation explicitly below to prevent recursive parent-child loops.
  const employeeObjectiveResult = await rollupEmployeeObjective(
    employeeObjectiveId,
    tx,
    true,
    deep,
  );

  if (employeeObjective.chosen_parent_kr_id) {
    return rollupCompanyKR(employeeObjective.chosen_parent_kr_id, tx);
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
 * Pure current_value cascade from Employee Objective upward through parent linkage.
 * Employee Objective -> parent Employee KR or Company KR -> parent Objective -> ...
 */
export async function cascadeCurrentValueFromEmployeeObjective(
  employeeObjectiveId: number,
  tx: any = prisma,
  depth: number = 0,
) {
  if (depth > 10) {
    console.warn(
      `[cascadeCurrentValueFromEmployeeObjective] Max depth reached at objective ${employeeObjectiveId}. Stopping recursion.`,
    );
    return;
  }

  const empObj = await tx.employeeObjective.findUnique({
    where: { id: employeeObjectiveId },
    select: {
      id: true,
      current_value: true,
      chosen_parent_kr_id: true,
      chosen_parent_employee_kr_id: true,
    },
  });
  if (!empObj) return;

  if (empObj.chosen_parent_kr_id) {
    // Parent is a Company KR — sum current_value from all employee objectives linked to it
    const linkedObjs = await tx.employeeObjective.findMany({
      where: { chosen_parent_kr_id: empObj.chosen_parent_kr_id },
      select: { current_value: true },
    });
    const companyKrCurrent = linkedObjs.reduce(
      (sum: Decimal, o: any) =>
        sum.add(toDecimal(o.current_value) ?? new Decimal(0)),
      new Decimal(0),
    );

    await tx.companyKeyResult.update({
      where: { id: empObj.chosen_parent_kr_id },
      data: {
        current_value: companyKrCurrent,
      },
    });

    // Now cascade up to Company Objective
    const companyKr = await tx.companyKeyResult.findUnique({
      where: { id: empObj.chosen_parent_kr_id },
      select: { objective_id: true },
    });
    if (companyKr?.objective_id) {
      const siblingKrs = await tx.companyKeyResult.findMany({
        where: { objective_id: companyKr.objective_id },
        select: {
          current_value: true,
          target_value: true,
          contributes_to_objective_value: true,
        },
      });
      const companyObjCurrent = siblingKrs.reduce((sum: Decimal, kr: any) => {
        if (kr.contributes_to_objective_value === false) return sum;
        return sum.add(toDecimal(kr.current_value) ?? new Decimal(0));
      }, new Decimal(0));
      const companyObjTarget = siblingKrs.reduce((sum: Decimal, kr: any) => {
        if (kr.contributes_to_objective_value === false) return sum;
        return sum.add(toDecimal(kr.target_value) ?? new Decimal(0));
      }, new Decimal(0));

      const companyObjProgress = companyObjTarget.gt(0)
        ? companyObjCurrent.div(companyObjTarget).mul(100).toDecimalPlaces(2)
        : new Decimal(0);

      await tx.companyObjective.update({
        where: { id: companyKr.objective_id },
        data: {
          current_value: companyObjCurrent,
          target_value: companyObjTarget,
          progress_percent: companyObjProgress,
        },
      });
    }
  } else if (empObj.chosen_parent_employee_kr_id) {
    // Parent is an Employee KR — sum current_value from all delegated objectives linked to it
    const delegatedObjs = await tx.employeeObjective.findMany({
      where: {
        chosen_parent_employee_kr_id: empObj.chosen_parent_employee_kr_id,
      },
      select: { current_value: true },
    });
    const parentKrCurrent = delegatedObjs.reduce(
      (sum: Decimal, o: any) =>
        sum.add(toDecimal(o.current_value) ?? new Decimal(0)),
      new Decimal(0),
    );

    const parentKr = await tx.employeeKeyResult.findUnique({
      where: { id: empObj.chosen_parent_employee_kr_id },
      select: { employee_objective_id: true, target_value: true },
    });

    const parentKrTarget = toDecimal(parentKr?.target_value) ?? new Decimal(0);
    const parentKrProgress = parentKrTarget.gt(0)
      ? parentKrCurrent.div(parentKrTarget).mul(100).toDecimalPlaces(2)
      : new Decimal(0);

    await tx.employeeKeyResult.update({
      where: { id: empObj.chosen_parent_employee_kr_id },
      data: {
        current_value: parentKrCurrent,
        progress_percent: parentKrProgress,
      },
    });

    // FIX: Propagate updated KR current_value into the manager's month plan items + month plans.
    // Without this step the cascade stops here and the manager's monthly plan stays stale
    // even though their KR correctly shows the rolled-up value.
    const parentKrMonthItems = await tx.employeeMonthPlanItem.findMany({
      where: { employee_kr_id: empObj.chosen_parent_employee_kr_id },
      select: { id: true, employee_month_plan_id: true, target_value: true },
    });

    if (parentKrMonthItems.length > 0) {
      // Distribute parentKrCurrent proportionally across month plan items by their target_value.
      // When only one item exists the full current value flows straight through.
      for (const item of parentKrMonthItems) {
        // 1. Manager's own work (sum of linked manager weeks)
        const managerWeeks = await tx.weeklyPlan.findMany({
          where: { employee_month_plan_item_id: item.id },
          select: { current_value: true },
        });
        const ownValue = managerWeeks.reduce(
          (sum: Decimal, w: any) =>
            sum.add(toDecimal(w.current_value) ?? new Decimal(0)),
          new Decimal(0),
        );

        // 2. Subordinate's work (sum of aligned subordinate month items)
        const alignedSubItems = await tx.employeeMonthPlanItem.findMany({
          where: { parent_employee_month_plan_item_id: item.id },
          select: { current_value: true },
        });
        const subValue = alignedSubItems.reduce(
          (sum: Decimal, i: any) =>
            sum.add(toDecimal(i.current_value) ?? new Decimal(0)),
          new Decimal(0),
        );

        // Final value is the sum of subordinates if they exist, otherwise fallback to own work
        const finalValue = subValue.gt(0) ? subValue : ownValue;

        await tx.employeeMonthPlanItem.update({
          where: { id: item.id },
          data: { current_value: finalValue },
        });
      }

      // Re-aggregate each unique month plan from its (now-updated) items.
      const monthPlanIds = [
        ...new Set(
          parentKrMonthItems.map((i: any) => i.employee_month_plan_id),
        ),
      ];
      for (const monthPlanId of monthPlanIds) {
        const allItemsInPlan = await tx.employeeMonthPlanItem.findMany({
          where: { employee_month_plan_id: monthPlanId },
          select: { current_value: true, target_value: true },
        });
        const planCurrent = allItemsInPlan.reduce(
          (sum: Decimal, i: any) =>
            sum.add(toDecimal(i.current_value) ?? new Decimal(0)),
          new Decimal(0),
        );
        const planTarget = allItemsInPlan.reduce(
          (sum: Decimal, i: any) =>
            sum.add(toDecimal(i.target_value) ?? new Decimal(0)),
          new Decimal(0),
        );
        const planProgress = planTarget.gt(0)
          ? planCurrent.div(planTarget).mul(100).toDecimalPlaces(2)
          : new Decimal(0);
        await tx.employeeMonthPlan.update({
          where: { id: monthPlanId },
          data: {
            current_value: planCurrent,
            progress_percent: planProgress,
          },
        });
      }
    }

    // Recurse: update the parent employee KR's parent objective, then cascade further up
    if (
      parentKr?.employee_objective_id &&
      parentKr.employee_objective_id !== employeeObjectiveId
    ) {
      // Re-sum all KRs for this parent objective
      const parentObjKrs = await tx.employeeKeyResult.findMany({
        where: { employee_objective_id: parentKr.employee_objective_id },
        select: {
          current_value: true,
          target_value: true,
          contributes_to_objective_value: true,
        },
      });
      const parentObjCurrent = parentObjKrs.reduce((sum: Decimal, kr: any) => {
        if (kr.contributes_to_objective_value === false) return sum;
        return sum.add(toDecimal(kr.current_value) ?? new Decimal(0));
      }, new Decimal(0));
      const parentObjTarget = parentObjKrs.reduce((sum: Decimal, kr: any) => {
        if (kr.contributes_to_objective_value === false) return sum;
        return sum.add(toDecimal(kr.target_value) ?? new Decimal(0));
      }, new Decimal(0));

      const parentObjProgress = parentObjTarget.gt(0)
        ? parentObjCurrent.div(parentObjTarget).mul(100).toDecimalPlaces(2)
        : new Decimal(0);

      await tx.employeeObjective.update({
        where: { id: parentKr.employee_objective_id },
        data: {
          current_value: parentObjCurrent,
          target_value: parentObjTarget,
          progress_percent: parentObjProgress,
        },
      });

      // Recurse upward
      await cascadeCurrentValueFromEmployeeObjective(
        parentKr.employee_objective_id,
        tx,
        depth + 1,
      );
    }
  }
}

/**
 * Single-entry current-value traversal from Daily Plan up to Company Objective.
 * Daily -> Weekly -> Month Item -> Month Plan -> Employee KR -> Employee Objective -> parent chain.
 */
export async function syncCurrentValueCascadeFromDailyPlan(
  dailyPlanId: number,
  tx: any = prisma,
) {
  const daily = await tx.dailyPlan.findUnique({
    where: { id: dailyPlanId },
    select: {
      id: true,
      weekly_task_id: true,
      current_value: true,
    },
  });
  if (!daily) {
    throw new Error("Daily plan not found for current-value cascade.");
  }

  // Sum all daily plans' current_value for this weekly task
  const siblingDailies = await tx.dailyPlan.findMany({
    where: { weekly_task_id: daily.weekly_task_id },
    select: { current_value: true },
  });
  const weeklyTaskCurrent = siblingDailies.reduce(
    (sum: Decimal, d: any) =>
      sum.add(toDecimal(d.current_value) ?? new Decimal(0)),
    new Decimal(0),
  );

  // Update weekly task current_value
  await tx.weeklyTask.update({
    where: { id: daily.weekly_task_id },
    data: {
      current_value: weeklyTaskCurrent,
    },
  });

  // Chain into the weekly task cascade
  return syncCurrentValueCascadeFromWeeklyTask(daily.weekly_task_id, tx);
}

/**
 * Single-entry current-value traversal from Weekly Task up to Weekly Plan.
 */
export async function syncCurrentValueCascadeFromWeeklyTask(
  weeklyTaskId: number,
  tx: any = prisma,
) {
  const task = await tx.weeklyTask.findUnique({
    where: { id: weeklyTaskId },
    select: {
      id: true,
      weekly_plan_id: true,
      current_value: true,
    },
  });
  if (!task) {
    throw new Error("Weekly task not found for current-value cascade.");
  }

  // 1. Manager's own daily plans for this task
  const siblingDailies = await tx.dailyPlan.findMany({
    where: { weekly_task_id: weeklyTaskId },
    select: { current_value: true },
  });
  const ownValue = siblingDailies.reduce(
    (sum: Decimal, d: any) =>
      sum.add(toDecimal(d.current_value) ?? new Decimal(0)),
    new Decimal(0),
  );

  // 2. Subordinate weekly plans linked to this task
  const alignedSubWeeks = await tx.weeklyPlan.findMany({
    where: {
      parent_weekly_task_id: weeklyTaskId,
      status_code: { in: ["approved", "published"] },
    },
    select: { current_value: true },
  });
  const subValueSum = alignedSubWeeks.reduce(
    (sum: Decimal, w: any) =>
      sum.add(toDecimal(w.current_value) ?? new Decimal(0)),
    new Decimal(0),
  );

  const totalTaskValue = subValueSum.gt(0) ? subValueSum : ownValue;

  // Update weekly task current_value
  await tx.weeklyTask.update({
    where: { id: weeklyTaskId },
    data: {
      current_value: totalTaskValue,
    },
  });

  // Sum all tasks' current_value and target_value for this weekly plan
  const siblingTasks = await tx.weeklyTask.findMany({
    where: { weekly_plan_id: task.weekly_plan_id },
    select: { current_value: true, target_value: true },
  });

  const weeklyCurrent = siblingTasks.reduce(
    (sum: Decimal, t: any) =>
      sum.add(toDecimal(t.current_value) ?? new Decimal(0)),
    new Decimal(0),
  );

  const weeklyTarget = siblingTasks.reduce(
    (sum: Decimal, t: any) =>
      sum.add(toDecimal(t.target_value) ?? new Decimal(0)),
    new Decimal(0),
  );

  // Update weekly plan values
  await tx.weeklyPlan.update({
    where: { id: task.weekly_plan_id },
    data: {
      current_value: weeklyCurrent,
      target_value: weeklyTarget,
    },
  });

  // Chain into the weekly cascade for the rest of the hierarchy
  return syncCurrentValueCascadeFromWeeklyPlan(task.weekly_plan_id, tx);
}

/**
 * Cascade current_value from the weekly plan level upward after a daily plan is deleted.
 * Since the daily plan no longer exists, we start from the weekly plan directly.
 */
export async function syncCurrentValueCascadeAfterDailyPlanDelete(
  weeklyTaskId: number,
  tx: any = prisma,
) {
  // Re-sum remaining daily plans' current_value for this weekly task
  const remainingDailies = await tx.dailyPlan.findMany({
    where: { weekly_task_id: weeklyTaskId },
    select: { current_value: true },
  });
  const weeklyTaskCurrent = remainingDailies.reduce(
    (sum: Decimal, d: any) =>
      sum.add(toDecimal(d.current_value) ?? new Decimal(0)),
    new Decimal(0),
  );

  // Update weekly task current_value
  await tx.weeklyTask.update({
    where: { id: weeklyTaskId },
    data: {
      current_value: weeklyTaskCurrent,
    },
  });

  // Chain into the weekly task cascade
  return syncCurrentValueCascadeFromWeeklyTask(weeklyTaskId, tx);
}

/**
 * Single-entry current-value traversal from Weekly Plan up to Company Objective.
 * Weekly -> Month Item -> Month Plan -> Employee KR -> Employee Objective -> parent chain.
 */
export async function syncCurrentValueCascadeFromWeeklyPlan(
  weeklyPlanId: number,
  tx: any = prisma,
) {
  const weekly = await tx.weeklyPlan.findUnique({
    where: { id: weeklyPlanId },
    select: {
      id: true,
      employee_kr_id: true,
      employee_month_plan_id: true,
      employee_month_plan_item_id: true,
      current_value: true,
      parent_weekly_task_id: true,
      employeeKr: {
        select: {
          id: true,
          employee_objective_id: true,
        },
      },
    },
  });
  if (!weekly) {
    throw new Error("Weekly plan not found for current-value cascade.");
  }

  // 1. Get all monthly plan items for this KR in this month
  const monthItems = await tx.employeeMonthPlanItem.findMany({
    where: {
      employee_month_plan_id: weekly.employee_month_plan_id,
      employee_kr_id: weekly.employee_kr_id,
    },
    select: {
      id: true,
      employee_kr_id: true,
      current_value: true,
      target_value: true,
      parent_employee_month_plan_item_id: true,
    },
    orderBy: { id: "asc" },
  });

  if (monthItems.length > 0) {
    // 2. Get all weeks for this KR in this month to redistribute them correctly.
    const allWeeksInMonth = await tx.weeklyPlan.findMany({
      where: {
        employee_kr_id: weekly.employee_kr_id,
        employee_month_plan_id: weekly.employee_month_plan_id,
      },
      select: { current_value: true, employee_month_plan_item_id: true },
    });

    // 3. Map weeks to items based on employee_month_plan_item_id.
    for (const item of monthItems) {
      const linkedWeeks = allWeeksInMonth.filter(
        (w: any) => w.employee_month_plan_item_id === item.id,
      );

      // Unlinked weeks fallback: attribute to the first item for this KR.
      const unlinkedWeeks =
        monthItems[0].id === item.id
          ? allWeeksInMonth.filter((w: any) => !w.employee_month_plan_item_id)
          : [];

      const managerWeeksValue = [...linkedWeeks, ...unlinkedWeeks].reduce(
        (sum: Decimal, w: any) =>
          sum.add(toDecimal(w.current_value) ?? new Decimal(0)),
        new Decimal(0),
      );

      // NEW: Also include aligned subordinate month items for this specific item.
      const alignedSubItems = await tx.employeeMonthPlanItem.findMany({
        where: { parent_employee_month_plan_item_id: item.id },
        select: { current_value: true },
      });
      const subItemSum = alignedSubItems.reduce(
        (sum: Decimal, i: any) =>
          sum.add(toDecimal(i.current_value) ?? new Decimal(0)),
        new Decimal(0),
      );

      // Use subordinate sum if it exists, otherwise fallback to manager's own weeks
      const finalItemValue = subItemSum.gt(0) ? subItemSum : managerWeeksValue;

      await tx.employeeMonthPlanItem.update({
        where: { id: item.id },
        data: { current_value: finalItemValue },
      });
    }
  }

  const allMonthPlanItems = await tx.employeeMonthPlanItem.findMany({
    where: { employee_month_plan_id: weekly.employee_month_plan_id },
    select: { current_value: true, target_value: true },
  });
  const monthCurrent = allMonthPlanItems.reduce(
    (sum: Decimal, item: any) =>
      sum.add(toDecimal(item.current_value) ?? new Decimal(0)),
    new Decimal(0),
  );
  const monthTarget = allMonthPlanItems.reduce(
    (sum: Decimal, item: any) =>
      sum.add(toDecimal(item.target_value) ?? new Decimal(0)),
    new Decimal(0),
  );

  await tx.employeeMonthPlan.update({
    where: { id: weekly.employee_month_plan_id },
    data: {
      current_value: monthCurrent,
    },
  });

  const krItems = await tx.employeeMonthPlanItem.findMany({
    where: { employee_kr_id: weekly.employee_kr_id },
    select: { current_value: true, target_value: true },
  });
  const krCurrent = krItems.reduce(
    (sum: Decimal, item: any) =>
      sum.add(toDecimal(item.current_value) ?? new Decimal(0)),
    new Decimal(0),
  );
  const krTarget = krItems.reduce(
    (sum: Decimal, item: any) =>
      sum.add(toDecimal(item.target_value) ?? new Decimal(0)),
    new Decimal(0),
  );

  await tx.employeeKeyResult.update({
    where: { id: weekly.employee_kr_id },
    data: {
      current_value: krCurrent,
    },
  });

  const objectiveKrs = await tx.employeeKeyResult.findMany({
    where: { employee_objective_id: weekly.employeeKr.employee_objective_id },
    select: {
      current_value: true,
      target_value: true,
      contributes_to_objective_value: true,
    },
  });

  const objectiveCurrent = objectiveKrs.reduce((sum: Decimal, kr: any) => {
    if (kr.contributes_to_objective_value === false) return sum;
    return sum.add(toDecimal(kr.current_value) ?? new Decimal(0));
  }, new Decimal(0));
  const objectiveTarget = objectiveKrs.reduce((sum: Decimal, kr: any) => {
    if (kr.contributes_to_objective_value === false) return sum;
    return sum.add(toDecimal(kr.target_value) ?? new Decimal(0));
  }, new Decimal(0));

  await tx.employeeObjective.update({
    where: { id: weekly.employeeKr.employee_objective_id },
    data: {
      current_value: objectiveCurrent,
    },
  });

  // Continue the pure current_value chain upward through parent linkage
  // (Employee Objective -> parent Employee KR/Company KR -> parent Objective -> ...)
  await cascadeCurrentValueFromEmployeeObjective(
    weekly.employeeKr.employee_objective_id,
    tx,
  );

  // NEW: Cascade to manager if aligned
  if (weekly.parent_weekly_task_id) {
    // 1. Weekly task alignment (most granular)
    await syncCurrentValueCascadeFromWeeklyTask(
      weekly.parent_weekly_task_id,
      tx,
    );
  } else if (monthItems.length > 0) {
    // 2. Fallback: Check if any monthly items are aligned to a manager's item
    // We only need to check the first item since they all belong to the same KR
    const alignedItem = monthItems.find(
      (i: any) => i.parent_employee_month_plan_item_id,
    );
    if (alignedItem) {
      const managerItem = await tx.employeeMonthPlanItem.findUnique({
        where: { id: alignedItem.parent_employee_month_plan_item_id! },
        select: { employee_kr_id: true },
      });
      if (managerItem) {
        // Trigger a full KR rollup for the manager to ensure accurate redistribution/sync
        await rollupEmployeeKR(managerItem.employee_kr_id, tx, false, true);
      }
    }
  }

  return {
    weeklyPlanId,
    employeeKrId: weekly.employee_kr_id,
    employeeObjectiveId: weekly.employeeKr.employee_objective_id,
    monthPlanId: weekly.employee_month_plan_id,
    current: {
      week: toDecimal(weekly.current_value) ?? new Decimal(0),
      monthPlan: monthCurrent,
      keyResult: krCurrent,
      objective: objectiveCurrent,
    },
  };
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
        const result = await rollupCompanyObjective(obj.id, tx, false, true);
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
      maxWait: 5000, // default is 2000ms
      timeout: 30000, // default is 5000ms, rollups can take some time
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
    (sum, kr) => sum.add(kr.current_value ?? new Decimal(0)),
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
        value: kr.current_value,
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
        value: kr.current_value,
      })),
    },
  };
}
