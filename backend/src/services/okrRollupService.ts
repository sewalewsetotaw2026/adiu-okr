import { prisma } from "src/app";
import { Decimal } from "@prisma/client/runtime/library";
import {
  getConfidenceLevelMapping,
  resolveConfidenceLevelFromProgress,
} from "src/services/okrMeasurementService";

// =============================================================================
// OKR ROLLUP ENGINE — Dynamic Metric-Aware Scoring
// =============================================================================

/**
 * Check if a metric definition uses value-based progress.
 * When true, progress is calculated as (current_value / target_value) × 100
 * instead of weighted score aggregation.
 */
function isValueBasedProgressMetric(metricDefinition: any): boolean {
  return (
    metricDefinition?.value_based_progress === true ||
    metricDefinition?.is_financial === true
  );
}

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
        where: { OR: [{ contribute_to_score: true }, { contribute_to_value: true }] },
        orderBy: { month_number: "asc" },
        include: {
          weeklyPlans: {
            include: { dailyPlans: true }
          }
        }
      },
      subtasks: {
        where: { OR: [{ contributes_to_parent_score: true }, { contributes_to_parent_value: true }] },
        orderBy: { sequence_order: "asc" },
      },
    },
  });
  if (!kr) throw new Error("Employee KR not found.");

  const metric = kr.metricDefinition;
  if (!metric) throw new Error("Metric definition not found for KR.");
  const isValueBased = isValueBasedProgressMetric(metric);

  let finalScore = new Decimal(0);
  let finalValue = new Decimal(0);
  let indirectScore = new Decimal(0);
  let indirectValue = new Decimal(0);

  const monthlyPlans = kr.monthlyPlans ?? [];
  const subtasks = kr.subtasks ?? [];

  if (isValueBased) {
    // ── VALUE-BASED PROGRESS SHORTCUT ──
    // Sum current_value from all child plans (monthly → weekly → daily)
    let totalCurrentValue = new Decimal(0);

    for (const monthPlan of monthlyPlans) {
      if (!monthPlan.contribute_to_value) continue;
      totalCurrentValue = totalCurrentValue.add(
        toDecimal(monthPlan.current_value) ?? new Decimal(0)
      );
    }

    // Sum values from subtasks as well (from HEAD)
    for (const s of subtasks ?? []) {
      if (s.contribute_to_value) {
        totalCurrentValue = totalCurrentValue.add(decOrZero(s.current_value));
      }
    }

    // Fallback to latest progress update if no monthly plans or subtasks exist
    if (monthlyPlans.length === 0 && subtasks.length === 0 && kr.progressUpdates[0]?.current_value) {
      totalCurrentValue = new Decimal(kr.progressUpdates[0].current_value);
    }

    finalValue = totalCurrentValue;
    const target = decOrZero(kr.target_value);
    const start = decOrZero(kr.start_value);
    finalScore = target.sub(start).gt(0)
      ? clampPercent(finalValue.sub(start).div(target.sub(start)).mul(100))
      : new Decimal(0);

    await tx.employeeKeyResult.update({
      where: { id: employeeKrId },
      data: {
        final_score: finalScore,
        final_value: finalValue,
        indirect_score: new Decimal(0),
        indirect_value: new Decimal(0),
      },
    });

    return {
      score: finalScore,
      value: finalValue,
      indirectScore: new Decimal(0),
      indirectValue: new Decimal(0),
      isFinancial: metric.is_financial,
      supportsWeightedScore: metric.supports_weighted_score,
      supportsValueRollup: metric.supports_value_rollup,
    };
  } else {
    // Weighted average of progress_pct
    let weightedSum = new Decimal(0);
    let totalWeight = new Decimal(0);

    for (const m of monthlyPlans as any[]) {
      if (m.contribute_to_score) {
        const wt = decOrZero(m.weight_pct);
        const pp = decOrZero(m.progress_pct);
        weightedSum = weightedSum.add(pp.mul(wt));
        totalWeight = totalWeight.add(wt);
      }
    }
    for (const s of subtasks as any[]) {
      if (s.contribute_to_score) {
        const wt = decOrZero(s.weight_percent);
        const pp = decOrZero(s.final_score);
        weightedSum = weightedSum.add(pp.mul(wt));
        totalWeight = totalWeight.add(wt);
      }
    }

    if (totalWeight.gt(0)) {
      if (metric?.allows_binary_completion) {
        // AND logic for milestone metrics
        const allCompleted = [...monthlyPlans, ...subtasks]
          .filter((p: any) => p.contribute_to_score || p.contributes_to_parent_score)
          .every((p: any) => decOrZero(p.progress_pct || p.final_score).gte(100));
        finalScore = allCompleted ? new Decimal(100) : new Decimal(0);
      } else {
        finalScore = weightedSum.div(totalWeight);
      }
    } else if (monthlyPlans.length + subtasks.length > 0) {
      const allSources = [
        ...monthlyPlans.filter((m: any) => m.contribute_to_score),
        ...subtasks.filter((s: any) => s.contributes_to_parent_score)
      ];
      if (metric?.allows_binary_completion) {
        const allCompleted = allSources.every((p: any) => decOrZero(p.progress_pct || p.final_score).gte(100));
        finalScore = allCompleted ? new Decimal(100) : new Decimal(0);
      } else {
        const allScores = allSources.map((s: any) => decOrZero(s.progress_pct || s.final_score));
        finalScore = allScores.reduce((sum, s) => sum.add(s), new Decimal(0)).div(allScores.length);
      }
    } else if (kr.progressUpdates[0]?.progress_pct) {
      finalScore = new Decimal(kr.progressUpdates[0].progress_pct);
    }

    finalScore = clampPercent(finalScore);
    const target = decOrZero(kr.target_value);
    const start = decOrZero(kr.start_value);
    finalValue = start.add(target.sub(start).mul(finalScore).div(100));
  }

  // Update confidence level based on score
  const confidenceLevel = await calculateConfidenceLevel(kr.company_id, finalScore);

  await tx.employeeKeyResult.update({
    where: { id: employeeKrId },
    data: {
      final_score: finalScore,
      final_value: finalValue,
      indirect_score: indirectScore,
      indirect_value: indirectValue,
    },
  });



  return {
    score: finalScore,
    value: finalValue,
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
      // Correctly trigger rollup for Company level KR
      await recalculateRollUp("company_key_result", obj.chosen_parent_kr_id, tx);
    } else if (obj?.chosen_parent_employee_kr_id) {
      // Correctly trigger rollup for parent Employee level KR
      await recalculateRollUp("employee_key_result", obj.chosen_parent_employee_kr_id, tx);
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

  // ── VALUE-BASED PROGRESS FOR OBJECTIVE ──
  // If ALL contributing KRs use value-based progress, compute objective
  // progress as totalValue / objectiveTargetValue instead of weighted score.
  const valueBasedKRs = updatedKRs.filter((kr: any) =>
    isValueBasedProgressMetric(kr.metricDefinition),
  );
  const allKRsValueBased =
    updatedKRs.length > 0 && valueBasedKRs.length === updatedKRs.length;

  if (allKRsValueBased) {
    let totalValue = new Decimal(0);
    let allMandatoryComplete = true;

    let totalStart = new Decimal(0);
    let totalTarget = new Decimal(0);

    for (const kr of updatedKRs) {
      totalValue = totalValue.add(kr.final_value ?? new Decimal(0));
      totalStart = totalStart.add(toDecimal((kr as any).start_value) ?? new Decimal(0));
      totalTarget = totalTarget.add(toDecimal(kr.target_value) ?? new Decimal(0));

      if (
        kr.is_mandatory_for_completion &&
        (!kr.final_score || kr.final_score.lt(100))
      ) {
        allMandatoryComplete = false;
      }
    }

    // Use the objective's own target_value if available, otherwise sum KR targets
    const objTargetValue = toDecimal((objective as any).target_value) ?? totalTarget;
    const objStartValue = toDecimal((objective as any).start_value) ?? totalStart;

    const finalScore = objTargetValue.sub(objStartValue).gt(0)
      ? clampPercent(totalValue.sub(objStartValue).div(objTargetValue.sub(objStartValue)).mul(100))
      : new Decimal(0);

    await tx.employeeObjective.update({
      where: { id: objectiveId },
      data: {
        final_score: finalScore,
        final_value: totalValue,
        indirect_score: new Decimal(0),
        indirect_value: new Decimal(0),
      },
    });

    return {
      objectiveId,
      finalScore,
      finalValue: totalValue,
      indirectScore: new Decimal(0),
      indirectValue: new Decimal(0),
      allMandatoryComplete,
    };
  }
  // ── END VALUE-BASED PROGRESS FOR OBJECTIVE ──

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
              id: true,
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

  // 1. Calculate manager's own score from their own plans/subtasks
  const ownResults = await computeEmployeeKRScore(employeeKrId, tx);
  const metric = empKr.metricDefinition;
  const isValueBased = isValueBasedProgressMetric(metric);

  // 2. Identify manager's monthly and weekly plans for alignment checking
  const managerMonthlyPlans = await tx.employeeMonthPlan.findMany({
    where: { employee_kr_id: employeeKrId },
    select: { id: true },
  });
  const managerMonthlyIds = managerMonthlyPlans.map((m: any) => m.id);

  const managerWeeklyPlans = await tx.weeklyPlan.findMany({
    where: {
      employee_month_plan_id: { in: managerMonthlyIds },
    },
    select: { id: true },
  });
  const managerWeeklyIds = managerWeeklyPlans.map((w: any) => w.id);

  // 3. Collect scores/values from contributors, EXCLUDING those with plan-level alignments
  const sourceScores: Decimal[] = [];
  let sourceValue = new Decimal(0);
  const sourceIndirectScores: Decimal[] = [];
  let sourceIndirectValue = new Decimal(0);

  // Add manager's own results if they exist (non-zero or has plans)
  // We consider manager's own work as one "contributor" in the average
  const hasOwnWork =
    ownResults.score.gt(0) ||
    (await tx.employeeMonthPlan.count({ where: { employee_kr_id: employeeKrId } })) > 0 ||
    (await tx.subtask.count({ where: { employee_kr_id: employeeKrId } })) > 0;

  if (hasOwnWork) {
    sourceScores.push(ownResults.score);
    sourceValue = sourceValue.add(ownResults.value ?? new Decimal(0));
    sourceIndirectScores.push(ownResults.indirectScore);
    sourceIndirectValue = sourceIndirectValue.add(ownResults.indirectValue);
  }

  for (const contributor of refreshed!.contributors) {
    const empObj = contributor.employeeObjectives;
    if (!empObj) continue;

    // CHECK ALIGNMENT: If this contributor aligned a plan to the manager, skip them here
    // to avoid double-counting (their progress is already in ownResults via plan rollup).
    let hasPlanAlignment = false;
    if (managerMonthlyIds.length > 0 || managerWeeklyIds.length > 0) {
      const alignment = await tx.employeeMonthPlan.findFirst({
        where: {
          employeeKr: {
            employee_objective_id: empObj.id,
          },
          OR: [
            { aligned_manager_plan_id: { in: managerMonthlyIds } },
            {
              weeklyPlans: {
                some: { aligned_manager_plan_id: { in: managerWeeklyIds } },
              },
            },
          ],
        },
      });
      if (alignment) hasPlanAlignment = true;
    }

    if (hasPlanAlignment) continue;

    if (hasDecimal(empObj.final_score)) {
      sourceScores.push(empObj.final_score as Decimal);
    }
    sourceValue = sourceValue.add(empObj.final_value ?? new Decimal(0));

    if (hasDecimal(empObj.indirect_score)) {
      sourceIndirectScores.push(empObj.indirect_score as Decimal);
    }
    sourceIndirectValue = sourceIndirectValue.add(empObj.indirect_value ?? new Decimal(0));
  }

  let finalScore = new Decimal(0);
  let finalIndirectScore = new Decimal(0);

  if (sourceScores.length > 0) {
    if (metric?.allows_binary_completion) {
      // AND logic for milestone metrics
      const allCompleted = sourceScores.every((s) => s.gte(100));
      finalScore = allCompleted ? new Decimal(100) : new Decimal(0);
    } else {
      finalScore = sourceScores
        .reduce((sum, s) => sum.add(s), new Decimal(0))
        .div(sourceScores.length);
    }

    finalIndirectScore = sourceIndirectScores.length > 0
      ? sourceIndirectScores.reduce((sum, s) => sum.add(s), new Decimal(0)).div(sourceIndirectScores.length)
      : new Decimal(0);
  }

  // If value-based, we might want to use the summed value instead of averaged progress
  // But usually KR progress is the average of contributor's progress.
  // The user said: "the progress should be determined by the value not the score".
  // For KRs, this means the final_score should be (totalValue / targetValue) * 100.
  if (isValueBased) {
    const target = toDecimal(empKr.target_value) ?? new Decimal(0);
    const start = toDecimal((empKr as any).start_value) ?? new Decimal(0);
    finalScore = target.sub(start).gt(0)
      ? clampPercent(sourceValue.sub(start).div(target.sub(start)).mul(100))
      : new Decimal(0);
  }

  await tx.employeeKeyResult.update({
    where: { id: employeeKrId },
    data: {
      final_score: finalScore,
      final_value: sourceValue,
      indirect_score: finalIndirectScore,
      indirect_value: sourceIndirectValue,
    },
  });

  // NOTE: Do NOT cascade upward here. The caller (recalculateRollUp) is responsible
  // for upward propagation to avoid infinite recursion (rollupEmployeeObjective
  // may call rollupEmployeeKR when there's chosen_parent_employee_kr_id).

  return {
    employeeKrId,
    finalScore,
    sourceValue,
    finalIndirectScore,
    sourceIndirectValue,
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

  // 1. Calculate manager's own score from their own plans/subtasks
  const ownResults = await computeEmployeeKRScore(departmentKrId, tx);
  const metric = deptKr.metricDefinition;
  const isValueBased = isValueBasedProgressMetric(metric);

  // 2. Identify manager's monthly and weekly plans for alignment checking
  const managerMonthlyPlans = await tx.employeeMonthPlan.findMany({
    where: { employee_kr_id: departmentKrId },
    select: { id: true },
  });
  const managerMonthlyIds = managerMonthlyPlans.map((m: any) => m.id);

  const managerWeeklyPlans = await tx.weeklyPlan.findMany({
    where: {
      employee_month_plan_id: { in: managerMonthlyIds },
    },
    select: { id: true },
  });
  const managerWeeklyIds = managerWeeklyPlans.map((w: any) => w.id);

  // 3. Collect scores/values from contributors, EXCLUDING those with plan-level alignments
  const sourceScores: Decimal[] = [];
  let sourceValue = new Decimal(0);
  const sourceIndirectScores: Decimal[] = [];
  let sourceIndirectValue = new Decimal(0);

  // Add manager's own results if they exist
  const hasOwnWork =
    ownResults.score.gt(0) ||
    (await tx.employeeMonthPlan.count({ where: { employee_kr_id: departmentKrId } })) > 0 ||
    (await tx.subtask.count({ where: { employee_kr_id: departmentKrId } })) > 0;

  if (hasOwnWork) {
    sourceScores.push(ownResults.score);
    sourceValue = sourceValue.add(ownResults.value ?? new Decimal(0));
    sourceIndirectScores.push(ownResults.indirectScore);
    sourceIndirectValue = sourceIndirectValue.add(ownResults.indirectValue);
  }

  const refreshed = await tx.employeeKeyResult.findUnique({
    where: { id: departmentKrId },
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
    },
  });

  for (const contributor of refreshed!.contributors) {
    const empObj = contributor.employeeObjectives;
    if (!empObj) continue;

    // CHECK ALIGNMENT
    let hasPlanAlignment = false;
    if (managerMonthlyIds.length > 0 || managerWeeklyIds.length > 0) {
      const alignment = await tx.employeeMonthPlan.findFirst({
        where: {
          employee_objective_id: empObj.id,
          OR: [
            { aligned_manager_plan_id: { in: managerMonthlyIds } },
            {
              weeklyPlans: {
                some: { aligned_manager_plan_id: { in: managerWeeklyIds } },
              },
            },
          ],
        },
      });
      if (alignment) hasPlanAlignment = true;
    }

    if (hasPlanAlignment) continue;

    if (hasDecimal(empObj.final_score)) {
      sourceScores.push(empObj.final_score as Decimal);
    }
    sourceValue = sourceValue.add(empObj.final_value ?? new Decimal(0));

    if (hasDecimal(empObj.indirect_score)) {
      sourceIndirectScores.push(empObj.indirect_score as Decimal);
    }
    sourceIndirectValue = sourceIndirectValue.add(empObj.indirect_value ?? new Decimal(0));
  }

  let finalScore = new Decimal(0);
  let finalIndirectScore = new Decimal(0);

  if (sourceScores.length > 0) {
    if (metric?.allows_binary_completion) {
      // AND logic for milestone metrics
      const allCompleted = sourceScores.every((s) => s.gte(100));
      finalScore = allCompleted ? new Decimal(100) : new Decimal(0);
    } else {
      finalScore = sourceScores
        .reduce((sum, s) => sum.add(s), new Decimal(0))
        .div(sourceScores.length);
    }

    finalIndirectScore = sourceIndirectScores.length > 0
      ? sourceIndirectScores.reduce((sum, s) => sum.add(s), new Decimal(0)).div(sourceIndirectScores.length)
      : new Decimal(0);
  }

  if (isValueBased) {
    const target = toDecimal(deptKr.target_value) ?? new Decimal(0);
    const start = toDecimal((deptKr as any).start_value) ?? new Decimal(0);
    finalScore = target.sub(start).gt(0)
      ? clampPercent(sourceValue.sub(start).div(target.sub(start)).mul(100))
      : new Decimal(0);
  }

  await tx.employeeKeyResult.update({
    where: { id: departmentKrId },
    data: {
      final_score: finalScore,
      final_value: sourceValue,
      indirect_score: finalIndirectScore,
      indirect_value: sourceIndirectValue,
    },
  });

  return {
    departmentKrId,
    finalScore,
    sourceValue,
    finalIndirectScore,
    sourceIndirectValue,
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

  // Re-fetch after score update
  const updatedKRs = await tx.employeeKeyResult.findMany({
    where: { employee_objective_id: deptObjectiveId },
    include: { metricDefinition: true },
  });

  // ── VALUE-BASED PROGRESS FOR OBJECTIVE ──
  const valueBasedKRs = updatedKRs.filter((kr: any) =>
    isValueBasedProgressMetric(kr.metricDefinition),
  );
  const allKRsValueBased =
    updatedKRs.length > 0 && valueBasedKRs.length === updatedKRs.length;

  if (allKRsValueBased) {
    let totalValue = new Decimal(0);
    let totalStart = new Decimal(0);
    let totalTarget = new Decimal(0);

    for (const kr of updatedKRs) {
      totalValue = totalValue.add(kr.final_value ?? new Decimal(0));
      totalStart = totalStart.add(toDecimal((kr as any).start_value) ?? new Decimal(0));
      totalTarget = totalTarget.add(toDecimal(kr.target_value) ?? new Decimal(0));
    }

    // Use objective's own baseline if available, otherwise sum KRs
    const objTargetValue = toDecimal((objective as any).target_value) ?? totalTarget;
    const objStartValue = toDecimal((objective as any).start_value) ?? totalStart;

    const finalScore = objTargetValue.sub(objStartValue).gt(0)
      ? clampPercent(totalValue.sub(objStartValue).div(objTargetValue.sub(objStartValue)).mul(100))
      : new Decimal(0);

    await tx.employeeObjective.update({
      where: { id: deptObjectiveId },
      data: {
        final_score: finalScore,
        final_value: totalValue,
        indirect_score: new Decimal(0),
        indirect_value: new Decimal(0),
      },
    });

    if (!skipUpward) {
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
      indirectScore: new Decimal(0),
      indirectValue: new Decimal(0),
    };
  }
  // ── END VALUE-BASED PROGRESS FOR OBJECTIVE ──

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
  const companyKr = await tx.companyKeyResult.findUnique({
    where: { id: companyKrId },
    include: {
      metricDefinition: true,
      departments: { select: { id: true } },
      contributors: { select: { id: true } },
    },
  });
  if (!companyKr) throw new Error("Company KR not found.");
  const metric = companyKr.metricDefinition;

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

  let avgScore = new Decimal(0);
  if (scores.length > 0) {
    if (metric?.allows_binary_completion) {
      // AND logic for milestone metrics
      const allCompleted = scores.every((s: Decimal) => s.gte(100));
      avgScore = allCompleted ? new Decimal(100) : new Decimal(0);
    } else {
      const sum = scores.reduce(
        (acc: Decimal, s: Decimal) => acc.add(s),
        new Decimal(0),
      );
      // Average across all assigned departments/contributors, not just those who have reporting objectives
      const assignedCount = Math.max(
        1,
        companyKr.departments.length,
        companyKr.contributors.length,
      );
      avgScore = sum.div(assignedCount);
    }
  }
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

  const isValueBased = isValueBasedProgressMetric(metric);

  let finalScore = avgScore;
  if (isValueBased) {
    const target = toDecimal(companyKr.target_value) ?? new Decimal(0);
    const start = toDecimal((companyKr as any).start_value) ?? new Decimal(0);
    finalScore = target.sub(start).gt(0)
      ? clampPercent(totalValue.sub(start).div(target.sub(start)).mul(100))
      : new Decimal(0);
  }

  await tx.companyKeyResult.update({
    where: { id: companyKrId },
    data: {
      final_score: finalScore,
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

  // ── VALUE-BASED PROGRESS FOR OBJECTIVE ──
  const valueBasedKRs = updatedKRs.filter((kr: any) =>
    isValueBasedProgressMetric(kr.metricDefinition),
  );
  const allKRsValueBased =
    updatedKRs.length > 0 && valueBasedKRs.length === updatedKRs.length;

  if (allKRsValueBased) {
    let totalValue = new Decimal(0);
    let totalStart = new Decimal(0);
    let totalTarget = new Decimal(0);

    for (const kr of updatedKRs) {
      totalValue = totalValue.add(kr.final_value ?? new Decimal(0));
      totalStart = totalStart.add(toDecimal((kr as any).start_value) ?? new Decimal(0));
      totalTarget = totalTarget.add(toDecimal(kr.target_value) ?? new Decimal(0));
    }

    const objTargetValue = toDecimal((objective as any).target_value) ?? totalTarget;
    const objStartValue = toDecimal((objective as any).start_value) ?? totalStart;

    const finalScore = objTargetValue.sub(objStartValue).gt(0)
      ? clampPercent(totalValue.sub(objStartValue).div(objTargetValue.sub(objStartValue)).mul(100))
      : new Decimal(0);

    await tx.companyObjective.update({
      where: { id: companyObjectiveId },
      data: {
        final_score: finalScore,
        final_value: totalValue,
        indirect_score: new Decimal(0),
        indirect_value: new Decimal(0),
      },
    });

    return {
      companyObjectiveId,
      finalScore,
      finalValue: totalValue,
      indirectScore: new Decimal(0),
      indirectValue: new Decimal(0),
    };
  }
  // ── END VALUE-BASED PROGRESS FOR OBJECTIVE ──

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
  // If the department objective isn't linked to a company KR yet, stop here
  // gracefully instead of throwing — not all objectives are connected.
  if (!departmentObjective || !departmentObjective.chosen_parent_kr_id) {
    return departmentObjectiveResult;
  }

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
  if (!employeeObjective) return;

  // 1. Recompute the employee objective itself first
  const employeeObjectiveResult = await rollupEmployeeObjective(
    employeeObjectiveId,
    tx,
  );

  // 2. DUPLICATION AVOIDANCE: If any descendant weekly or monthly plan is aligned to a manager,
  // we don't roll up this objective to the manager KR because progress already arrives via the aligned plans.
  const hasAlignedWeekly = await tx.weeklyPlan.findFirst({
    where: {
      monthPlan: {
        employeeKr: {
          employee_objective_id: employeeObjectiveId
        }
      },
      aligned_manager_plan_id: { not: null }
    }
  });

  const hasAlignedMonthly = await tx.employeeMonthPlan.findFirst({
    where: {
      employeeKr: {
        employee_objective_id: employeeObjectiveId
      },
      aligned_manager_plan_id: { not: null }
    }
  });

  if (hasAlignedWeekly || hasAlignedMonthly) {
    console.log(`[RollupEngine] Objective ${employeeObjectiveId} has aligned weekly/monthly descendants. Skipping manager KR rollup to avoid duplication.`);
    return employeeObjectiveResult;
  }

  if (employeeObjective.chosen_parent_kr_id) {
    // chosen_parent_kr_id points to a CompanyKeyResult (department → CEO link).
    // Cascade: CompanyKR → CompanyObjective
    await rollupCompanyKR(employeeObjective.chosen_parent_kr_id, tx);

    const companyKr = await tx.companyKeyResult.findUnique({
      where: { id: employeeObjective.chosen_parent_kr_id },
      select: { objective_id: true },
    });
    if (companyKr?.objective_id) {
      await rollupCompanyObjective(companyKr.objective_id, tx);
    }
    return;
  } else if ((employeeObjective as any).chosen_parent_employee_kr_id) {
    // chosen_parent_employee_kr_id points to an EmployeeKeyResult (employee → dept KR link).
    // Cascade upward through the parent KR's objective.
    const parentKrId = (employeeObjective as any).chosen_parent_employee_kr_id;
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

// async function rollupWeeklyPlanFromDailies(
//   weeklyPlanId: number,
//   tx: any = prisma,
// ) {
//   const weekly = await tx.weeklyPlan.findUnique({
//     where: { id: weeklyPlanId },
//   });
//   if (!weekly) return;

//   const manager_weekly = await tx.weeklyPlan.findUnique({
//     where: { id: weekly.aligned_manager_plan_id },
//   });

//   const dailies = await tx.dailyPlan.findMany({
//     where: {
//       OR: [
//         { weekly_plan_id: weeklyPlanId },
//         { weeklyPlan: { aligned_manager_plan_id: weeklyPlanId } },
//       ],
//       contribute_to_score: true,
//     },
//     select: { progress_pct: true },
//   });

//   let progress: Decimal;
//   if (dailies.length === 0) {
//     progress = new Decimal(0);
//   } else {
//     // Daily plans are atomic units → equal weight (=1) per spec.
//     const total = dailies.reduce(
//       (sum: Decimal, d: any) => sum.add(decOrZero(d.progress_pct)),
//       new Decimal(0),
//     );
//     progress = total.div(dailies.length);
//   }
//   progress = clampPercent(progress);

//   const start = decOrZero(weekly.start_value);
//   const target = decOrZero(weekly.target_value);
//   const current = weekly.contribute_to_value
//     ? start.add(target.sub(start).mul(progress).div(100))
//     : decOrZero(weekly.current_value);

//   const updated = await tx.weeklyPlan.update({
//     where: { id: weeklyPlanId },
//     data: { progress_pct: progress, current_value: current },
//   });
//   let progress_percent: Decimal;

//   progress_percent = new Decimal(
//     (updated.current_value / manager_weekly.target_value) * 100,
//   );
//   progress_percent = clampPercent(progress_percent);
//   await tx.weeklyPlan.update({
//     where: { id: manager_weekly.id },
//     data: {
//       progress_pct: progress_percent,
//       current_value: weekly.current_value,
//     },
//   });
// }
async function rollupWeeklyPlanFromDailies(
  weeklyPlanId: number,
  tx: any = prisma,
) {
  const weekly = await tx.weeklyPlan.findUnique({
    where: { id: weeklyPlanId },
    include: { metricDefinition: true },
  });
  if (!weekly) {
    return;
  }

  const metric = weekly.metricDefinition;
  const isValueBased = isValueBasedProgressMetric(metric);

  console.log(`  - title: ${weekly.title}`);
  console.log(`  - start_value: ${weekly.start_value}, target_value: ${weekly.target_value}, current_value: ${weekly.current_value}`);
  console.log(`  - contribute_to_score: ${weekly.contribute_to_score}, contribute_to_value: ${weekly.contribute_to_value}`);
  console.log(`  - metricDefinition: ${metric ? JSON.stringify({ id: metric.id, name: metric.name, value_based_progress: metric.value_based_progress }) : 'NULL'}`);
  console.log(`  - isValueBased: ${isValueBased}`);
  console.log(`  - aligned_manager_plan_id: ${weekly.aligned_manager_plan_id}`);
  console.log(`  - employee_month_plan_id: ${weekly.employee_month_plan_id}`);

  // 1. Aggregate progress from this weekly's own direct dailies
  // IMPORTANT: Also query ALL dailies (without contribute filter) for debugging
  const allDailies = await tx.dailyPlan.findMany({
    where: { weekly_plan_id: weeklyPlanId },
    select: { id: true, title: true, progress_pct: true, current_value: true, target_value: true, start_value: true, contribute_to_score: true, contribute_to_value: true, status: true },
  });

  const dailies = allDailies.filter((d: any) => d.contribute_to_score || d.contribute_to_value);

  for (const d of allDailies as any[]) {
    console.log(`  - Daily id=${d.id} "${d.title}": current=${d.current_value}, target=${d.target_value}, start=${d.start_value}, progress=${d.progress_pct}, status=${d.status}, contribute_score=${d.contribute_to_score}, contribute_value=${d.contribute_to_value}`);
  }

  // 2. Aggregate progress from employee weekly plans aligned to this weekly.
  const alignedWeeklies = await tx.weeklyPlan.findMany({
    where: {
      aligned_manager_plan_id: weeklyPlanId,
      OR: [{ contribute_to_score: true }, { contribute_to_value: true }],
    },
    select: { id: true, progress_pct: true, current_value: true, contribute_to_score: true, contribute_to_value: true },
  });

  for (const aw of alignedWeeklies as any[]) {
    console.log(`  - Aligned Weekly id=${aw.id}: current=${aw.current_value}, progress=${aw.progress_pct}, contribute_score=${aw.contribute_to_score}, contribute_value=${aw.contribute_to_value}`);
  }

  let progress: Decimal = new Decimal(0);
  let current: Decimal = new Decimal(0);

  // Calculate employee's current value based on progress
  const start = decOrZero(weekly.start_value);
  const target = decOrZero(weekly.target_value);

  const hasChildren = dailies.length > 0 || alignedWeeklies.length > 0;

  if (!hasChildren) {
    current = decOrZero(weekly.current_value);
    const range = target.sub(start);
    if (range.gt(0)) {
      progress = clampPercent(current.sub(start).div(range).mul(100));
    } else {
      // Degenerate case (target <= start). 
      // For Milestone/Binary metrics, we check if current >= target AND target > 0.
      const isAchieved = target.gt(0) && current.gte(target);
      progress = new Decimal(isAchieved ? 100 : 0);
    }
  } else {
    if (isValueBased) {
      let totalValue = new Decimal(0);
      for (const d of dailies as any[]) {
        if (d.contribute_to_value) {
          totalValue = totalValue.add(decOrZero(d.current_value));
        }
      }
      for (const aw of alignedWeeklies as any[]) {
        if (aw.contribute_to_value) {
          totalValue = totalValue.add(decOrZero(aw.current_value));
        }
      }
      current = totalValue;
      const range = target.sub(start);
      progress = range.gt(0)
        ? clampPercent(current.sub(start).div(range).mul(100))
        : new Decimal(0);
    } else {
      const sources: Decimal[] = [
        ...dailies.filter((d: any) => d.contribute_to_score).map((d: any) => decOrZero(d.progress_pct)),
        ...alignedWeeklies.filter((aw: any) => aw.contribute_to_score).map((aw: any) => decOrZero(aw.progress_pct)),
      ];

      if (sources.length === 0) {
        progress = new Decimal(0);
      } else {
        if (metric?.allows_binary_completion) {
          const allCompleted = sources.every((p: Decimal) => p.gte(100));
          progress = allCompleted ? new Decimal(100) : new Decimal(0);
        } else {
          const total = sources.reduce((sum: Decimal, p: Decimal) => sum.add(p), new Decimal(0));
          progress = total.div(sources.length);
        }
      }
      progress = clampPercent(progress);

      // Even if it's score-based, it can contribute its own calculated current_value upward
      current = weekly.contribute_to_value
        ? start.add(target.sub(start).mul(progress).div(100))
        : decOrZero(weekly.current_value);
    }
  }

  // Update confidence level
  const companyId = await getCompanyIdForNode("weekly_plan", weeklyPlanId, tx);
  const confidence = await calculateConfidenceLevel(companyId, progress);


  // Update employee's weekly plan
  await tx.weeklyPlan.update({
    where: { id: weeklyPlanId },
    data: {
      progress_pct: progress,
      current_value: current,
      confidence_level: confidence
    },
  });


  // NOTE: Do NOT update the manager's weekly plan here. The cascade in
  // recalculateRollUp handles this correctly: after this function returns,
  // recalculateRollUp checks aligned_manager_plan_id and calls
  // rollupWeeklyPlanFromDailies(managerWeeklyPlanId), which aggregates
  // ALL aligned employee weekly plans via the alignedWeeklies query.
  // Previously, a direct update here would overwrite the aggregate with
  // only this single employee's contribution, breaking multi-employee rollup.
}
async function rollupMonthlyPlanFromWeeklies(
  monthlyPlanId: number,
  tx: any = prisma,
) {
  const monthly = await tx.employeeMonthPlan.findUnique({
    where: { id: monthlyPlanId },
    include: { metricDefinition: true },
  });
  if (!monthly) return;

  const metric = monthly.metricDefinition;
  const isValueBased = isValueBasedProgressMetric(metric);

  // 1. Aggregate from this monthly's own direct weeklies
  const weeklies = await tx.weeklyPlan.findMany({
    where: {
      employee_month_plan_id: monthlyPlanId,
      OR: [{ contribute_to_score: true }, { contribute_to_value: true }],
    },
    select: { id: true, progress_pct: true, weight_pct: true, current_value: true, contribute_to_score: true, contribute_to_value: true },
  });

  // 2. Aggregate from employee monthly plans aligned to this monthly.
  const rawAlignedMonthlies = await tx.employeeMonthPlan.findMany({
    where: {
      aligned_manager_plan_id: monthlyPlanId,
      OR: [{ contribute_to_score: true }, { contribute_to_value: true }],
    },
    select: { id: true, progress_pct: true, weight_pct: true, current_value: true, contribute_to_score: true, contribute_to_value: true },
  });

  console.log(`[RollupEngine] MonthlyPlan ${monthlyPlanId}: Found ${weeklies.length} weeklies and ${rawAlignedMonthlies.length} raw aligned monthlies`);

  // FILTER: Exclude any employee monthly plan if the employee ALSO aligned a weekly plan
  // to ANY of this manager's weekly plans. This prevents double-counting progress!
  const managerWeeklyIds = weeklies.map((w: any) => w.id);
  const alignedMonthlies: typeof rawAlignedMonthlies = [];
  for (const am of rawAlignedMonthlies) {
    if (managerWeeklyIds.length > 0) {
      const hasLowerAlignment = await tx.weeklyPlan.findFirst({
        where: {
          employee_month_plan_id: am.id,
          aligned_manager_plan_id: { in: managerWeeklyIds },
        },
      });
      if (hasLowerAlignment) {
        console.log(`[RollupEngine] MonthlyPlan ${monthlyPlanId}: Skipping aligned monthly ${am.id} due to lower-level weekly alignment.`);
        continue;
      }
    }
    alignedMonthlies.push(am);
  }

  let progress: Decimal;
  let current: Decimal;

  const start = decOrZero(monthly.start_value);
  const target = decOrZero(monthly.target_value);

  const hasChildren = weeklies.length > 0 || alignedMonthlies.length > 0;

  if (!hasChildren) {
    current = decOrZero(monthly.current_value);
    const range = target.sub(start);
    if (range.gt(0)) {
      progress = clampPercent(current.sub(start).div(range).mul(100));
    } else {
      // Degenerate case (target <= start).
      const isAchieved = target.gt(0) && current.gte(target);
      progress = new Decimal(isAchieved ? 100 : 0);
    }
  } else {
    if (isValueBased) {
      // SUM values for value-based metrics
      let totalValue = new Decimal(0);
      for (const w of weeklies as any[]) {
        if (w.contribute_to_value) {
          totalValue = totalValue.add(decOrZero(w.current_value));
        }
      }
      for (const am of alignedMonthlies as any[]) {
        if (am.contribute_to_value) {
          totalValue = totalValue.add(decOrZero(am.current_value));
        }
      }
      current = totalValue;
      const range = target.sub(start);
      progress = range.gt(0)
        ? clampPercent(current.sub(start).div(range).mul(100))
        : new Decimal(0);
      console.log(`[RollupEngine] MonthlyPlan ${monthlyPlanId} (Value-Based): TotalValue=${totalValue}, Progress=${progress}`);
    } else {
      // WEIGHTED AVERAGE for score-based metrics
      let weightedSum = new Decimal(0);
      let weightTotal = new Decimal(0);

      for (const w of weeklies as any[]) {
        if (w.contribute_to_score) {
          const wt = decOrZero(w.weight_pct);
          const pp = decOrZero(w.progress_pct);
          weightedSum = weightedSum.add(pp.mul(wt));
          weightTotal = weightTotal.add(wt);
        }
      }

      for (const am of alignedMonthlies as any[]) {
        if (am.contribute_to_score) {
          const wt = decOrZero(am.weight_pct);
          const pp = decOrZero(am.progress_pct);
          weightedSum = weightedSum.add(pp.mul(wt));
          weightTotal = weightTotal.add(wt);
        }
      }

      if (weightTotal.gt(0)) {
        if (metric?.allows_binary_completion) {
          // AND logic for milestone metrics when weights are used
          const allCompleted = [...weeklies, ...alignedMonthlies]
            .filter((p: any) => p.contribute_to_score)
            .every((p: any) => decOrZero(p.progress_pct).gte(100));
          progress = allCompleted ? new Decimal(100) : new Decimal(0);
        } else {
          progress = weightedSum.div(weightTotal);
        }
      } else if (weeklies.length + alignedMonthlies.length > 0) {
        const allProgress = [
          ...weeklies.filter((w: any) => w.contribute_to_score).map((w: any) => decOrZero(w.progress_pct)),
          ...alignedMonthlies.filter((am: any) => am.contribute_to_score).map((am: any) => decOrZero(am.progress_pct)),
        ];
        if (metric?.allows_binary_completion) {
          const allCompleted = allProgress.every((p: Decimal) => p.gte(100));
          progress = allCompleted ? new Decimal(100) : new Decimal(0);
        } else {
          const total = allProgress.reduce(
            (sum: Decimal, p: Decimal) => sum.add(p),
            new Decimal(0),
          );
          progress = total.div(allProgress.length);
        }
      } else {
        progress = new Decimal(0);
      }
      progress = clampPercent(progress);
      current = monthly.contribute_to_value
        ? start.add(target.sub(start).mul(progress).div(100))
        : decOrZero(monthly.current_value);
    }
  }

  // Update confidence level
  const companyId = await getCompanyIdForNode("monthly_plan", monthlyPlanId, tx);
  const confidence = await calculateConfidenceLevel(companyId, progress);

  await tx.employeeMonthPlan.update({
    where: { id: monthlyPlanId },
    data: {
      progress_pct: progress,
      current_value: current,
      // NOTE: EmployeeMonthPlan does NOT have a confidence_level field,
      // unlike WeeklyPlan and DailyPlan. Do not try to set it here.
    },
  });
}

export async function recalculateRollUp(
  nodeType: RollupNodeType,
  nodeId: number,
  tx?: any,
): Promise<void> {
  // Auto-wrap in a transaction when called without one, so the entire cascade
  // is atomic and partial failures don't leave inconsistent state.
  if (!tx) {
    return prisma.$transaction(
      async (txn) => recalculateRollUp(nodeType, nodeId, txn),
      { maxWait: 10000, timeout: 60000 },
    );
  }

  console.log(`[RollupEngine] Starting recalculateRollUp for ${nodeType} ID ${nodeId}`);
  try {
    switch (nodeType) {
      case "daily_plan": {
        const daily = await tx.dailyPlan.findUnique({
          where: { id: nodeId },
          select: { weekly_plan_id: true },
        });
        console.log(`[RollupEngine] DailyPlan ${nodeId} found parent WeeklyPlan ${daily?.weekly_plan_id}`);
        if (daily?.weekly_plan_id) {
          await recalculateRollUp("weekly_plan", daily.weekly_plan_id, tx);
        }
        break;
      }

      case "weekly_plan": {
        console.log(`[RollupEngine] Processing WeeklyPlan ${nodeId}`);
        await rollupWeeklyPlanFromDailies(nodeId, tx);

        const thisWeekly = await tx.weeklyPlan.findUnique({
          where: { id: nodeId },
          select: { employee_month_plan_id: true, aligned_manager_plan_id: true, current_value: true, progress_pct: true },
        });

        console.log(`[RollupEngine] WeeklyPlan ${nodeId} updated: value=${thisWeekly?.current_value}, progress=${thisWeekly?.progress_pct}`);

        if (thisWeekly?.aligned_manager_plan_id) {
          console.log(`[RollupEngine] WeeklyPlan ${nodeId} is ALIGNED to Manager WeeklyPlan ${thisWeekly.aligned_manager_plan_id}`);
          await recalculateRollUp("weekly_plan", thisWeekly.aligned_manager_plan_id, tx);
        }

        if (thisWeekly?.employee_month_plan_id) {
          console.log(`[RollupEngine] WeeklyPlan ${nodeId} is cascading to its own MonthlyPlan ${thisWeekly.employee_month_plan_id}`);
          await recalculateRollUp("monthly_plan", thisWeekly.employee_month_plan_id, tx);
        }
        break;
      }

      case "monthly_plan": {
        console.log(`[RollupEngine] Processing MonthlyPlan ${nodeId}`);
        await rollupMonthlyPlanFromWeeklies(nodeId, tx);

        const thisMonthly = await tx.employeeMonthPlan.findUnique({
          where: { id: nodeId },
          select: { employee_kr_id: true, aligned_manager_plan_id: true, current_value: true, progress_pct: true },
        });

        console.log(`[RollupEngine] MonthlyPlan ${nodeId} updated: value=${thisMonthly?.current_value}, progress=${thisMonthly?.progress_pct}`);

        if (thisMonthly?.aligned_manager_plan_id) {
          console.log(`[RollupEngine] MonthlyPlan ${nodeId} is ALIGNED to Manager MonthlyPlan ${thisMonthly.aligned_manager_plan_id}`);
          await recalculateRollUp("monthly_plan", thisMonthly.aligned_manager_plan_id, tx);
        }

        if (thisMonthly?.employee_kr_id) {
          console.log(`[RollupEngine] MonthlyPlan ${nodeId} is cascading to its own EmployeeKR ${thisMonthly.employee_kr_id}`);
          await recalculateRollUp("employee_key_result", thisMonthly.employee_kr_id, tx);
        }
        break;
      }

      case "employee_key_result": {
        console.log(`[RollupEngine] Processing EmployeeKR ${nodeId}`);
        await rollupEmployeeKR(nodeId, tx, true);
        const kr = await tx.employeeKeyResult.findUnique({
          where: { id: nodeId },
          select: { employee_objective_id: true, final_value: true, final_score: true },
        });

        console.log(`[RollupEngine] EmployeeKR ${nodeId} updated: value=${kr?.final_value}, score=${kr?.final_score}`);

        if (kr?.employee_objective_id) {
          await rollupEmployeeObjective(kr.employee_objective_id, tx, true);
          await recalculateRollUp(
            "employee_objective",
            kr.employee_objective_id,
            tx,
          );
        }
        break;
      }

      case "employee_objective": {
        await rollupFromEmployeeObjective(nodeId, tx);
        break;
      }

      case "company_key_result": {
        const kr = await tx.companyKeyResult.findUnique({
          where: { id: nodeId },
          select: { objective_id: true },
        });
        if (kr?.objective_id) {
          await rollupCompanyKR(nodeId, tx);
          await recalculateRollUp("company_objective", kr.objective_id, tx);
        }
        break;
      }

      case "company_objective": {
        await rollupCompanyObjective(nodeId, tx);
        break;
      }

      default:
        console.warn(`[RollupEngine] Unknown node type: ${nodeType}`);
    }
    console.log(`[RollupEngine] Finished direct rollup for ${nodeType} ID ${nodeId}`);
  } catch (error) {
    console.error(`[RollupEngine] ERROR in recalculateRollUp for ${nodeType} ID ${nodeId}:`, error);
    throw error;
  }
}

async function getCompanyIdForNode(
  nodeType: string,
  nodeId: number,
  tx: any = prisma,
): Promise<number> {
  try {
    if (nodeType === "weekly_plan") {
      const w = await tx.weeklyPlan.findUnique({
        where: { id: nodeId },
        select: {
          monthPlan: {
            select: {
              employeeKr: { select: { company_id: true } },
            },
          },
        },
      });
      return w?.monthPlan?.employeeKr?.company_id ?? 0;
    }
    if (nodeType === "monthly_plan") {
      const m = await tx.employeeMonthPlan.findUnique({
        where: { id: nodeId },
        select: { employeeKr: { select: { company_id: true } } },
      });
      return m?.employeeKr?.company_id ?? 0;
    }
    if (nodeType === "employee_key_result") {
      const kr = await tx.employeeKeyResult.findUnique({
        where: { id: nodeId },
        select: { company_id: true },
      });
      return kr?.company_id ?? 0;
    }
    return 0;
  } catch (error) {
    console.error(`[RollupEngine] Error fetching companyId for ${nodeType} ${nodeId}:`, error);
    return 0;
  }
}
