/**
 * OKR Planning Service — corrected hierarchy.
 *
 *   QuarterlyKR (EmployeeKeyResult)
 *        └─ MonthlyPlan (EmployeeMonthPlan)
 *               └─ WeeklyPlan
 *                      └─ DailyPlan
 *
 * Weight allocations are tracked in the okr_weight_allocations table
 * to prevent over-decomposition.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "src/app";
import { recalculateRollUp } from "src/services/okrRollupService";

// ────────────────────────── Types ──────────────────────────────────────

type AdoptionMode = "DIRECT" | "DECOMPOSED";

export interface CreateMonthlyPlanInput {
  krId: number;
  companyId: number;
  ownerId: string;
  monthNumber: number;
  adoptionMode: AdoptionMode;
  weightPct?: number;
  title: string;
  description?: string | null;
  metric_definition_id?: number | null;
  start_value?: number;
  target_value?: number;
  contribute_to_score?: boolean;
  contribute_to_value?: boolean;
}

export interface CreateWeeklyPlanInput {
  monthlyPlanId: number;
  companyId: number;
  ownerId: string;
  weekNumber: number;
  adoptionMode: AdoptionMode;
  weightPct?: number;
  title: string;
  metric_definition_id?: number | null;
  start_value?: number;
  target_value?: number;
  contribute_to_score?: boolean;
  contribute_to_value?: boolean;
}

export interface CreateDailyPlanInput {
  weeklyPlanId: number;
  companyId: number;
  ownerId: string;
  completionDay:
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";
  title: string;
  targetValue?: number;
  startValue?: number;
  metric_definition_id?: number | null;
  contributeToScore?: boolean;
  contributeToValue?: boolean;
  description?: string | null;
}

// ──────────────────── Helpers / Validation ─────────────────────────────

const dec = (n: number | string | Prisma.Decimal | null | undefined) => {
  if (n === null || n === undefined) return null;
  return new Prisma.Decimal(n as any);
};

const decToNumber = (d: Prisma.Decimal | null | undefined): number => {
  if (d === null || d === undefined) return 0;
  return Number(d.toString());
};

/**
 * Returns the percentage of a parent that has NOT yet been allocated to
 * children. parent_type='KEY_RESULT' tracks monthly children;
 * parent_type='MONTHLY_PLAN' tracks weekly children.
 */
export async function getAvailableWeight(
  parentId: number,
  parentType: "KEY_RESULT" | "MONTHLY_PLAN",
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ allocatedPct: number; remainingPct: number }> {
  const rows = await tx.okrWeightAllocation.findMany({
    where: { parent_id: parentId, parent_type: parentType },
    select: { weight_pct: true },
  });
  const allocated = rows.reduce(
    (sum, r) => sum + decToNumber(r.weight_pct as any),
    0,
  );
  const remaining = Math.max(0, 100 - allocated);
  return {
    allocatedPct: Number(allocated.toFixed(2)),
    remainingPct: Number(remaining.toFixed(2)),
  };
}

const PLANNABLE_STATUSES = ["published", "approved", "active"];

async function ensureKrPublishedAndOwned(krId: number, ownerId: string) {
  const kr = await prisma.employeeKeyResult.findUnique({
    where: { id: krId },
    include: { employeeObjective: true },
  });
  if (!kr) throw new Error("Key result not found.");
  if (kr.employeeObjective.user_id !== ownerId) {
    throw new Error("Not authorized — key result does not belong to you.");
  }
  if (
    !PLANNABLE_STATUSES.includes(kr.status_code) ||
    !PLANNABLE_STATUSES.includes(kr.employeeObjective.status_code)
  ) {
    throw new Error(
      `Parent quarterly OKR must be published before planning (KR: "${kr.status_code}", Objective: "${kr.employeeObjective.status_code}"). Please publish your OKR first.`,
    );
  }
  return kr;
}

async function ensureKrOwned(krId: number, ownerId: string) {
  const kr = await prisma.employeeKeyResult.findUnique({
    where: { id: krId },
    include: { employeeObjective: true },
  });
  if (!kr) throw new Error("Key result not found.");
  if (kr.employeeObjective.user_id !== ownerId) {
    throw new Error("Not authorized — key result does not belong to you.");
  }
  return kr;
}

async function ensureMonthlyPublishedAndOwned(
  monthlyId: number,
  ownerId: string,
) {
  const monthly = await prisma.employeeMonthPlan.findUnique({
    where: { id: monthlyId },
    include: { employeeKr: { include: { employeeObjective: true } } },
  });
  if (!monthly) throw new Error("Monthly plan not found.");
  if (monthly.owner_id !== ownerId) {
    throw new Error("Not authorized — monthly plan does not belong to you.");
  }
  if (monthly.plan_status !== "PUBLISHED") {
    throw new Error("Parent monthly plan is not yet published.");
  }
  return monthly;
}

async function ensureMonthlyOwned(monthlyId: number, ownerId: string) {
  const monthly = await prisma.employeeMonthPlan.findUnique({
    where: { id: monthlyId },
  });
  if (!monthly) throw new Error("Monthly plan not found.");
  if (monthly.owner_id !== ownerId) {
    throw new Error("Not authorized — monthly plan does not belong to you.");
  }
  return monthly;
}

async function ensureWeeklyPublishedAndOwned(
  weeklyId: number,
  ownerId: string,
) {
  const weekly = await prisma.weeklyPlan.findUnique({
    where: { id: weeklyId },
    include: { monthPlan: true },
  });
  if (!weekly) throw new Error("Weekly plan not found.");
  if (weekly.owner_id !== ownerId) {
    throw new Error("Not authorized — weekly plan does not belong to you.");
  }
  if (weekly.plan_status !== "PUBLISHED") {
    throw new Error("Parent weekly plan is not yet published.");
  }
  return weekly;
}

async function ensureWeeklyOwned(weeklyId: number, ownerId: string) {
  const weekly = await prisma.weeklyPlan.findUnique({
    where: { id: weeklyId },
  });
  if (!weekly) throw new Error("Weekly plan not found.");
  if (weekly.owner_id !== ownerId) {
    throw new Error("Not authorized — weekly plan does not belong to you.");
  }
  return weekly;
}

// ─────────────── MONTHLY PLAN ───────────────────────────────────────────

export async function listMonthlyPlansForKr(krId: number, ownerId: string) {
  await ensureKrOwned(krId, ownerId);
  const plans = await prisma.employeeMonthPlan.findMany({
    where: { employee_kr_id: krId },
    orderBy: [{ month_number: "asc" }, { id: "asc" }],
    include: {
      employeeKr: {
        select: {
          id: true,
          title: true,
          unit_of_measure: true,
        },
      },
    },
  });
  const { allocatedPct, remainingPct } = await getAvailableWeight(
    krId,
    "KEY_RESULT",
  );
  return {
    plans: plans.map((p) => ({
      ...p,
      parent_key_result: p.employeeKr
        ? { id: p.employeeKr.id, title: p.employeeKr.title, unit: p.employeeKr.unit_of_measure }
        : null,
      weight_remaining_pct: remainingPct,
    })),
    allocated_pct: allocatedPct,
    weight_remaining_pct: remainingPct,
  };
}

export async function getKrAvailableWeight(krId: number, ownerId: string) {
  await ensureKrOwned(krId, ownerId);
  const { allocatedPct, remainingPct } = await getAvailableWeight(
    krId,
    "KEY_RESULT",
  );
  const months = await prisma.employeeMonthPlan.findMany({
    where: { employee_kr_id: krId },
    select: {
      id: true,
      month_number: true,
      weight_pct: true,
      title: true,
      plan_status: true,
    },
    orderBy: { month_number: "asc" },
  });
  const monthRows = [1, 2, 3].map((monthNumber) => {
    const plansForMonth = months.filter((m) => m.month_number === monthNumber);
    const firstPlan = plansForMonth[0];
    return {
      month_number: monthNumber,
      allocated_pct: plansForMonth.reduce((sum, p) => sum + decToNumber(p.weight_pct as any), 0),
      plan_id: firstPlan ? firstPlan.id : null,
      plan_count: plansForMonth.length,
      title: firstPlan?.title ?? null,
      plan_status: firstPlan?.plan_status ?? null,
    };
  });
  return {
    allocated_pct: allocatedPct,
    remaining_pct: remainingPct,
    months: monthRows,
  };
}

export async function createMonthlyPlan(input: CreateMonthlyPlanInput) {
  const {
    krId,
    companyId,
    ownerId,
    monthNumber,
    adoptionMode,
    weightPct,
    title,
    description,
    metric_definition_id,
    start_value,
    target_value,
    contribute_to_score,
    contribute_to_value,
  } = input;

  if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 3) {
    throw new Error("month_number must be between 1 and 3.");
  }
  if (!title?.trim()) throw new Error("title is required.");

  const kr = await ensureKrPublishedAndOwned(krId, ownerId);

  const krProgress = decToNumber(kr.final_score as any);
  if (krProgress >= 100) {
    throw new Error(
      "Parent key result is already 100% complete — nothing left to plan.",
    );
  }

  let resolvedWeight: number;
  if (adoptionMode === "DIRECT") {
    const existing = await prisma.employeeMonthPlan.count({
      where: { employee_kr_id: krId },
    });
    if (existing > 0) {
      throw new Error(
        "Direct adoption is only allowed when no monthly plan exists for this key result.",
      );
    }
    resolvedWeight = 100;
  } else {
    if (
      typeof weightPct !== "number" ||
      Number.isNaN(weightPct) ||
      weightPct <= 0 ||
      weightPct > 100
    ) {
      throw new Error("weight_pct must be a number between 1 and 100.");
    }
    const { remainingPct } = await getAvailableWeight(krId, "KEY_RESULT");
    if (weightPct > remainingPct + 0.001) {
      throw new Error(
        `Only ${remainingPct.toFixed(2)}% remaining for this key result.`,
      );
    }
    resolvedWeight = weightPct;
  }

  const krStart = start_value ?? 0; // fallback to 0 if not provided
  const autoKrTarget = decToNumber(kr.target_value as any);
  const autoMonthTarget = krStart + ((autoKrTarget - 0) * resolvedWeight) / 100;
  const finalTarget = target_value ?? autoMonthTarget;

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.employeeMonthPlan.create({
      data: {
        company_id: companyId,
        cycle_id: kr.employeeObjective.cycle_id,
        employee_kr_id: krId,
        owner_id: ownerId,
        month_number: monthNumber,
        title: title.trim(),
        description: description ?? null,
        adoption_mode: adoptionMode,
        weight_pct: dec(resolvedWeight)!,
        start_value: dec(krStart),
        target_value: dec(finalTarget),
        current_value: dec(krStart),
        progress_pct: dec(0),
        plan_status: "DRAFT",
        created_by: ownerId,
        metric_definition_id: metric_definition_id ?? kr.metric_definition_id,
        contribute_to_score: contribute_to_score ?? true,
        contribute_to_value: contribute_to_value ?? true,
      },
    });

    await tx.okrWeightAllocation.create({
      data: {
        company_id: companyId,
        parent_id: krId,
        parent_type: "KEY_RESULT",
        child_id: plan.id,
        child_type: "MONTHLY_PLAN",
        weight_pct: dec(resolvedWeight)!,
      },
    });
    return plan;
  });

  // Trigger upward roll-up so the KR reflects the newly added planned weight.
  await recalculateRollUp("employee_key_result", krId).catch(() => { });

  return created;
}

export async function updateMonthlyPlan(
  id: number,
  ownerId: string,
  patch: {
    title?: string;
    description?: string | null;
    metric_definition_id?: number | null;
    start_value?: number;
    target_value?: number;
    contribute_to_score?: boolean;
    contribute_to_value?: boolean;
  },
) {
  const plan = await prisma.employeeMonthPlan.findUnique({ where: { id } });
  if (!plan) throw new Error("Monthly plan not found.");
  if (plan.owner_id !== ownerId)
    throw new Error("Not authorized — plan does not belong to you.");
  if (
    !["DRAFT", "REJECTED"].includes(plan.plan_status as unknown as string) &&
    patch.title === undefined &&
    patch.description === undefined &&
    patch.metric_definition_id === undefined &&
    patch.start_value === undefined &&
    patch.target_value === undefined &&
    patch.contribute_to_score === undefined &&
    patch.contribute_to_value === undefined
  ) {
    // no-op — but allow editing meta-only fields any time
  }
  const updated = await prisma.employeeMonthPlan.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description }
        : {}),
      ...(patch.metric_definition_id !== undefined ? { metric_definition_id: patch.metric_definition_id } : {}),
      ...(patch.start_value !== undefined ? { start_value: dec(patch.start_value) } : {}),
      ...(patch.target_value !== undefined ? { target_value: dec(patch.target_value) } : {}),
      ...(patch.contribute_to_score !== undefined ? { contribute_to_score: patch.contribute_to_score } : {}),
      ...(patch.contribute_to_value !== undefined ? { contribute_to_value: patch.contribute_to_value } : {}),
    },
  });
  if (
    patch.target_value !== undefined ||
    patch.start_value !== undefined ||
    patch.contribute_to_score !== undefined ||
    patch.contribute_to_value !== undefined
  ) {
    await recalculateRollUp("employee_key_result", plan.employee_kr_id).catch(() => { });
  }
  return updated;
}

export async function deleteMonthlyPlan(id: number, ownerId: string) {
  const plan = await prisma.employeeMonthPlan.findUnique({ where: { id } });
  if (!plan) throw new Error("Monthly plan not found.");
  if (plan.owner_id !== ownerId)
    throw new Error("Not authorized — plan does not belong to you.");
  if (
    ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PUBLISHED"].includes(
      plan.plan_status as unknown as string,
    )
  ) {
    throw new Error(
      `Cannot delete monthly plan in status ${plan.plan_status}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.okrWeightAllocation.deleteMany({
      where: {
        parent_id: plan.employee_kr_id,
        parent_type: "KEY_RESULT",
        child_id: id,
        child_type: "MONTHLY_PLAN",
      },
    });
    await tx.employeeMonthPlan.delete({ where: { id } });
  });

  await recalculateRollUp("employee_key_result", plan.employee_kr_id).catch(
    () => { },
  );
  return { ok: true };
}

// ─────────────── WEEKLY PLAN ───────────────────────────────────────────

export async function listWeeklyPlansForMonthly(
  monthlyId: number,
  ownerId: string,
) {
  await ensureMonthlyOwned(monthlyId, ownerId);
  const plans = await prisma.weeklyPlan.findMany({
    where: { employee_month_plan_id: monthlyId },
    orderBy: [{ week_number: "asc" }, { id: "asc" }],
  });
  const { allocatedPct, remainingPct } = await getAvailableWeight(
    monthlyId,
    "MONTHLY_PLAN",
  );
  return {
    plans: plans.map((p) => ({ ...p, weight_remaining_pct: remainingPct })),
    allocated_pct: allocatedPct,
    weight_remaining_pct: remainingPct,
  };
}

export async function getMonthlyAvailableWeight(
  monthlyId: number,
  ownerId: string,
) {
  await ensureMonthlyOwned(monthlyId, ownerId);
  const { allocatedPct, remainingPct } = await getAvailableWeight(
    monthlyId,
    "MONTHLY_PLAN",
  );
  return { allocated_pct: allocatedPct, remaining_pct: remainingPct };
}

export async function createWeeklyPlan(input: CreateWeeklyPlanInput) {
  const {
    monthlyPlanId,
    companyId,
    ownerId,
    weekNumber,
    adoptionMode,
    weightPct,
    title,
    metric_definition_id,
    start_value,
    target_value,
    contribute_to_score,
    contribute_to_value,
  } = input;

  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 5) {
    throw new Error("week_number must be between 1 and 5.");
  }
  if (!title?.trim()) throw new Error("title is required.");

  const monthly = await ensureMonthlyPublishedAndOwned(monthlyPlanId, ownerId);

  const monthlyProgress = decToNumber(monthly.progress_pct as any);
  if (monthlyProgress >= 100) {
    throw new Error(
      "Parent monthly plan is already 100% complete — nothing left to plan.",
    );
  }

  let resolvedWeight: number;
  if (adoptionMode === "DIRECT") {
    const existing = await prisma.weeklyPlan.count({
      where: { employee_month_plan_id: monthlyPlanId },
    });
    if (existing > 0) {
      throw new Error(
        "Direct adoption is only allowed when no weekly plan exists for this monthly plan.",
      );
    }
    resolvedWeight = 100;
  } else {
    if (
      typeof weightPct !== "number" ||
      Number.isNaN(weightPct) ||
      weightPct <= 0 ||
      weightPct > 100
    ) {
      throw new Error("weight_pct must be a number between 1 and 100.");
    }
    const { remainingPct } = await getAvailableWeight(
      monthlyPlanId,
      "MONTHLY_PLAN",
    );
    if (weightPct > remainingPct + 0.001) {
      throw new Error(
        `Only ${remainingPct.toFixed(2)}% remaining for this monthly plan.`,
      );
    }
    resolvedWeight = weightPct;
  }

  const monthlyStart = start_value ?? decToNumber(monthly.start_value as any);
  const autoMonthlyTarget = decToNumber(monthly.target_value as any);
  const range = autoMonthlyTarget - monthlyStart;
  const autoWeeklyTarget = monthlyStart + (range * resolvedWeight) / 100;
  const finalTarget = target_value ?? autoWeeklyTarget;

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.weeklyPlan.create({
      data: {
        company_id: companyId,
        employee_month_plan_id: monthlyPlanId,
        owner_id: ownerId,
        week_number: weekNumber,
        title: title.trim(),
        adoption_mode: adoptionMode,
        weight_pct: dec(resolvedWeight)!,
        start_value: dec(monthlyStart),
        target_value: dec(finalTarget),
        current_value: dec(monthlyStart),
        progress_pct: dec(0),
        plan_status: "DRAFT",
        created_by: ownerId,
        metric_definition_id: metric_definition_id ?? monthly.metric_definition_id,
        contribute_to_score: contribute_to_score ?? true,
        contribute_to_value: contribute_to_value ?? true,
      },
    });

    await tx.okrWeightAllocation.create({
      data: {
        company_id: companyId,
        parent_id: monthlyPlanId,
        parent_type: "MONTHLY_PLAN",
        child_id: plan.id,
        child_type: "WEEKLY_PLAN",
        weight_pct: dec(resolvedWeight)!,
      },
    });
    return plan;
  });

  await recalculateRollUp("monthly_plan", monthlyPlanId).catch(() => { });
  return created;
}

export async function updateWeeklyPlan(
  id: number,
  ownerId: string,
  patch: {
    title?: string;
    metric_definition_id?: number | null;
    start_value?: number;
    target_value?: number;
    contribute_to_score?: boolean;
    contribute_to_value?: boolean;
  },
) {
  const plan = await prisma.weeklyPlan.findUnique({ where: { id } });
  if (!plan) throw new Error("Weekly plan not found.");
  if (plan.owner_id !== ownerId)
    throw new Error("Not authorized — plan does not belong to you.");
  const updated = await prisma.weeklyPlan.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.metric_definition_id !== undefined ? { metric_definition_id: patch.metric_definition_id } : {}),
      ...(patch.start_value !== undefined ? { start_value: dec(patch.start_value) } : {}),
      ...(patch.target_value !== undefined ? { target_value: dec(patch.target_value) } : {}),
      ...(patch.contribute_to_score !== undefined ? { contribute_to_score: patch.contribute_to_score } : {}),
      ...(patch.contribute_to_value !== undefined ? { contribute_to_value: patch.contribute_to_value } : {}),
    },
  });
  if (
    patch.target_value !== undefined ||
    patch.start_value !== undefined ||
    patch.contribute_to_score !== undefined ||
    patch.contribute_to_value !== undefined
  ) {
    await recalculateRollUp("monthly_plan", plan.employee_month_plan_id).catch(() => { });
  }
  return updated;
}

export async function deleteWeeklyPlan(id: number, ownerId: string) {
  const plan = await prisma.weeklyPlan.findUnique({ where: { id } });
  if (!plan) throw new Error("Weekly plan not found.");
  if (plan.owner_id !== ownerId)
    throw new Error("Not authorized — plan does not belong to you.");
  if (
    ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "PUBLISHED"].includes(
      plan.plan_status as unknown as string,
    )
  ) {
    throw new Error(
      `Cannot delete weekly plan in status ${plan.plan_status}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.okrWeightAllocation.deleteMany({
      where: {
        parent_id: plan.employee_month_plan_id,
        parent_type: "MONTHLY_PLAN",
        child_id: id,
        child_type: "WEEKLY_PLAN",
      },
    });
    await tx.weeklyPlan.delete({ where: { id } });
  });

  await recalculateRollUp(
    "monthly_plan",
    plan.employee_month_plan_id,
  ).catch(() => { });
  return { ok: true };
}

// ─────────────── DAILY PLAN ────────────────────────────────────────────

export async function listDailyPlansForWeekly(
  weeklyId: number,
  ownerId: string,
) {
  await ensureWeeklyOwned(weeklyId, ownerId);
  return prisma.dailyPlan.findMany({
    where: { weekly_plan_id: weeklyId },
    orderBy: [{ completion_day: "asc" }, { id: "asc" }],
  });
}

export async function createDailyPlan(input: CreateDailyPlanInput) {
  const {
    weeklyPlanId,
    companyId,
    ownerId,
    completionDay,
    title,
    targetValue,
    startValue = 0,
    metric_definition_id,
    contributeToScore = true,
    contributeToValue = true,
    description,
  } = input;

  if (!title?.trim()) throw new Error("title is required.");
  if (targetValue !== undefined && (typeof targetValue !== "number" || Number.isNaN(targetValue))) {
    throw new Error("target_value must be a number.");
  }
  const weekly = await ensureWeeklyPublishedAndOwned(weeklyPlanId, ownerId);

  const created = await prisma.dailyPlan.create({
    data: {
      company_id: companyId,
      weekly_plan_id: weeklyPlanId,
      owner_id: ownerId,
      completion_day: completionDay,
      title: title.trim(),
      description: description ?? null,
      start_value: dec(startValue),
      target_value: dec(targetValue ?? 0),
      current_value: dec(startValue),
      progress_pct: dec(0),
      status: "PENDING",
      metric_definition_id: metric_definition_id ?? weekly.metric_definition_id,
      contribute_to_score: contributeToScore,
      contribute_to_value: contributeToValue,
      created_by: ownerId,
    },
  });
  return created;
}

function computeProgressPct(
  startValue: number,
  currentValue: number,
  targetValue: number,
): number {
  const range = targetValue - startValue;
  if (range === 0) return currentValue >= targetValue ? 100 : 0;
  const raw = ((currentValue - startValue) / range) * 100;
  return Math.max(0, Math.min(100, Number(raw.toFixed(2))));
}

export async function updateDailyPlan(
  id: number,
  ownerId: string,
  patch: {
    title?: string;
    target_value?: number;
    current_value?: number;
    metric_definition_id?: number | null;
    contribute_to_score?: boolean;
    contribute_to_value?: boolean;
    notes?: string | null;
    completion_day?:
    | "MONDAY"
    | "TUESDAY"
    | "WEDNESDAY"
    | "THURSDAY"
    | "FRIDAY"
    | "SATURDAY"
    | "SUNDAY";
  },
) {
  const existing = await prisma.dailyPlan.findUnique({ where: { id } });
  if (!existing) throw new Error("Daily plan not found.");
  if (existing.owner_id !== ownerId)
    throw new Error("Not authorized — daily plan does not belong to you.");

  const nextStart = decToNumber(existing.start_value as any);
  const nextTarget =
    patch.target_value !== undefined
      ? patch.target_value
      : decToNumber(existing.target_value as any);
  const nextCurrent =
    patch.current_value !== undefined
      ? patch.current_value
      : decToNumber(existing.current_value as any);
  const progress = computeProgressPct(nextStart, nextCurrent, nextTarget);

  const updated = await prisma.dailyPlan.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.target_value !== undefined
        ? { target_value: dec(patch.target_value) }
        : {}),
      ...(patch.current_value !== undefined
        ? { current_value: dec(patch.current_value) }
        : {}),
      ...(patch.metric_definition_id !== undefined ? { metric_definition_id: patch.metric_definition_id } : {}),
      ...(patch.contribute_to_score !== undefined ? { contribute_to_score: patch.contribute_to_score } : {}),
      ...(patch.contribute_to_value !== undefined ? { contribute_to_value: patch.contribute_to_value } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.completion_day !== undefined
        ? { completion_day: patch.completion_day }
        : {}),
      progress_pct: dec(progress),
    },
  });

  if (
    patch.current_value !== undefined ||
    patch.target_value !== undefined ||
    patch.contribute_to_score !== undefined ||
    patch.contribute_to_value !== undefined
  ) {
    await recalculateRollUp("weekly_plan", existing.weekly_plan_id).catch(
      () => { },
    );
  }
  return updated;
}

export async function updateDailyPlanStatus(
  id: number,
  ownerId: string,
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED",
) {
  const existing = await prisma.dailyPlan.findUnique({ where: { id } });
  if (!existing) throw new Error("Daily plan not found.");
  if (existing.owner_id !== ownerId)
    throw new Error("Not authorized — daily plan does not belong to you.");

  const data: any = { status };
  if (status === "COMPLETED") {
    data.completed_at = new Date();
    // If a daily plan is marked COMPLETED, treat current_value as the target.
    const target = decToNumber(existing.target_value as any);
    const start = decToNumber(existing.start_value as any);
    data.current_value = existing.target_value ?? null;
    data.progress_pct = dec(computeProgressPct(start, target, target));
  }

  const updated = await prisma.dailyPlan.update({ where: { id }, data });

  // Always trigger rollup on status change so parents stay in sync
  if (existing.weekly_plan_id) {
    await recalculateRollUp("weekly_plan", existing.weekly_plan_id).catch(
      () => { },
    );
  }
  return updated;
}

export async function deleteDailyPlan(id: number, ownerId: string) {
  const existing = await prisma.dailyPlan.findUnique({ where: { id } });
  if (!existing) throw new Error("Daily plan not found.");
  if (existing.owner_id !== ownerId)
    throw new Error("Not authorized — daily plan does not belong to you.");
  await prisma.dailyPlan.delete({ where: { id } });
  await recalculateRollUp("weekly_plan", existing.weekly_plan_id).catch(
    () => { },
  );
  return { ok: true };
}

// ─────────────── PERIOD-LEVEL APPROVAL ──────────────────────────────────

export async function submitMonthlyPeriod(opts: {
  ownerId: string;
  companyId: number;
  cycleId: number;
  monthNumber: number;
  reviewerId?: string | null;
}) {
  const { ownerId, companyId, cycleId, monthNumber, reviewerId } = opts;

  // If reviewerId not provided, resolve it (direct manager → admin fallback)
  let finalReviewerId = reviewerId;
  if (!finalReviewerId) {
    // Try direct manager
    const employment = await prisma.employment.findFirst({
      where: {
        employee_id: ownerId,
        company_id: companyId,
        is_active: true,
        manager_id: { not: null },
      },
      select: { manager_id: true },
    });
    if (employment?.manager_id) {
      const managerAppUser = await prisma.appUser.findFirst({
        where: { employee_id: employment.manager_id, company_id: companyId },
        select: { employee_id: true },
      });
      if (managerAppUser?.employee_id) {
        finalReviewerId = managerAppUser.employee_id;
      }
    }

    // Fallback to admin if no manager found
    if (!finalReviewerId) {
      const adminRoles = await prisma.appRole.findMany({
        where: {
          company_id: companyId,
          OR: [
            { name: { in: ["Admin", "SuperAdmin", "Super Admin"] } },
            { name: { contains: "admin", mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (adminRoles.length > 0) {
        const adminRoleIds = adminRoles.map(r => r.id);
        const adminAppUser = await prisma.appUser.findFirst({
          where: {
            company_id: companyId,
            role_id: { in: adminRoleIds },
            employee_id: { not: null },
          },
          include: { employee: { select: { id: true } } },
        });
        if (adminAppUser?.employee) {
          finalReviewerId = adminAppUser.employee.id;
        } else if (adminAppUser?.employee_id) {
          finalReviewerId = adminAppUser.employee_id;
        }
      }
    }
  }

  const plans = await prisma.employeeMonthPlan.findMany({
    where: {
      owner_id: ownerId,
      company_id: companyId,
      cycle_id: cycleId,
      month_number: monthNumber,
    },
  });
  if (plans.length === 0) {
    throw new Error(
      `No monthly plans found for Month ${monthNumber} to submit.`,
    );
  }

  // Get department_id from employee's active employment
  const employment = await prisma.employment.findFirst({
    where: {
      employee_id: ownerId,
      company_id: companyId,
      is_active: true,
    },
    select: { department_id: true },
  });

  // Create submission record
  const submission = await prisma.okrSubmission.create({
    data: {
      company_id: companyId,
      cycle_id: cycleId,
      submitter_id: ownerId,
      reviewer_id: finalReviewerId,
      department_id: employment?.department_id,
      status: "pending_approval",
      type: "MONTHLY_PLAN",
    },
  });

  // Update monthly plans with submission_id and status
  await prisma.employeeMonthPlan.updateMany({
    where: { id: { in: plans.map((p) => p.id) } },
    data: {
      plan_status: "SUBMITTED",
      submitted_at: new Date(),
      reviewer_id: finalReviewerId ?? undefined,
      submission_id: submission.id,
    },
  });
  return {
    submitted_count: plans.length,
    plan_ids: plans.map((p) => p.id),
  };
}

export async function approveMonthlyPeriod(opts: {
  ownerId: string;
  companyId: number;
  cycleId: number;
  monthNumber: number;
  approverId: string;
  autoPublish: boolean;
}) {
  const { ownerId, companyId, cycleId, monthNumber, autoPublish } = opts;
  const data: any = autoPublish
    ? { plan_status: "PUBLISHED", approved_at: new Date(), published_at: new Date() }
    : { plan_status: "APPROVED", approved_at: new Date() };
  const result = await prisma.employeeMonthPlan.updateMany({
    where: {
      owner_id: ownerId,
      company_id: companyId,
      cycle_id: cycleId,
      month_number: monthNumber,
      plan_status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
    },
    data,
  });
  return { affected: result.count, auto_published: autoPublish };
}

export async function rejectMonthlyPeriod(opts: {
  ownerId: string;
  companyId: number;
  cycleId: number;
  monthNumber: number;
  reviewerNote?: string;
}) {
  const { ownerId, companyId, cycleId, monthNumber, reviewerNote } = opts;
  const result = await prisma.employeeMonthPlan.updateMany({
    where: {
      owner_id: ownerId,
      company_id: companyId,
      cycle_id: cycleId,
      month_number: monthNumber,
      plan_status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
    },
    data: {
      plan_status: "DRAFT",
      rejection_note: reviewerNote ?? null,
    },
  });
  return { affected: result.count };
}

export async function submitWeeklyPeriod(opts: {
  ownerId: string;
  companyId: number;
  monthlyPlanId: number;
  weekNumber: number;
  reviewerId?: string | null;
}) {
  const { ownerId, companyId, monthlyPlanId, weekNumber, reviewerId } = opts;

  // If reviewerId not provided, resolve it (direct manager → admin fallback)
  let finalReviewerId = reviewerId;
  if (!finalReviewerId) {
    // Try direct manager
    const employment = await prisma.employment.findFirst({
      where: {
        employee_id: ownerId,
        company_id: companyId,
        is_active: true,
        manager_id: { not: null },
      },
      select: { manager_id: true },
    });
    if (employment?.manager_id) {
      const managerAppUser = await prisma.appUser.findFirst({
        where: { employee_id: employment.manager_id, company_id: companyId },
        select: { employee_id: true },
      });
      if (managerAppUser?.employee_id) {
        finalReviewerId = managerAppUser.employee_id;
      }
    }

    // Fallback to admin if no manager found
    if (!finalReviewerId) {
      const adminRoles = await prisma.appRole.findMany({
        where: {
          company_id: companyId,
          OR: [
            { name: { in: ["Admin", "SuperAdmin", "Super Admin"] } },
            { name: { contains: "admin", mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (adminRoles.length > 0) {
        const adminRoleIds = adminRoles.map(r => r.id);
        const adminAppUser = await prisma.appUser.findFirst({
          where: {
            company_id: companyId,
            role_id: { in: adminRoleIds },
            employee_id: { not: null },
          },
          include: { employee: { select: { id: true } } },
        });
        if (adminAppUser?.employee) {
          finalReviewerId = adminAppUser.employee.id;
        } else if (adminAppUser?.employee_id) {
          finalReviewerId = adminAppUser.employee_id;
        }
      }
    }
  }

  const plans = await prisma.weeklyPlan.findMany({
    where: {
      owner_id: ownerId,
      company_id: companyId,
      employee_month_plan_id: monthlyPlanId,
      week_number: weekNumber,
    },
    include: { monthPlan: { select: { cycle_id: true } } },
  });
  if (plans.length === 0) {
    throw new Error(`No weekly plans found for Week ${weekNumber} to submit.`);
  }

  // Get cycle_id from the first plan's monthPlan
  const cycleId = plans[0].monthPlan?.cycle_id;
  if (!cycleId) {
    throw new Error(`Cannot submit weekly plan: month plan has no cycle_id.`);
  }

  // Get department_id from employee's active employment
  const employment = await prisma.employment.findFirst({
    where: {
      employee_id: ownerId,
      company_id: companyId,
      is_active: true,
    },
    select: { department_id: true },
  });

  // Create submission record
  const submission = await prisma.okrSubmission.create({
    data: {
      company_id: companyId,
      cycle_id: cycleId,
      submitter_id: ownerId,
      reviewer_id: finalReviewerId,
      department_id: employment?.department_id,
      status: "pending_approval",
      type: "WEEKLY_PLAN",
    },
  });

  // Update weekly plans with submission_id and status
  await prisma.weeklyPlan.updateMany({
    where: { id: { in: plans.map((p) => p.id) } },
    data: {
      plan_status: "SUBMITTED",
      submitted_at: new Date(),
      reviewer_id: finalReviewerId ?? undefined,
      submission_id: submission.id,
    },
  });
  return { submitted_count: plans.length, plan_ids: plans.map((p) => p.id) };
}

export async function approveWeeklyPeriod(opts: {
  ownerId: string;
  companyId: number;
  monthlyPlanId: number;
  weekNumber: number;
  autoPublish: boolean;
}) {
  const data: any = opts.autoPublish
    ? {
      plan_status: "PUBLISHED",
      approved_at: new Date(),
      published_at: new Date(),
    }
    : { plan_status: "APPROVED", approved_at: new Date() };
  const result = await prisma.weeklyPlan.updateMany({
    where: {
      owner_id: opts.ownerId,
      company_id: opts.companyId,
      employee_month_plan_id: opts.monthlyPlanId,
      week_number: opts.weekNumber,
      plan_status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
    },
    data,
  });
  return { affected: result.count, auto_published: opts.autoPublish };
}

export async function rejectWeeklyPeriod(opts: {
  ownerId: string;
  companyId: number;
  monthlyPlanId: number;
  weekNumber: number;
  reviewerNote?: string;
}) {
  const result = await prisma.weeklyPlan.updateMany({
    where: {
      owner_id: opts.ownerId,
      company_id: opts.companyId,
      employee_month_plan_id: opts.monthlyPlanId,
      week_number: opts.weekNumber,
      plan_status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
    },
    data: {
      plan_status: "DRAFT",
      rejection_note: opts.reviewerNote ?? null,
    },
  });
  return { affected: result.count };
}

export async function publishMonthlyPeriod(opts: {
  ownerId: string;
  companyId: number;
  cycleId: number;
  monthNumber: number;
}) {
  const { ownerId, companyId, cycleId, monthNumber } = opts;
  const result = await prisma.employeeMonthPlan.updateMany({
    where: {
      owner_id: ownerId,
      company_id: companyId,
      cycle_id: cycleId,
      month_number: monthNumber,
      plan_status: "APPROVED",
    },
    data: { plan_status: "PUBLISHED", published_at: new Date() },
  });
  if (result.count === 0) {
    throw new Error(
      "No approved monthly plans found for this period to publish.",
    );
  }
  return { affected: result.count };
}

export async function publishWeeklyPeriod(opts: {
  ownerId: string;
  companyId: number;
  monthlyPlanId: number;
  weekNumber: number;
}) {
  const { ownerId, companyId, monthlyPlanId, weekNumber } = opts;
  const result = await prisma.weeklyPlan.updateMany({
    where: {
      owner_id: ownerId,
      company_id: companyId,
      employee_month_plan_id: monthlyPlanId,
      week_number: weekNumber,
      plan_status: "APPROVED",
    },
    data: { plan_status: "PUBLISHED", published_at: new Date() },
  });
  if (result.count === 0) {
    throw new Error(
      "No approved weekly plans found for this period to publish.",
    );
  }
  return { affected: result.count };
}
