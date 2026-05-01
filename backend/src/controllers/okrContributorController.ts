import { Request, Response, NextFunction } from "express";
import { prisma } from "src/lib/prisma";
import * as contributorService from "src/services/okrContributorService";

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

const ALLOWED_CONTRIBUTOR_ROLE_TYPES = [
  "EMPLOYEE",
  "TEAM_LEADER",
  "MANAGER",
  "DIRECTOR",
  "DEPARTMENT_HEAD",
] as const;
type ContributorRoleType = (typeof ALLOWED_CONTRIBUTOR_ROLE_TYPES)[number];

// ─── Assign Contributor ───────────────────────────────────────────────────────

export const assignContributor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      company_kr_id,
      department_kr_id,
      employee_kr_id,
      user_id,
      role_type,
      is_required_for_completion,
    } = req.body;
    const companyKrId = parsePositiveInt(company_kr_id);
    const departmentKrId = parsePositiveInt(department_kr_id);
    const employeeKrId = parsePositiveInt(employee_kr_id);
    const normalizedEmployeeKrId = employeeKrId ?? departmentKrId;
    const normalizedUserId = typeof user_id === "string" ? user_id.trim() : String(user_id ?? "").trim();
    const normalizedRoleType =
      typeof role_type === "string" ? role_type.trim() : "";

    if (
      (companyKrId === null && normalizedEmployeeKrId === null) ||
      !normalizedUserId ||
      !normalizedRoleType
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "company_kr_id or department_kr_id/employee_kr_id, user_id, and role_type are required.",
      });
    }

    if (
      !ALLOWED_CONTRIBUTOR_ROLE_TYPES.includes(
        normalizedRoleType as ContributorRoleType,
      )
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "role_type must be one of EMPLOYEE, TEAM_LEADER, MANAGER, DIRECTOR, DEPARTMENT_HEAD.",
      });
    }

    if (
      is_required_for_completion !== undefined &&
      typeof is_required_for_completion !== "boolean"
    ) {
      return res.status(400).json({
        status: "fail",
        message: "is_required_for_completion must be boolean when provided.",
      });
    }

    const result = await contributorService.assignContributor({
      companyId: req.user!.company_id,
      companyKrId: companyKrId || undefined,
      employeeKrId: normalizedEmployeeKrId || undefined,
      userId: normalizedUserId,
      roleType: normalizedRoleType as ContributorRoleType,
      isRequiredForCompletion: is_required_for_completion,
      assignedBy: req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("already a contributor") ||
      error.message?.includes("in draft") ||
      error.message?.includes("contributor") ||
      error.message?.includes("employment")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── Remove Contributor ───────────────────────────────────────────────────────

export const removeContributor = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const result = await contributorService.removeContributor(
      id,
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("Cannot remove") ||
      error.message?.includes("in draft")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── Update Contributor Flag ──────────────────────────────────────────────────

export const updateContributorFlag = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const { is_required_for_completion } = req.body;
    if (typeof is_required_for_completion !== "boolean") {
      return res.status(400).json({
        status: "fail",
        message: "is_required_for_completion (boolean) is required.",
      });
    }

    const result = await contributorService.updateContributorFlag(
      id,
      req.user!.company_id,
      is_required_for_completion,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("in draft")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── List Contributors ────────────────────────────────────────────────────────

export const listContributors = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyKrId = parsePositiveInt(req.query.company_kr_id);
    const departmentKrId = parsePositiveInt(req.query.department_kr_id);
    const employeeKrId = parsePositiveInt(req.query.employee_kr_id);
    const normalizedEmployeeKrId = employeeKrId ?? departmentKrId;

    if (companyKrId === null && normalizedEmployeeKrId === null) {
      return res.status(400).json({
        status: "fail",
        message:
          "company_kr_id or department_kr_id/employee_kr_id query param is required.",
      });
    }

    const contributors = await (companyKrId
      ? contributorService.listContributors(
          companyKrId,
          req.user!.company_id,
        )
      : contributorService.listEmployeeKrContributors(
          normalizedEmployeeKrId!,
          req.user!.company_id,
        ));
    res.status(200).json({
      status: "success",
      results: contributors.length,
      data: contributors,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Department Contributor Summary ───────────────────────────────────────────

export const getDepartmentContributorSummary = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const departmentId = parsePositiveInt(req.query.department_id);
    const cycleId = parsePositiveInt(req.query.cycle_id);
    if (departmentId === null || cycleId === null) {
      return res.status(400).json({
        status: "fail",
        message: "department_id and cycle_id query params are required.",
      });
    }

    const summary = await contributorService.getDepartmentContributorSummary(
      departmentId,
      cycleId,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", data: summary });
  } catch (error) {
    next(error);
  }
};
