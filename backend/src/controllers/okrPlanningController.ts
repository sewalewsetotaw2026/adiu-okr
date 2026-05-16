/**
 * OKR Planning Controller — corrected hierarchy.
 * Mounted under /api/v1/okr (see config/routes.ts).
 */

import type { NextFunction, Request, Response } from "express";
import * as svc from "src/services/okrPlanningService";
import { recalculateRollUp } from "src/services/okrRollupService";
import * as configResolver from "src/services/okrConfigResolverService";

// ────────────── Custom Error Classes ────────────────────────────────────

class ValidationError extends Error {
  statusCode = 422;
  errors: Array<{ field: string; message: string }>;

  constructor(
    message: string,
    errors?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "ValidationError";
    this.errors = errors || [];
  }
}

class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// ────────────── Helper Functions ──────────────────────────────────────

const requireUser = (req: Request) => {
  if (!req.user) throw new UnauthorizedError("Not authorized.");
  if (!req.user.employee_id) {
    throw new UnauthorizedError(
      "Not authorized — employee_id missing on token.",
    );
  }
  return req.user as Required<
    Pick<NonNullable<Request["user"]>, "employee_id" | "company_id">
  > &
    NonNullable<Request["user"]>;
};

const parseId = (v: any, field = "id"): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) {
    throw new ValidationError(`${field} must be a positive integer.`, [
      { field, message: "Must be a positive integer" },
    ]);
  }
  return n;
};

// ────────────── Validation Helpers ────────────────────────────────────

const validateRequired = (
  value: any,
  field: string,
  customMessage?: string,
): void => {
  if (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
  ) {
    throw new ValidationError(customMessage || `${field} is required.`, [
      { field, message: "This field is required" },
    ]);
  }
};

const validateNumber = (
  value: any,
  field: string,
  options?: { min?: number; max?: number; allowZero?: boolean },
): number => {
  if (value === undefined || value === null) {
    throw new ValidationError(`${field} is required.`, [
      { field, message: "This field is required" },
    ]);
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    throw new ValidationError(`${field} must be a valid number.`, [
      { field, message: "Must be a valid number" },
    ]);
  }
  if (options?.min !== undefined && num < options.min) {
    throw new ValidationError(`${field} must be at least ${options.min}.`, [
      { field, message: `Minimum value is ${options.min}` },
    ]);
  }
  if (options?.max !== undefined && num > options.max) {
    throw new ValidationError(`${field} must be at most ${options.max}.`, [
      { field, message: `Maximum value is ${options.max}` },
    ]);
  }
  if (!options?.allowZero && num === 0 && options?.min === undefined) {
    // Allow zero if not explicitly prohibited
  }
  return num;
};

const validateEnum = (
  value: any,
  validValues: string[],
  field: string,
): string => {
  const str = String(value || "").toUpperCase();
  if (!validValues.includes(str)) {
    throw new ValidationError(
      `${field} must be one of: ${validValues.join(", ")}.`,
      [{ field, message: `Must be one of: ${validValues.join(", ")}` }],
    );
  }
  return str;
};

const validateDayOfWeek = (value: any): string => {
  const validDays = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ];
  const day = String(value || "").toUpperCase();
  if (!validDays.includes(day)) {
    throw new ValidationError(`completion_day must be MONDAY–SUNDAY.`, [
      { field: "completion_day", message: "Must be a valid day of the week" },
    ]);
  }
  return day;
};

// ────────────── Monthly Plan Endpoints ─────────────────────────────────

export const listMonthlyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const krId = parseId(req.params.krId);
    const data = await svc.listMonthlyPlansForKr(krId, u.employee_id);
    res.json({ status: "success", data });
  } catch (e) {
    next(e);
  }
};

export const getMonthlyAvailableWeight = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const krId = parseId(req.params.krId);
    const data = await svc.getKrAvailableWeight(krId, u.employee_id);
    res.json({ status: "success", data });
  } catch (e) {
    next(e);
  }
};

export const createMonthlyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const krId = parseId(req.params.krId, "krId");
    const body = req.body || {};

    // ── VALIDATION ─────────────────────────────────────────────────────
    validateRequired(body.month_number, "month_number");
    const monthNumber = validateNumber(body.month_number, "month_number", {
      min: 1,
      max: 3,
    });

    validateRequired(body.title, "title");
    const title = String(body.title).trim();
    if (title.length < 1) {
      throw new ValidationError("title is required.", [
        { field: "title", message: "Title cannot be empty" },
      ]);
    }
    if (title.length > 200) {
      throw new ValidationError("title must be at most 200 characters.", [
        { field: "title", message: "Maximum 200 characters" },
      ]);
    }

    const mode = validateEnum(
      body.adoption_mode || "DECOMPOSED",
      ["DIRECT", "DECOMPOSED"],
      "adoption_mode",
    ) as "DIRECT" | "DECOMPOSED";

    let weightPct: number | undefined;
    if (mode === "DECOMPOSED") {
      validateRequired(body.weight_pct, "weight_pct");
      weightPct = validateNumber(body.weight_pct, "weight_pct", {
        min: 1,
        max: 100,
      });
    }

    let targetValue: number | undefined;
    if (body.target_value !== undefined) {
      targetValue = validateNumber(body.target_value, "target_value", {
        min: 0,
        allowZero: true,
      });
    }

    let startValue: number | undefined;
    if (body.start_value !== undefined) {
      startValue = validateNumber(body.start_value, "start_value", {
        allowZero: true,
      });
    }

    const description =
      body.description !== undefined
        ? String(body.description).trim()
        : undefined;
    if (description && description.length > 1000) {
      throw new ValidationError(
        "description must be at most 1000 characters.",
        [{ field: "description", message: "Maximum 1000 characters" }],
      );
    }
    // ────────────────────────────────────────────────────────────────────

    const plan = await svc.createMonthlyPlan({
      krId,
      companyId: u.company_id,
      ownerId: u.employee_id,
      monthNumber,
      adoptionMode: mode,
      weightPct,
      title,
      description,
      metric_definition_id: body.metric_definition_id
        ? Number(body.metric_definition_id)
        : undefined,
      start_value: startValue,
      target_value: targetValue,
      contribute_to_score:
        body.contribute_to_score !== undefined
          ? Boolean(body.contribute_to_score)
          : undefined,
      contribute_to_value:
        body.contribute_to_value !== undefined
          ? Boolean(body.contribute_to_value)
          : undefined,
      aligned_manager_plan_id: body.aligned_manager_plan_id,
    });
    res.status(201).json({ status: "success", data: plan });
  } catch (e) {
    next(e);
  }
};

export const updateMonthlyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const id = parseId(req.params.id);
    const plan = await svc.updateMonthlyPlan(id, u.employee_id, {
      title: req.body?.title,
      description: req.body?.description,
      metric_definition_id:
        req.body?.metric_definition_id !== undefined
          ? Number(req.body.metric_definition_id)
          : undefined,
      start_value:
        req.body?.start_value !== undefined
          ? Number(req.body.start_value)
          : undefined,
      target_value:
        req.body?.target_value !== undefined
          ? Number(req.body.target_value)
          : undefined,
      current_value:
        req.body?.current_value !== undefined
          ? Number(req.body.current_value)
          : undefined,
      contribute_to_score:
        req.body?.contribute_to_score !== undefined
          ? Boolean(req.body.contribute_to_score)
          : undefined,
      contribute_to_value:
        req.body?.contribute_to_value !== undefined
          ? Boolean(req.body.contribute_to_value)
          : undefined,
    });
    res.json({ status: "success", data: plan });
  } catch (e) {
    next(e);
  }
};

export const deleteMonthlyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const id = parseId(req.params.id);
    const result = await svc.deleteMonthlyPlan(id, u.employee_id);
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const listManagerMonthlyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const monthNumber = parseId(req.query.monthNumber, "monthNumber");
    const cycleId = parseId(req.query.cycleId, "cycleId");
    const krIdStr = req.query.krId as string;
    const krId = krIdStr ? parseInt(krIdStr, 10) : undefined;

    const data = await svc.getManagerMonthlyPlans(
      u.employee_id,
      monthNumber,
      cycleId,
      krId,
    );
    res.json({ status: "success", data });
  } catch (e) {
    next(e);
  }
};

// ────────────── Weekly Plan Endpoints ──────────────────────────────────

export const listWeeklyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const monthlyId = parseId(req.params.monthlyId);
    const data = await svc.listWeeklyPlansForMonthly(monthlyId, u.employee_id);
    res.json({ status: "success", data });
  } catch (e) {
    next(e);
  }
};

export const getWeeklyAvailableWeight = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const monthlyId = parseId(req.params.monthlyId);
    const data = await svc.getMonthlyAvailableWeight(monthlyId, u.employee_id);
    res.json({ status: "success", data });
  } catch (e) {
    next(e);
  }
};

export const createWeeklyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const monthlyId = parseId(req.params.monthlyId, "monthlyId");
    const body = req.body || {};

    // ── VALIDATION ─────────────────────────────────────────────────────
    validateRequired(body.week_number, "week_number");
    const weekNumber = validateNumber(body.week_number, "week_number", {
      min: 1,
      max: 5,
    });

    validateRequired(body.title, "title");
    const title = String(body.title).trim();
    if (title.length < 1) {
      throw new ValidationError("title is required.", [
        { field: "title", message: "Title cannot be empty" },
      ]);
    }
    if (title.length > 200) {
      throw new ValidationError("title must be at most 200 characters.", [
        { field: "title", message: "Maximum 200 characters" },
      ]);
    }

    const mode = validateEnum(
      body.adoption_mode || "DECOMPOSED",
      ["DIRECT", "DECOMPOSED"],
      "adoption_mode",
    ) as "DIRECT" | "DECOMPOSED";

    let weightPct: number | undefined;
    if (mode === "DECOMPOSED") {
      validateRequired(body.weight_pct, "weight_pct");
      weightPct = validateNumber(body.weight_pct, "weight_pct", {
        min: 1,
        max: 100,
      });
    }

    let targetValue: number | undefined;
    if (body.target_value !== undefined) {
      targetValue = validateNumber(body.target_value, "target_value", {
        min: 0,
        allowZero: true,
      });
    }

    let startValue: number | undefined;
    if (body.start_value !== undefined) {
      startValue = validateNumber(body.start_value, "start_value", {
        allowZero: true,
      });
    }
    // ────────────────────────────────────────────────────────────────────

    const plan = await svc.createWeeklyPlan({
      monthlyPlanId: monthlyId,
      companyId: u.company_id,
      ownerId: u.employee_id,
      weekNumber,
      adoptionMode: mode,
      weightPct,
      title,
      aligned_manager_plan_id: body.aligned_manager_plan_id,
      metric_definition_id: body.metric_definition_id
        ? Number(body.metric_definition_id)
        : undefined,
      start_value: startValue,
      target_value: targetValue,
      contribute_to_score:
        body.contribute_to_score !== undefined
          ? Boolean(body.contribute_to_score)
          : undefined,
      contribute_to_value:
        body.contribute_to_value !== undefined
          ? Boolean(body.contribute_to_value)
          : undefined,
    });
    res.status(201).json({ status: "success", data: plan });
  } catch (e) {
    next(e);
  }
};

export const updateWeeklyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const id = parseId(req.params.id);
    const plan = await svc.updateWeeklyPlan(id, u.employee_id, {
      title: req.body?.title,
      metric_definition_id:
        req.body?.metric_definition_id !== undefined
          ? Number(req.body.metric_definition_id)
          : undefined,
      start_value:
        req.body?.start_value !== undefined
          ? Number(req.body.start_value)
          : undefined,
      target_value:
        req.body?.target_value !== undefined
          ? Number(req.body.target_value)
          : undefined,
      current_value:
        req.body?.current_value !== undefined
          ? Number(req.body.current_value)
          : undefined,
      contribute_to_score:
        req.body?.contribute_to_score !== undefined
          ? Boolean(req.body.contribute_to_score)
          : undefined,
      contribute_to_value:
        req.body?.contribute_to_value !== undefined
          ? Boolean(req.body.contribute_to_value)
          : undefined,
    });
    res.json({ status: "success", data: plan });
  } catch (e) {
    next(e);
  }
};

export const deleteWeeklyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const id = parseId(req.params.id);
    const result = await svc.deleteWeeklyPlan(id, u.employee_id);
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const listManagerWeeklyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const monthlyId = parseId(req.query.monthlyId, "monthlyId");
    const weekNumber = parseId(req.query.weekNumber, "weekNumber");

    const data = await svc.getManagerWeeklyPlans(
      u.employee_id,
      monthlyId,
      weekNumber,
    );

    res.json({ status: "success", data });
  } catch (e) {
    next(e);
  }
};

export const checkManagerPlanExists = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const cadence = validateEnum(
      req.query.cadence as string,
      ["MONTHLY", "WEEKLY", "DAILY"],
      "cadence",
    ).toLowerCase() as "monthly" | "weekly" | "daily";

    const context: any = {};

    if (cadence === "monthly") {
      if (req.query.cycleId) {
        context.cycleId = parseId(req.query.cycleId, "cycleId");
      }
      if (req.query.monthNumber) {
        context.monthNumber = parseId(req.query.monthNumber, "monthNumber");
      }
      if (req.query.krId) {
        context.krId = parseId(req.query.krId, "krId");
      }
    } else if (cadence === "weekly" || cadence === "daily") {
      if (req.query.monthlyPlanId) {
        context.monthlyPlanId = parseId(req.query.monthlyPlanId, "monthlyPlanId");
      }
      if (req.query.weekNumber) {
        context.weekNumber = parseId(req.query.weekNumber, "weekNumber");
      }
    }

    const result = await svc.checkManagerPlanExists(u.employee_id, cadence, context);
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

// ────────────── Daily Plan Endpoints ───────────────────────────────────

export const listDailyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const weeklyId = parseId(req.params.weeklyId);
    const data = await svc.listDailyPlansForWeekly(weeklyId, u.employee_id);
    res.json({ status: "success", data });
  } catch (e) {
    next(e);
  }
};

export const createDailyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const weeklyId = parseId(req.params.weeklyId, "weeklyId");
    const body = req.body || {};

    // ── VALIDATION ─────────────────────────────────────────────────────
    validateRequired(body.completion_day, "completion_day");
    const day = validateDayOfWeek(body.completion_day);

    validateRequired(body.title, "title");
    const title = String(body.title).trim();
    if (title.length < 1) {
      throw new ValidationError("title is required.", [
        { field: "title", message: "Title cannot be empty" },
      ]);
    }
    if (title.length > 200) {
      throw new ValidationError("title must be at most 200 characters.", [
        { field: "title", message: "Maximum 200 characters" },
      ]);
    }

    let targetValue: number | undefined;
    if (body.target_value !== undefined) {
      targetValue = validateNumber(body.target_value, "target_value", {
        min: 0,
        allowZero: true,
      });
    }

    let startValue = 0;
    if (body.start_value !== undefined && body.start_value !== null) {
      startValue = validateNumber(body.start_value, "start_value", {
        allowZero: true,
      });
    }

    const description =
      body.description !== undefined
        ? String(body.description).trim()
        : undefined;
    if (description && description.length > 1000) {
      throw new ValidationError(
        "description must be at most 1000 characters.",
        [{ field: "description", message: "Maximum 1000 characters" }],
      );
    }
    // ────────────────────────────────────────────────────────────────────

    const plan = await svc.createDailyPlan({
      weeklyPlanId: weeklyId,
      companyId: u.company_id,
      ownerId: u.employee_id,
      completionDay: day as any,
      title,
      targetValue,
      startValue,
      metric_definition_id: body.metric_definition_id
        ? Number(body.metric_definition_id)
        : undefined,
      contributeToScore:
        body.contribute_to_score === undefined
          ? true
          : Boolean(body.contribute_to_score),
      contributeToValue:
        body.contribute_to_value === undefined
          ? true
          : Boolean(body.contribute_to_value),
      description,
    });
    res.status(201).json({ status: "success", data: plan });
  } catch (e) {
    next(e);
  }
};

export const updateDailyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const id = parseId(req.params.id);
    const body = req.body || {};
    const patch: any = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.target_value !== undefined)
      patch.target_value = Number(body.target_value);
    if (body.current_value !== undefined)
      patch.current_value = Number(body.current_value);
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.completion_day !== undefined)
      patch.completion_day = String(body.completion_day).toUpperCase();
    if (body.metric_definition_id !== undefined)
      patch.metric_definition_id = body.metric_definition_id
        ? Number(body.metric_definition_id)
        : null;
    if (body.contribute_to_score !== undefined)
      patch.contribute_to_score = Boolean(body.contribute_to_score);
    if (body.contribute_to_value !== undefined)
      patch.contribute_to_value = Boolean(body.contribute_to_value);
    const updated = await svc.updateDailyPlan(id, u.employee_id, patch);
    res.json({ status: "success", data: updated });
  } catch (e) {
    next(e);
  }
};

export const updateDailyPlanStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const id = parseId(req.params.id);
    const status = String(req.body?.status || "").toUpperCase();
    if (!["PENDING", "IN_PROGRESS", "COMPLETED", "SKIPPED"].includes(status)) {
      return res.status(422).json({
        status: "fail",
        message:
          "status must be one of PENDING, IN_PROGRESS, COMPLETED, SKIPPED.",
      });
    }
    const updated = await svc.updateDailyPlanStatus(
      id,
      u.employee_id,
      status as any,
    );
    res.json({ status: "success", data: updated });
  } catch (e) {
    next(e);
  }
};

export const deleteDailyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const id = parseId(req.params.id);
    const result = await svc.deleteDailyPlan(id, u.employee_id);
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

// ────────────── Period-level Approval ──────────────────────────────────

export const submitMonthlyPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const { month_number, cycle_id, reviewer_id, plan_ids } = req.body || {};
    const result = await svc.submitMonthlyPeriod({
      ownerId: u.employee_id,
      companyId: u.company_id,
      cycleId: Number(cycle_id),
      monthNumber: Number(month_number),
      reviewerId: reviewer_id ?? null,
      planIds: Array.isArray(plan_ids)
        ? plan_ids
            .map((id: unknown) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0)
        : undefined,
    });
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const approveMonthlyPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const { month_number, cycle_id, owner_id } = req.body || {};
    const autoPublish = await configResolver.isAutoPublishOnApprovalEnabled(
      u.company_id,
      cycle_id ? Number(cycle_id) : undefined,
    );
    const result = await svc.approveMonthlyPeriod({
      ownerId: String(owner_id || u.employee_id),
      companyId: u.company_id,
      cycleId: Number(cycle_id),
      monthNumber: Number(month_number),
      approverId: u.employee_id,
      autoPublish,
    });
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const rejectMonthlyPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const { month_number, cycle_id, owner_id, note } = req.body || {};
    const result = await svc.rejectMonthlyPeriod({
      ownerId: String(owner_id || u.employee_id),
      companyId: u.company_id,
      cycleId: Number(cycle_id),
      monthNumber: Number(month_number),
      reviewerNote: note,
    });
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const submitWeeklyPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const { week_number, monthly_plan_id, reviewer_id, plan_ids } =
      req.body || {};
    const result = await svc.submitWeeklyPeriod({
      ownerId: u.employee_id,
      companyId: u.company_id,
      monthlyPlanId: Number(monthly_plan_id),
      weekNumber: Number(week_number),
      reviewerId: reviewer_id ?? null,
      planIds: Array.isArray(plan_ids)
        ? plan_ids
            .map((id: unknown) => Number(id))
            .filter((id: number) => Number.isInteger(id) && id > 0)
        : undefined,
    });
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const approveWeeklyPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const { week_number, monthly_plan_id, owner_id } = req.body || {};
    const autoPublish = await configResolver.isAutoPublishOnApprovalEnabled(
      u.company_id,
    );
    const result = await svc.approveWeeklyPeriod({
      ownerId: String(owner_id || u.employee_id),
      companyId: u.company_id,
      monthlyPlanId: Number(monthly_plan_id),
      weekNumber: Number(week_number),
      autoPublish,
    });
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const rejectWeeklyPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const { week_number, monthly_plan_id, owner_id, note } = req.body || {};
    const result = await svc.rejectWeeklyPeriod({
      ownerId: String(owner_id || u.employee_id),
      companyId: u.company_id,
      monthlyPlanId: Number(monthly_plan_id),
      weekNumber: Number(week_number),
      reviewerNote: note,
    });
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const publishMonthlyPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const { month_number, cycle_id } = req.body || {};
    const result = await svc.publishMonthlyPeriod({
      ownerId: u.employee_id,
      companyId: u.company_id,
      cycleId: Number(cycle_id),
      monthNumber: Number(month_number),
    });
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

export const publishWeeklyPeriod = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const u = requireUser(req);
    const { week_number, monthly_plan_id } = req.body || {};
    const result = await svc.publishWeeklyPeriod({
      ownerId: u.employee_id,
      companyId: u.company_id,
      monthlyPlanId: Number(monthly_plan_id),
      weekNumber: Number(week_number),
    });
    res.json({ status: "success", data: result });
  } catch (e) {
    next(e);
  }
};

// ────────────── Manual Roll-up Trigger ─────────────────────────────────

export const manualRollup = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    requireUser(req);
    const entityType = String(req.params.entityType || "");
    const entityId = parseId(req.params.entityId);
    const allowed = [
      "daily_plan",
      "weekly_plan",
      "monthly_plan",
      "employee_key_result",
      "employee_objective",
      "company_key_result",
      "company_objective",
    ];
    if (!allowed.includes(entityType)) {
      return res.status(422).json({
        status: "fail",
        message: `entityType must be one of ${allowed.join(", ")}.`,
      });
    }
    await recalculateRollUp(entityType as any, entityId);
    res.json({ status: "success", data: { entityType, entityId } });
  } catch (e) {
    next(e);
  }
};

// ────────────── Error Handler Export ────────────────────────────────────

/**
 * OKR Planning Error Handler
 * Mount this after all routes to handle custom error types
 */
export function okrPlanningErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // Handle custom error types
  if (err instanceof ValidationError) {
    const validationErr = err as ValidationError;
    return res.status(validationErr.statusCode).json({
      status: "fail",
      message: err.message,
      errors: validationErr.errors,
    });
  }

  if (err instanceof NotFoundError) {
    return res.status(404).json({
      status: "fail",
      message: err.message,
    });
  }

  if (err instanceof ForbiddenError) {
    return res.status(403).json({
      status: "fail",
      message: err.message,
    });
  }

  if (err instanceof UnauthorizedError) {
    return res.status(401).json({
      status: "fail",
      message: err.message,
    });
  }

  // Handle service layer errors (from okrPlanningService)
  const message = err.message || "An error occurred";

  // Business rule violations (422)
  if (
    message.includes("already exists") ||
    message.includes("must be") ||
    message.includes("required") ||
    message.includes("Only") ||
    message.includes("remaining") ||
    message.includes("between") ||
    message.includes("cannot") ||
    message.includes("locked") ||
    message.includes("allowed") ||
    message.includes("only allowed") ||
    message.includes("already 100%")
  ) {
    return res.status(422).json({
      status: "fail",
      message: message,
    });
  }

  // Not found errors (404)
  if (message.includes("not found")) {
    return res.status(404).json({
      status: "fail",
      message: message,
    });
  }

  // Forbidden errors (403)
  if (
    message.includes("does not belong to you") ||
    message.includes("cannot modify") ||
    message.includes("cannot delete")
  ) {
    return res.status(403).json({
      status: "fail",
      message: message,
    });
  }

  // Default to 500 for unexpected errors
  return res.status(500).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production" ? "Internal server error" : message,
  });
}
