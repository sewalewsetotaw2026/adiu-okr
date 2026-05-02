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

/**
 * Normalised weighted average within a group.
 * Uses weight_percent if provided; otherwise falls back to target-proportional weights.
 * Formula: Σ(score_i × w_i) / Σ(w_i)  where w_i is normalised within this group only.
 */
function normalizedWeightedAvg(
  items: Array<{
    score: Decimal | null;
    weight: Decimal | null;
    target: Decimal | null;
  }>,
): Decimal {
  const valid = items.filter((i) => hasDecimal(i.score));
  if (valid.length === 0) return new Decimal(0);

  // Prefer explicit weight_percent
  const hasWeights = valid.every(
    (i) => hasDecimal(i.weight) && i.weight!.gt(0),
  );

  let effectiveWeights: Decimal[];

  if (hasWeights) {
    effectiveWeights = valid.map((i) => i.weight!);
  } else {
    // Target-proportional fallback
    const totalTarget = valid.reduce(
      (sum, i) => sum.add(toDecimal(i.target) ?? new Decimal(0)),
      new Decimal(0),
    );
    if (totalTarget.gt(0)) {
      effectiveWeights = valid.map((i) =>
        toDecimal(i.target)?.div(totalTarget).mul(100) ?? new Decimal(0),
      );
    } else {
      // Equal weight fallback
      const eq = new Decimal(100).div(valid.length);
      effectiveWeights = valid.map(() => eq);
    }
  }

  const totalW = effectiveWeights.reduce((s, w) => s.add(w), new Decimal(0));
  if (totalW.isZero()) return new Decimal(0);

  const weightedSum = valid.reduce(
    (sum, item, idx) => sum.add(item.score!.mul(effectiveWeights[idx])),
    new Decimal(0),
  );

  return clampPercent(weightedSum.div(totalW));
}

/**
 * Split a list of plan children into direct/indirect streams and compute
 * normalised weighted scores + summed values + summed targets for each stream.
 */
function splitAndScore(
  items: Array<{
    is_direct?: boolean | null;
    score: Decimal | null;
    value: Decimal | null;
    target: Decimal | null;
    weight: Decimal | null;
  }>,
): {
  directScore: Decimal;
  directValue: Decimal;
  directTarget: Decimal;
  indirectScore: Decimal;
  indirectValue: Decimal;
  indirectTarget: Decimal;
} {
  const direct = items.filter((i) => i.is_direct !== false);
  const indirect = items.filter((i) => i.is_direct === false);

  // Explicit Decimal accumulator ensures the return is always Decimal, never null
  const sumDecimals = (arr: Array<Decimal | null>): Decimal =>
    arr.reduce<Decimal>(
      (s: Decimal, v: Decimal | null) => s.add(v ?? new Decimal(0)),
      new Decimal(0),
    );

  return {
    directScore: normalizedWeightedAvg(direct),
    directValue: sumDecimals(direct.map((i) => i.value)),
    directTarget: sumDecimals(direct.map((i) => i.target)),
    indirectScore: normalizedWeightedAvg(indirect),
    indirectValue: sumDecimals(indirect.map((i) => i.value)),
    indirectTarget: sumDecimals(indirect.map((i) => i.target)),
  };
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
  const finalScore = toDecimal(node?.progress_percent);
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

    // ── Daily Plans → Tasks ────────────────────────────────────────────────
    for (const task of week.tasks ?? []) {
      const results = computeNodeScoreValue(
        task,
        task.metricDefinition ?? week.metricDefinition ?? metric,
      );

      const dailyItems = (task.dailyPlans ?? []).map((dp: any) => {
        const m = computeNodeScoreValue(
          dp,
          dp.metricDefinition ?? task.metricDefinition ?? week.metricDefinition ?? metric,
        );
        return {
          is_direct: dp.is_direct !== false,
          score: m.score,
          value: m.value,
          target: toDecimal(dp.target_value),
          weight: toDecimal(dp.weight_percent),
        };
      });

      const dailySplit = splitAndScore(dailyItems);

      // Task's own score/value come from direct dailies if available, else task itself
      const taskScore = dailySplit.directTarget.gt(0) ? dailySplit.directScore : results.score;
      const taskValue = dailySplit.directTarget.gt(0) ? dailySplit.directValue : results.value;

      // Persist task-level rollup including indirect
      await tx.weeklyTask.update({
        where: { id: task.id },
        data: {
          current_value: taskValue,
          progress_percent: taskScore,
        },
      });

      // Expose aggregated values for the next level
      (task as any)._directScore = taskScore;
      (task as any)._directValue = taskValue;
      (task as any)._directTarget = toDecimal(task.target_value);
      (task as any)._indirectScore = dailySplit.indirectScore;
      (task as any)._indirectValue = dailySplit.indirectValue;
      (task as any)._indirectTarget = dailySplit.indirectTarget;
    }

    // ── Tasks → Weekly Plan ───────────────────────────────────────────────
    const taskItems = (week.tasks ?? []).map((t: any) => ({
      is_direct: t.is_direct !== false,
      score: (t as any)._directScore ?? computeNodeScoreValue(t, week.metricDefinition ?? metric).score,
      value: (t as any)._directValue ?? computeNodeScoreValue(t, week.metricDefinition ?? metric).value,
      target: toDecimal(t.target_value),
      weight: toDecimal(t.weight_percent ?? null),
    }));

    const weekSplit = taskItems.length > 0
      ? splitAndScore(taskItems)
      : { directScore: base.score ?? new Decimal(0), directValue: base.value ?? new Decimal(0), directTarget: toDecimal(week.target_value) ?? new Decimal(0), indirectScore: new Decimal(0), indirectValue: new Decimal(0), indirectTarget: new Decimal(0) };

    // Collect indirect contributions from indirect tasks
    const indirectTaskItems = (week.tasks ?? [])
      .filter((t: any) => t.is_direct === false)
      .map((t: any) => ({
        is_direct: false as const,
        score: (t as any)._directScore ?? null,
        value: (t as any)._directValue ?? null,
        target: toDecimal(t.target_value),
        weight: toDecimal(t.weight_percent ?? null),
      }));
    // Merge: indirect stream = indirect tasks' direct scores + any nested indirect within those
    const finalIndirectScore = indirectTaskItems.length > 0
      ? normalizedWeightedAvg(indirectTaskItems.map((i: { score: Decimal | null; weight: Decimal | null; target: Decimal | null }) => ({ score: i.score, weight: i.weight, target: i.target })))
      : weekSplit.indirectScore;
    const finalIndirectValue = (week.tasks ?? []).filter((t: any) => t.is_direct === false)
      .reduce((s: Decimal, t: any) => s.add((t as any)._directValue ?? new Decimal(0)), new Decimal(0));
    const finalIndirectTarget = (week.tasks ?? []).filter((t: any) => t.is_direct === false)
      .reduce((s: Decimal, t: any) => s.add(toDecimal(t.target_value) ?? new Decimal(0)), new Decimal(0));

    // Also bubble up indirect captured within direct tasks (nested indirect daily plans)
    const nestedIndirectScore = (week.tasks ?? [])
      .filter((t: any) => t.is_direct !== false && (t as any)._indirectValue?.gt(0))
      .map((t: any) => (t as any)._indirectScore as Decimal)
      .filter(hasDecimal);
    const nestedIndirectValue = (week.tasks ?? [])
      .filter((t: any) => t.is_direct !== false)
      .reduce((s: Decimal, t: any) => s.add((t as any)._indirectValue ?? new Decimal(0)), new Decimal(0));
    const nestedIndirectTarget = (week.tasks ?? [])
      .filter((t: any) => t.is_direct !== false)
      .reduce((s: Decimal, t: any) => s.add((t as any)._indirectTarget ?? new Decimal(0)), new Decimal(0));

    const combinedIndirectScore = nestedIndirectScore.length > 0
      ? avgDecimals(nestedIndirectScore)
      : finalIndirectScore.gt(0) ? finalIndirectScore : new Decimal(0);
    const combinedIndirectValue = nestedIndirectValue.add(finalIndirectValue);
    const combinedIndirectTarget = nestedIndirectTarget.add(finalIndirectTarget);

    const totalTarget = (week.tasks || []).reduce(
      (sum: Decimal, t: any) => sum.add(toDecimal(t.target_value) ?? new Decimal(0)),
      new Decimal(0),
    );

    weeklyAggregates.push({
      ...week,
      aggregateScore: weekSplit.directScore.gt(0) ? weekSplit.directScore : (base.score ?? new Decimal(0)),
      aggregateValue: weekSplit.directTarget.gt(0) ? weekSplit.directValue : (base.value ?? new Decimal(0)),
      aggregateTarget: totalTarget.gt(0) ? totalTarget : (toDecimal(week.target_value) ?? new Decimal(0)),
      indirectScore: combinedIndirectScore.gt(0) ? combinedIndirectScore : null,
      indirectValue: combinedIndirectValue.gt(0) ? combinedIndirectValue : null,
      indirectTarget: combinedIndirectTarget.gt(0) ? combinedIndirectTarget : null,
    });
  }

  // Persist weekly aggregates back to WeeklyPlan records
  for (const week of weeklyAggregates) {
    const weekScore = week.aggregateScore ?? new Decimal(0);
    const weekValue = week.aggregateValue;

    await tx.weeklyPlan.update({
      where: { id: week.id },
      data: {
        progress_percent: weekScore,
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

    // ── Weekly Plans → Monthly Plan Item ─────────────────────────────────
    const weekItems = linkedWeeks.map((w: any) => ({
      is_direct: w.is_direct !== false,
      score: w.aggregateScore ?? null,
      value: w.aggregateValue ?? null,
      target: w.aggregateTarget ?? toDecimal(w.target_value),
      weight: toDecimal(w.weight_percent),
    }));

    const weekSplit = weekItems.length > 0 ? splitAndScore(weekItems) : null;

    // Bubble indirect scores from nested weekly indirect streams
    const nestedIndirectScores = linkedWeeks
      .filter((w: any) => hasDecimal(w.indirectScore))
      .map((w: any) => ({ score: w.indirectScore as Decimal, target: w.indirectTarget ? toDecimal(w.indirectTarget) : null, weight: null as Decimal | null }));
    const nestedIndirectValues = linkedWeeks.reduce(
      (s: Decimal, w: any) => s.add(toDecimal(w.indirectValue) ?? new Decimal(0)),
      new Decimal(0),
    );
    const nestedIndirectTargets = linkedWeeks.reduce(
      (s: Decimal, w: any) => s.add(toDecimal(w.indirectTarget) ?? new Decimal(0)),
      new Decimal(0),
    );

    const indirectScoreForItem = weekSplit && weekSplit.indirectScore.gt(0)
      ? weekSplit.indirectScore
      : nestedIndirectScores.length > 0
        ? normalizedWeightedAvg(nestedIndirectScores)
        : new Decimal(0);
    const indirectValueForItem = (weekSplit?.indirectValue ?? new Decimal(0)).add(nestedIndirectValues);
    const indirectTargetForItem = (weekSplit?.indirectTarget ?? new Decimal(0)).add(nestedIndirectTargets);

    return {
      ...item,
      monthPlanId: month.id,
      aggregateScore: weekSplit && weekSplit.directTarget.gt(0)
        ? weekSplit.directScore
        : base.score,
      aggregateValue: weekSplit && weekSplit.directTarget.gt(0)
        ? weekSplit.directValue
        : base.value,
      aggregateTarget: weekSplit?.directTarget.gt(0)
        ? weekSplit.directTarget
        : (toDecimal(item.target_value) ?? new Decimal(0)),
      indirectScore: indirectScoreForItem.gt(0) ? indirectScoreForItem : null,
      indirectValue: indirectValueForItem.gt(0) ? indirectValueForItem : null,
      indirectTarget: indirectTargetForItem.gt(0) ? indirectTargetForItem : null,
    };
  });

  // ── Monthly Items → KR score ───────────────────────────────────────────
  const monthItemsForKr = monthlyAggregates.map((m: any) => ({
    is_direct: m.is_direct !== false,
    score: m.aggregateScore ?? null,
    value: m.aggregateValue ?? null,
    target: m.aggregateTarget ?? toDecimal(m.target_value),
    weight: toDecimal(m.weight_percent),
  }));

  const monthSplit = monthItemsForKr.length > 0 ? splitAndScore(monthItemsForKr) : null;

  // Bubble nested indirect from monthly items
  const monthNestedIndirectScore = monthlyAggregates
    .filter((m: any) => hasDecimal(m.indirectScore))
    .map((m: any) => ({ score: m.indirectScore as Decimal, target: m.indirectTarget ? toDecimal(m.indirectTarget) : null, weight: null as Decimal | null }));
  const monthNestedIndirectValue = monthlyAggregates.reduce(
    (s: Decimal, m: any) => s.add(toDecimal(m.indirectValue) ?? new Decimal(0)), new Decimal(0),
  );
  const monthNestedIndirectTarget = monthlyAggregates.reduce(
    (s: Decimal, m: any) => s.add(toDecimal(m.indirectTarget) ?? new Decimal(0)), new Decimal(0),
  );

  const hasMonthAggregateData = monthSplit !== null && (monthSplit.directTarget.gt(0) || monthSplit.indirectTarget.gt(0));

  if (hasMonthAggregateData && monthSplit) {
    score = monthSplit.directScore.gt(0) ? monthSplit.directScore : null;
    value = monthSplit.directTarget.gt(0) ? monthSplit.directValue : null;
    indirectScore = monthSplit.indirectScore.gt(0)
      ? monthSplit.indirectScore
      : monthNestedIndirectScore.length > 0
        ? normalizedWeightedAvg(monthNestedIndirectScore)
        : null;
    indirectValue = monthSplit.indirectValue.add(monthNestedIndirectValue).gt(0)
      ? monthSplit.indirectValue.add(monthNestedIndirectValue)
      : null;
    indirectValue = indirectValue
      ? indirectValue.add(monthNestedIndirectValue.gt(0) ? new Decimal(0) : new Decimal(0))
      : null;
  } else {
    const weekScoreCandidates = weeklyAggregates
      .filter(
        (w: any) =>
          w.is_direct !== false &&
          hasDecimal(w.aggregateScore),
      )
      .map((w: any) => w.aggregateScore as Decimal);
    const weekValueCandidates = weeklyAggregates
      .filter(
        (w: any) =>
          w.is_direct !== false &&
          hasDecimal(w.aggregateValue),
      )
      .map((w: any) => w.aggregateValue as Decimal);

    // ── Week-only fallback (no monthly items) ──────────────────────────────
    const weekItemsFallback = weeklyAggregates.map((w: any) => ({
      is_direct: w.is_direct !== false,
      score: w.aggregateScore ?? null,
      value: w.aggregateValue ?? null,
      target: w.aggregateTarget ?? toDecimal(w.target_value),
      weight: toDecimal(w.weight_percent),
    }));

    const weekFallbackSplit = weekItemsFallback.length > 0 ? splitAndScore(weekItemsFallback) : null;

    const weekFallbackNestedIndirectScore = weeklyAggregates
      .filter((w: any) => hasDecimal(w.indirectScore))
      .map((w: any) => ({ score: w.indirectScore as Decimal, target: toDecimal(w.indirectTarget), weight: null as Decimal | null }));
    const weekFallbackNestedIndirectValue = weeklyAggregates.reduce(
      (s: Decimal, w: any) => s.add(toDecimal(w.indirectValue) ?? new Decimal(0)), new Decimal(0),
    );

    const hasWeekAggregateData = weekFallbackSplit !== null &&
      (weekFallbackSplit.directTarget.gt(0) || weekFallbackSplit.indirectTarget.gt(0));

    if (hasWeekAggregateData && weekFallbackSplit) {
      score = weekFallbackSplit.directScore.gt(0) ? weekFallbackSplit.directScore : null;
      value = weekFallbackSplit.directTarget.gt(0) ? weekFallbackSplit.directValue : null;
      indirectScore = weekFallbackSplit.indirectScore.gt(0)
        ? weekFallbackSplit.indirectScore
        : weekFallbackNestedIndirectScore.length > 0
          ? normalizedWeightedAvg(weekFallbackNestedIndirectScore)
          : null;
      indirectValue = weekFallbackSplit.indirectValue.add(weekFallbackNestedIndirectValue).gt(0)
        ? weekFallbackSplit.indirectValue.add(weekFallbackNestedIndirectValue)
        : null;
    } else if (kr.subtasks.length > 0) {
      const subtaskItems = kr.subtasks.map((task: any) => {
        const result = computeNodeScoreValue(task, task.metricDefinition ?? metric);
        return {
          is_direct: task.is_direct !== false,
          score: result.score,
          value: result.value,
          target: toDecimal(task.target_value),
          weight: toDecimal(task.weight_percent),
        };
      });

      const subtaskSplit = splitAndScore(subtaskItems);
      if (subtaskSplit.directTarget.gt(0) || subtaskSplit.directScore.gt(0)) {
        score = subtaskSplit.directScore.gt(0) ? subtaskSplit.directScore : null;
        value = subtaskSplit.directTarget.gt(0) ? subtaskSplit.directValue : null;
        indirectScore = subtaskSplit.indirectScore.gt(0) ? subtaskSplit.indirectScore : null;
        indirectValue = subtaskSplit.indirectValue.gt(0) ? subtaskSplit.indirectValue : null;
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
      progress_percent: score,
      current_value: value,
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
        progress_percent: week.aggregateScore,
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
 * Uses weighted average of KR scores where is_direct=true.
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

  // Weighted average for score — direct KRs only, normalised within direct group
  let totalDirectWeight = new Decimal(0);
  let weightedDirectScoreSum = new Decimal(0);
  let totalValue = new Decimal(0);
  let totalTarget = new Decimal(0);
  // Indirect: collect with weights for normalised avg
  let allMandatoryComplete = true;

  for (const kr of updatedKRs) {
    const weight = toDecimal(kr.normalized_weight) ?? new Decimal(0);
    const score = toDecimal(kr.progress_percent) ?? new Decimal(0);

    if (kr.is_direct !== false && kr.metricDefinition?.supports_value_rollup) {
      if (isParentFinancial) {
        if (kr.metricDefinition.is_financial) totalValue = totalValue.add(getRollupValue(kr));
      } else {
        totalValue = totalValue.add(getRollupValue(kr));
      }
      totalTarget = totalTarget.add(toDecimal(kr.target_value) ?? new Decimal(0));
    }

    if (kr.is_mandatory_for_completion && (!kr.progress_percent || toDecimal(kr.progress_percent)!.lt(100))) {
      allMandatoryComplete = false;
    }
  }

  const existingTarget = toDecimal(objective.target_value) ?? new Decimal(0);
  const progressPercent = existingTarget.gt(0)
    ? totalValue.div(existingTarget).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await tx.employeeObjective.update({
    where: { id: objectiveId },
    data: {
      current_value: totalValue,
      progress_percent: progressPercent,
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

    const directItems = plan.items.filter((i: any) => i.is_direct !== false);
    const indirectItems = plan.items.filter((i: any) => i.is_direct === false);

    const directItemNodes = directItems.map((i: any) => ({
      is_direct: true as const,
      score: i.target_value && new Decimal(i.target_value).gt(0)
        ? clampPercent(new Decimal(i.current_value || 0).div(new Decimal(i.target_value)).mul(100))
        : null,
      value: toDecimal(i.current_value),
      target: toDecimal(i.target_value),
      weight: toDecimal(i.weight_percent ?? null),
    }));
    const indirectItemNodes = indirectItems.map((i: any) => ({
      is_direct: false as const,
      score: i.target_value && new Decimal(i.target_value).gt(0)
        ? clampPercent(new Decimal(i.current_value || 0).div(new Decimal(i.target_value)).mul(100))
        : null,
      value: toDecimal(i.current_value),
      target: toDecimal(i.target_value),
      weight: toDecimal(i.weight_percent ?? null),
    }));

    const planScore = normalizedWeightedAvg(directItemNodes);
    const planIndirectScore = normalizedWeightedAvg(indirectItemNodes);

    const planValue = directItems.reduce(
      (sum: Decimal, i: any) => sum.add(new Decimal(i.current_value || 0)),
      new Decimal(0),
    );
    const planIndirectValue = indirectItems.reduce(
      (sum: Decimal, i: any) => sum.add(new Decimal(i.current_value || 0)),
      new Decimal(0),
    );
    const planTarget = directItems.reduce(
      (sum: Decimal, i: any) => sum.add(new Decimal(i.target_value || 0)),
      new Decimal(0),
    );
    const planIndirectTarget = indirectItems.reduce(
      (sum: Decimal, i: any) => sum.add(new Decimal(i.target_value || 0)),
      new Decimal(0),
    );
    const planProgress = planTarget.gt(0)
      ? planValue.div(planTarget).mul(100).toDecimalPlaces(2)
      : new Decimal(0);

    await tx.employeeMonthPlan.update({
      where: { id: plan.id },
      data: {
        current_value: planValue,
        progress_percent: planProgress,
      },
    });
  }

  return {
    objectiveId,
    progressPercent,
    finalValue: totalValue,
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
              is_direct: true,
              progress_percent: true,
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
              is_direct: true,
              progress_percent: true,
              current_value: true,
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
      if ((empObj as any).is_direct !== false) {
        if (empObj.progress_percent) allScores.push(empObj.progress_percent);
        totalValue = totalValue.add(getRollupValue(empObj));
      }
    }
  }

  let avgScore = new Decimal(0);

  if (allScores.length > 0) {
    avgScore = allScores
      .reduce((sum, s) => sum.add(s), new Decimal(0))
      .div(allScores.length);
  } else {
    // Fallback to own plans/subtasks if no contributors
    const results = await computeEmployeeKRScore(employeeKrId, tx);
    avgScore = results.score;
    totalValue = results.value ?? new Decimal(0);
  }

  await tx.employeeKeyResult.update({
    where: { id: employeeKrId },
    data: {
      progress_percent: avgScore,
      current_value: totalValue,
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
      is_direct: true,
      progress_percent: true,
      current_value: true,
    },
  });

  let totalValue = new Decimal(0);
  const scores: Decimal[] = [];
  for (const o of refreshedDeptObjs) {
    if ((o as any).is_direct !== false) {
      if (o.progress_percent) scores.push(o.progress_percent);
      totalValue = totalValue.add(getRollupValue(o));
    }
  }

  const avgScore =
    scores.length > 0
      ? scores
        .reduce((sum: Decimal, s: Decimal) => sum.add(s), new Decimal(0))
        .div(scores.length)
      : new Decimal(0);



  const existingTarget = toDecimal(companyKr.target_value) ?? new Decimal(0);
  const progressPercent = existingTarget.gt(0)
    ? totalValue.div(existingTarget).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await tx.companyKeyResult.update({
    where: { id: companyKrId },
    data: {
      progress_percent: progressPercent,
      current_value: totalValue,
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

  let totalValue = new Decimal(0);
  let totalTarget = new Decimal(0);

  for (const kr of updatedKRs) {
    if (kr.is_direct !== false && kr.metricDefinition?.supports_value_rollup) {
      totalValue = totalValue.add(getRollupValue(kr));
      totalTarget = totalTarget.add(toDecimal(kr.target_value) ?? new Decimal(0));
    }
  }

  const existingTarget = toDecimal(objective.target_value) ?? new Decimal(0);
  const progressPercent = existingTarget.gt(0)
    ? totalValue.div(existingTarget).mul(100).toDecimalPlaces(2)
    : new Decimal(0);

  await tx.companyObjective.update({
    where: { id: companyObjectiveId },
    data: {
      current_value: totalValue,
      progress_percent: progressPercent,
    },
  });

  return {
    companyObjectiveId,
    progressPercent,
    finalValue: totalValue,
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
          is_direct: true,
        },
      });
      const companyObjCurrent = siblingKrs.reduce((sum: Decimal, kr: any) => {
        if (kr.is_direct === false) return sum;
        return sum.add(toDecimal(kr.current_value) ?? new Decimal(0));
      }, new Decimal(0));
      const companyObjTarget = siblingKrs.reduce((sum: Decimal, kr: any) => {
        if (kr.is_direct === false) return sum;
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
          is_direct: true,
        },
      });
      const parentObjCurrent = parentObjKrs.reduce((sum: Decimal, kr: any) => {
        if (kr.is_direct === false) return sum;
        return sum.add(toDecimal(kr.current_value) ?? new Decimal(0));
      }, new Decimal(0));
      const parentObjTarget = parentObjKrs.reduce((sum: Decimal, kr: any) => {
        if (kr.is_direct === false) return sum;
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
      is_direct: true,
    },
  });

  const objectiveCurrent = objectiveKrs.reduce((sum: Decimal, kr: any) => {
    if (kr.is_direct === false) return sum;
    return sum.add(toDecimal(kr.current_value) ?? new Decimal(0));
  }, new Decimal(0));
  const objectiveTarget = objectiveKrs.reduce((sum: Decimal, kr: any) => {
    if (kr.is_direct === false) return sum;
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
      (kr) => kr.progress_percent && kr.progress_percent.gte(100),
    );
    const totalKRs = krs.length;
    const completedKRs = krs.filter(
      (kr) => kr.progress_percent && kr.progress_percent.gte(100),
    ).length;

    return {
      entityId,
      level,
      totalKRs,
      completedKRs,
      mandatoryKRs: mandatoryKRs.length,
      mandatoryCompleted: mandatoryKRs.filter(
        (kr) => kr.progress_percent && kr.progress_percent.gte(100),
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
      (kr) => kr.progress_percent && kr.progress_percent.gte(100),
    );
    const totalKRs = krs.length;
    const completedKRs = krs.filter(
      (kr) => kr.progress_percent && kr.progress_percent.gte(100),
    ).length;

    return {
      entityId,
      level,
      totalKRs,
      completedKRs,
      mandatoryKRs: mandatoryKRs.length,
      mandatoryCompleted: mandatoryKRs.filter(
        (kr) => kr.progress_percent && kr.progress_percent.gte(100),
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
    (kr) => kr.progress_percent && kr.progress_percent.gte(100),
  );
  const totalKRs = krs.length;
  const completedKRs = krs.filter(
    (kr) => kr.progress_percent && kr.progress_percent.gte(100),
  ).length;

  return {
    entityId,
    level,
    totalKRs,
    completedKRs,
    mandatoryKRs: mandatoryKRs.length,
    mandatoryCompleted: mandatoryKRs.filter(
      (kr) => kr.progress_percent && kr.progress_percent.gte(100),
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
          (sum, kr) => sum.add(kr.progress_percent ?? new Decimal(0)),
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
        score: kr.progress_percent,
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
        score: kr.progress_percent,
        value: kr.current_value,
      })),
    },
  };
}
