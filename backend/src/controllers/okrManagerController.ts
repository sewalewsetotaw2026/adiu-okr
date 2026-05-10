import { Request, Response, NextFunction } from "express";
import * as mgrService from "src/services/okrManagerService";

// ─── Team Execution Summary ───────────────────────────────────────────────────

export const getTeamExecutionSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    if (!cycleId) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id query param required." });
    }

    const summary = await mgrService.getTeamExecutionSummary(
      req.user!.user_id,
      req.user!.company_id,
      cycleId,
      {
        monthNumber: req.query.month_number
          ? Number(req.query.month_number)
          : undefined,
        weekNumber: req.query.week_number
          ? Number(req.query.week_number)
          : undefined,
        completionDay: req.query.completion_day as string,
        role: req.user!.role,
      },
    );
    res.status(200).json({ status: "success", data: summary });
  } catch (error) {
    next(error);
  }
};

// ─── Subordinate Job Titles ───────────────────────────────────────────────────

export const listSubordinatePositions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const subordinates = await mgrService.listSubordinatePositions(
      req.user!.user_id,
      req.user!.company_id,
      req.user!.role,
    );
    res.status(200).json({ status: "success", data: subordinates });
  } catch (error) {
    next(error);
  }
};

// ─── Pending Approvals ────────────────────────────────────────────────────────

export const listPendingApprovals = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    if (!cycleId) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id query param required." });
    }

    const approvals = await mgrService.listPendingApprovals(
      req.user!.user_id,
      req.user!.company_id,
      cycleId,
      req.user!.role,
    );
    res.status(200).json({ status: "success", data: approvals });
  } catch (error) {
    next(error);
  }
};

export const listPendingEmployeeObjectives = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    const departmentId = parseInt(req.query.department_id as string);
    if (!cycleId || !departmentId) {
      return res.status(400).json({
        status: "fail",
        message: "cycle_id and department_id query params are required.",
      });
    }

    const data = await mgrService.listPendingEmployeeObjectivesByDepartment(
      req.user!.company_id,
      cycleId,
      departmentId,
    );

    res.status(200).json({ status: "success", results: data.length, data });
  } catch (error) {
    next(error);
  }
};

export const listPendingEmployeeKeyResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    const departmentId = parseInt(req.query.department_id as string);
    if (!cycleId || !departmentId) {
      return res.status(400).json({
        status: "fail",
        message: "cycle_id and department_id query params are required.",
      });
    }

    const data = await mgrService.listPendingEmployeeKeyResultsByDepartment(
      req.user!.company_id,
      cycleId,
      departmentId,
    );

    res.status(200).json({ status: "success", results: data.length, data });
  } catch (error) {
    next(error);
  }
};

// ─── Approval Action ──────────────────────────────────────────────────────────

export const processApprovalAction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { entity_type, entity_id, action, comments } = req.body;
    if (!entity_type || !entity_id || !action) {
      return res.status(400).json({
        status: "fail",
        message: "entity_type, entity_id, and action are required.",
      });
    }

    const validActions = [
      "APPROVED",
      "REJECTED",
      "CHANGES_REQUESTED",
      "PUBLISHED",
    ];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        status: "fail",
        message: `action must be one of: ${validActions.join(", ")}`,
      });
    }

    const validEntityTypes = [
      "EMPLOYEE_OBJECTIVE",
      "EMPLOYEE_KR",
      "EMPLOYEE_MONTH_PLAN",
      "WEEKLY_PLAN",
      "DAILY_PLAN",
    ];
    if (!validEntityTypes.includes(entity_type)) {
      return res.status(400).json({
        status: "fail",
        message: `entity_type must be one of: ${validEntityTypes.join(", ")}`,
      });
    }

    const result = await mgrService.processApprovalAction({
      companyId: req.user!.company_id,
      entityType: entity_type,
      entityId: entity_id,
      action,
      comments,
      approverId: req.user!.user_id,
    });

    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("not supported") ||
      error.message?.includes("Invalid") ||
      error.message?.includes("transition")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const bulkApprovalAction = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      objective_ids,
      kr_ids,
      month_plan_ids,
      weekly_plan_ids,
      daily_plan_ids,
      action,
      user_id,
    } = req.body;
    if (
      (!objective_ids || objective_ids.length === 0) &&
      (!kr_ids || kr_ids.length === 0) &&
      (!month_plan_ids || month_plan_ids.length === 0) &&
      (!weekly_plan_ids || weekly_plan_ids.length === 0) &&
      (!daily_plan_ids || daily_plan_ids.length === 0)
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "objective_ids, kr_ids, month_plan_ids, weekly_plan_ids or daily_plan_ids are required.",
      });
    }

    const validActions = [
      "APPROVED",
      "REJECTED",
      "CHANGES_REQUESTED",
      "PUBLISHED",
    ];
    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        status: "fail",
        message: `action must be one of: ${validActions.join(", ")}`,
      });
    }

    const result = await mgrService.bulkApprovalAction({
      companyId: req.user!.company_id,
      approverId: req.user!.user_id,
      action,
      objectiveIds: objective_ids || [],
      krIds: kr_ids || [],
      monthPlanIds: month_plan_ids || [],
      weeklyPlanIds: weekly_plan_ids || [],
      dailyPlanIds: daily_plan_ids || [],
      userId: user_id,
    });

    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("not found") ||
      error.message?.includes("transition") ||
      error.message?.includes("Invalid")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const getPlanningComplianceReport = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    const monthNumber = req.query.month_number
      ? parseInt(req.query.month_number as string)
      : undefined;
    const weekNumber = req.query.week_number
      ? parseInt(req.query.week_number as string)
      : undefined;

    if (!cycleId) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id query param required." });
    }

    const isAdmin =
      req.user!.role === "Admin" ||
      req.user!.role === "Super Admin" ||
      [1, 2].includes(req.user!.role_id);

    const report = await mgrService.getPlanningCompliance({
      requesterUserId: req.user!.user_id,
      companyId: req.user!.company_id,
      cycleId,
      monthNumber,
      weekNumber,
      completionDay: req.query.completion_day as string,
    });

    res.status(200).json({ status: "success", data: report });
  } catch (error) {
    next(error);
  }
};

export const getPlanningInsights = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);

    if (!cycleId) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id query param required." });
    }

    const scopeRaw = String(req.query.scope || "department").toLowerCase();
    const scope = scopeRaw === "organization" ? "organization" : "department";
    const departmentIdRaw = req.query.department_id
      ? Number(req.query.department_id)
      : undefined;

    if (
      scope === "organization" &&
      !["admin", "hr", "ceo", "super admin", "superadmin"].includes(
        String(req.user?.role || "").toLowerCase(),
      )
    ) {
      return res.status(403).json({
        status: "fail",
        message:
          "Only organization-level roles can access organization insights.",
      });
    }

    const data = await mgrService.getPlanningInsights({
      requesterUserId: req.user!.user_id,
      companyId: req.user!.company_id,
      cycleId,
      role: req.user?.role,
      scope,
      departmentId:
        departmentIdRaw && Number.isFinite(departmentIdRaw)
          ? departmentIdRaw
          : undefined,
    });

    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const getTeamHealthSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await mgrService.getTeamHealthSummary(
      req.user!.user_id,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const getPlanningCompliance = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { cycle_id, month_number, week_number } = req.query;
    if (!cycle_id) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id query param required." });
    }

    const data = await mgrService.getPlanningCompliance({
      requesterUserId: String(req.user!.user_id),
      companyId: req.user!.company_id,
      cycleId: Number(cycle_id),
      monthNumber: month_number ? Number(month_number) : undefined,
      weekNumber: week_number ? Number(week_number) : undefined,
      completionDay: req.query.completion_day as string,
      role: req.user!.role,
    });

    res.status(200).json({ status: "success", data });
  } catch (error: any) {
    console.error(`[getPlanningCompliance] Error:`, error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};
