import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import * as deptService from "src/services/okrDepartmentService";
import { RoleNames, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";

async function checkDepartmentAccess(
  user: { user_id: string; role: string; employee_id?: string },
  departmentId: number,
  companyId: number,
): Promise<boolean> {
  // 1. Admins and HR have access to everything
  const normalizedRole = user.role.toLowerCase().trim();
  const isAdminOrHR = [
    RoleNames.ADMIN,
    RoleNames.HR,
    ...SUPERADMIN_VARIANTS,
  ].some((r) => r.toLowerCase().trim() === normalizedRole);
  if (isAdminOrHR) return true;

  // 2. Check if user is the designated department head
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { head_user_id: true, company_id: true },
  });

  if (!department || department.company_id !== companyId) return false;
  if (department.head_user_id === Number(user.user_id)) return true;

  // 3. Check if user is the manager of the department head
  if (department.head_user_id && user.employee_id) {
    const headUser = await prisma.appUser.findUnique({
      where: { id: department.head_user_id },
      select: { employee_id: true },
    });

    if (headUser?.employee_id) {
      const headEmployment = await prisma.employment.findFirst({
        where: {
          employee_id: headUser.employee_id,
          company_id: companyId,
          is_active: true,
        },
        select: { manager_id: true },
      });

      if (headEmployment?.manager_id === user.employee_id) return true;
    }
  }

  return false;
}

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOptionalFiniteNumber(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

// ─── Department Objectives ────────────────────────────────────────────────────

export const listDepartmentObjectives = async (
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
        message: "department_id and cycle_id query params required.",
      });
    }

    const hasAccess = await checkDepartmentAccess(
      req.user!,
      departmentId,
      req.user!.company_id,
    );

    if (!hasAccess) {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to view this department's OKRs.",
      });
    }

    const objectives = await deptService.listDepartmentObjectives(
      req.user!.company_id,
      departmentId,
      cycleId,
    );

    res.status(200).json({
      status: "success",
      results: objectives.length,
      data: objectives,
    });
  } catch (error) {
    next(error);
  }
};

export const listPendingDepartmentObjectives = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parsePositiveInt(req.query.cycle_id);
    if (cycleId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id query param required." });
    }

    const objectives = await deptService.listPendingDepartmentObjectives(
      req.user!.company_id,
      cycleId,
    );
    res.status(200).json({
      status: "success",
      results: objectives.length,
      data: objectives,
    });
  } catch (error) {
    next(error);
  }
};

export const listPendingDepartmentKeyResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parsePositiveInt(req.query.cycle_id);
    const departmentIdRaw = req.query.department_id;

    const departmentId =
      departmentIdRaw !== undefined
        ? parsePositiveInt(departmentIdRaw)
        : undefined;

    if (cycleId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id query param required." });
    }

    if (departmentIdRaw !== undefined && departmentId === null) {
      return res.status(400).json({
        status: "fail",
        message: "department_id must be a positive integer.",
      });
    }

    const departmentIdFilter: number | undefined =
      departmentIdRaw !== undefined ? (departmentId as number) : undefined;

    const keyResults = await deptService.listPendingDepartmentKeyResults(
      req.user!.company_id,
      cycleId,
      departmentIdFilter,
    );

    const mapped = keyResults.map((kr: any) => {
      const dept =
        kr.employeeObjective?.user?.employee?.employments?.[0]?.department;

      return {
        ...kr,
        departmentObjective: {
          id: kr.employeeObjective?.id,
          title: kr.employeeObjective?.title,
          department: {
            id: dept?.id,
            name: dept?.name || "Unknown Department",
          },
        },
      };
    });

    res.status(200).json({
      status: "success",
      results: mapped.length,
      data: mapped,
    });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentObjectiveDetail = async (
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
    const objective = await deptService.getDepartmentObjectiveDetail(
      id,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", data: objective });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const createDepartmentObjective = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      department_id,
      company_kr_id,
      cycle_id,
      title,
      execution_mode,
      description,
    } = req.body;

    console.log("hello there");
    const departmentId = parsePositiveInt(department_id);
    const companyKrId = parsePositiveInt(company_kr_id);
    const hasCycleId =
      cycle_id !== undefined && cycle_id !== null && cycle_id !== "";
    const cycleId = hasCycleId ? parsePositiveInt(cycle_id) : undefined;
    const allowedExecutionModes = ["DIRECT_ADOPTION", "CUSTOMIZED"] as const;
    type ExecutionMode = (typeof allowedExecutionModes)[number];

    // Validation: title is only strictly required if mode is DECOMPOSED
    if (departmentId === null || companyKrId === null || !execution_mode) {
      return res.status(400).json({
        status: "fail",
        message:
          "department_id, company_kr_id, and execution_mode are required.",
      });
    }

    if (!allowedExecutionModes.includes(execution_mode as ExecutionMode)) {
      return res.status(400).json({
        status: "fail",
        message: "execution_mode must be DIRECT_ADOPTION or CUSTOMIZED.",
      });
    }

    if (hasCycleId && cycleId === null) {
      return res.status(400).json({
        status: "fail",
        message: "cycle_id must be a positive integer when provided.",
      });
    }

    const normalizedCycleId: number | undefined = hasCycleId
      ? (cycleId as number)
      : undefined;

    if (execution_mode === "CUSTOMIZED" && !title) {
      return res.status(400).json({
        status: "fail",
        message: "A custom title is required for customized objectives.",
      });
    }

    const objective = await deptService.createDepartmentObjective({
      companyId: req.user!.company_id,
      departmentId,
      companyKrId,
      cycleId: normalizedCycleId,
      title: title,
      executionMode: execution_mode as ExecutionMode,
      description: description,
      createdBy: req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: objective });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });

    if (
      error.message?.includes("ownership") ||
      error.message?.includes("published") ||
      error.message?.includes("cycle_id") ||
      error.message?.includes("Title") ||
      error.message?.includes("Description") ||
      error.message?.includes("required")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }

    next(error);
  }
};
export const adoptCompanyKR = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { department_id, company_kr_id } = req.body;
    const departmentId = parsePositiveInt(department_id);
    const companyKrId = parsePositiveInt(company_kr_id);
    if (departmentId === null || companyKrId === null) {
      return res.status(400).json({
        status: "fail",
        message: "department_id and company_kr_id are required.",
      });
    }

    const obj = await deptService.adoptCompanyKR(
      req.user!.company_id,
      departmentId,
      companyKrId,
      req.user!.user_id,
    );

    res.status(201).json({ status: "success", data: obj });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("already adopted") ||
      error.message?.includes("Only published")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const publishDepartmentObjective = async (
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
    const result = await deptService.publishDepartmentObjective(
      id,
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("already published") ||
      error.message?.includes("transition")
    )
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const submitDepartmentObjective = async (
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
    const result = await deptService.submitDepartmentObjective(
      id,
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("transition") ||
      error.message?.includes("weight")
    )
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const approveDepartmentObjective = async (
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
    // 1. Resolve department ID for access check
    const objective = await prisma.employeeObjective.findUnique({
      where: { id },
      select: { user_id: true, company_id: true },
    });

    if (!objective || objective.company_id !== req.user!.company_id) {
      return res
        .status(404)
        .json({ status: "fail", message: "Department objective not found." });
    }

    const ownerUser = await prisma.appUser.findFirst({
      where: {
        employee_id: objective.user_id,
        company_id: objective.company_id,
      },
      include: {
        employee: { include: { employments: { where: { is_active: true } } } },
      },
    });

    const departmentId = ownerUser?.employee?.employments[0]?.department_id;
    if (!departmentId) {
      return res.status(404).json({
        status: "fail",
        message: "Department not found for this objective's owner.",
      });
    }

    // 2. Perform access check
    const hasAccess = await checkDepartmentAccess(
      req.user!,
      departmentId,
      req.user!.company_id,
    );
    if (!hasAccess) {
      return res.status(403).json({
        status: "fail",
        message:
          "You do not have permission to approve this department's OKRs.",
      });
    }

    const result = await deptService.approveDepartmentObjective(
      id,
      req.user!.company_id,
      req.user!.user_id,
      req.user!.role,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("transition") ||
      error.message?.includes("authorized")
    )
      return res.status(403).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const bulkSubmitDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { objective_ids, kr_ids } = req.body;
    if (!objective_ids && !kr_ids) {
      return res.status(400).json({
        status: "fail",
        message: "objective_ids or kr_ids are required.",
      });
    }

    const result = await deptService.bulkSubmitDepartment(
      objective_ids || [],
      kr_ids || [],
      req.user!.company_id,
      req.user!.user_id,
    );

    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("not found") ||
      error.message?.includes("transition") ||
      error.message?.includes("submitted") ||
      error.message?.includes("Published")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const bulkApproveDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { objective_ids, kr_ids, action, comments } = req.body;
    if (!objective_ids && !kr_ids) {
      return res.status(400).json({
        status: "fail",
        message: "objective_ids or kr_ids are required.",
      });
    }

    const result = await deptService.bulkApproveDepartment(
      objective_ids || [],
      kr_ids || [],
      req.user!.company_id,
      req.user!.user_id,
      req.user!.role,
      action,
      comments,
    );

    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("not found") ||
      error.message?.includes("transition") ||
      error.message?.includes("approved") ||
      error.message?.includes("Published")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── Department Key Results ───────────────────────────────────────────────────

export const createDepartmentKR = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeObjectiveId = parsePositiveInt(req.params.id);
    if (employeeObjectiveId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const {
      title,
      description,
      metric_definition_id,
      unit_of_measure,
      target_value,
      weight_percent,
      contributes_to_score,
      contributes_to_value,
      is_mandatory,
      contributor_user_id,
      contributor_user_ids,
      contributor_role_type,
      is_direct,
      is_required_for_completion,
    } = req.body;

    const metricDefinitionId = parsePositiveInt(metric_definition_id);
    const targetValue = parseOptionalFiniteNumber(target_value);
    const weightPercent = parseOptionalFiniteNumber(weight_percent);

    if (metricDefinitionId === null) {
      return res.status(400).json({
        status: "fail",
        message:
          "metric_definition_id is required and must be a positive integer.",
      });
    }

    if (targetValue === null) {
      return res.status(400).json({
        status: "fail",
        message: "target_value must be a valid number when provided.",
      });
    }

    if (weightPercent === null) {
      return res.status(400).json({
        status: "fail",
        message: "weight_percent must be a valid number when provided.",
      });
    }

    if (!title)
      return res.status(400).json({
        status: "fail",
        message: "title is required.",
      });

    const hasContributorUserId =
      typeof contributor_user_id === "string" &&
      contributor_user_id.trim().length > 0;
    const hasContributorRoleType =
      typeof contributor_role_type === "string" &&
      contributor_role_type.trim().length > 0;

    const allowedContributorRoleTypes = [
      "EMPLOYEE",
      "TEAM_LEADER",
      "MANAGER",
      "DIRECTOR",
      "DEPARTMENT_HEAD",
    ] as const;
    type ContributorRoleType = (typeof allowedContributorRoleTypes)[number];

    if (hasContributorUserId !== hasContributorRoleType) {
      return res.status(400).json({
        status: "fail",
        message:
          "contributor_user_id and contributor_role_type must be provided together.",
      });
    }

    if (
      hasContributorRoleType &&
      !allowedContributorRoleTypes.includes(
        contributor_role_type as ContributorRoleType,
      )
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "contributor_role_type must be one of EMPLOYEE, TEAM_LEADER, MANAGER, DIRECTOR, DEPARTMENT_HEAD.",
      });
    }

    const contributorRoleType = hasContributorRoleType
      ? (contributor_role_type as ContributorRoleType)
      : undefined;

    if (is_required_for_completion !== undefined && !hasContributorUserId) {
      return res.status(400).json({
        status: "fail",
        message:
          "is_required_for_completion can only be set when contributor_user_id and contributor_role_type are provided.",
      });
    }

    const kr = await deptService.createDepartmentKR({
      companyId: req.user!.company_id,
      employeeObjectiveId,
      title,
      description,
      metricDefinitionId,
      unitOfMeasure: unit_of_measure,
      targetValue,
      weightPercent,
      contributesToScore: contributes_to_score,
      contributesToValue: contributes_to_value,
      isDirect: is_direct,
      isMandatory: is_mandatory,
      contributorUserId: hasContributorUserId ? contributor_user_id : undefined,
      contributorUserIds: Array.isArray(contributor_user_ids)
        ? contributor_user_ids
        : undefined,
      contributorRoleType,
      contributorRequiredForCompletion: hasContributorUserId
        ? is_required_for_completion
        : undefined,
      createdBy: req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: kr });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("published") ||
      error.message?.includes("Maximum") ||
      error.message?.includes("Total weight") ||
      error.message?.includes("mismatch") ||
      error.message?.includes("metric") ||
      error.message?.includes("Title") ||
      error.message?.includes("Description") ||
      error.message?.includes("required") ||
      error.message?.includes("contributor") ||
      error.message?.includes("employment")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const updateDepartmentKR = async (
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
    const {
      title,
      description,
      metric_definition_id,
      unit_of_measure,
      target_value,
      weight_percent,
      contributes_to_score,
      contributes_to_value,
      is_direct,
      is_mandatory,
    } = req.body;

    const metricDefinitionId =
      metric_definition_id === undefined ||
      metric_definition_id === null ||
      metric_definition_id === ""
        ? undefined
        : parsePositiveInt(metric_definition_id);
    const targetValue = parseOptionalFiniteNumber(target_value);
    const weightPercent = parseOptionalFiniteNumber(weight_percent);

    if (metricDefinitionId === null) {
      return res.status(400).json({
        status: "fail",
        message:
          "metric_definition_id must be a positive integer when provided.",
      });
    }

    if (targetValue === null) {
      return res.status(400).json({
        status: "fail",
        message: "target_value must be a valid number when provided.",
      });
    }

    if (weightPercent === null) {
      return res.status(400).json({
        status: "fail",
        message: "weight_percent must be a valid number when provided.",
      });
    }

    const kr = await deptService.updateDepartmentKR(id, req.user!.company_id, {
      title,
      description,
      metricDefinitionId,
      unitOfMeasure: unit_of_measure,
      targetValue,
      weightPercent,
      contributesToScore: contributes_to_score,
      contributesToValue: contributes_to_value,
      isDirect: is_direct,
      isMandatory: is_mandatory,
    });

    res.status(200).json({ status: "success", data: kr });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("draft") ||
      error.message?.includes("Total weight") ||
      error.message?.includes("mismatch") ||
      error.message?.includes("metric") ||
      error.message?.includes("weight_percent")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const listDepartmentKRs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const objectiveId = parsePositiveInt(req.params.id);
    if (objectiveId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const objective = await prisma.employeeObjective.findUnique({
      where: { id: objectiveId },
      select: { company_id: true, user_id: true },
    });

    if (!objective || objective.company_id !== req.user!.company_id) {
      return res.status(404).json({
        status: "fail",
        message: "Department objective not found.",
      });
    }

    const user = await prisma.appUser.findFirst({
      where: {
        employee_id: objective.user_id,
        company_id: objective.company_id,
      },
      select: {
        employee: {
          select: {
            employments: {
              where: { is_active: true },
              select: { department_id: true },
            },
          },
        },
      },
    });

    const departmentId = user?.employee?.employments[0]?.department_id;

    if (!departmentId) {
      return res.status(404).json({
        status: "fail",
        message: "Department not found for this objective's owner.",
      });
    }

    const hasAccess = await checkDepartmentAccess(
      req.user!,
      departmentId,
      req.user!.company_id,
    );

    if (!hasAccess) {
      return res.status(403).json({
        status: "fail",
        message:
          "You do not have permission to view this department's key results.",
      });
    }

    const krs = await deptService.listDepartmentKRs(
      objectiveId,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", results: krs.length, data: krs });
  } catch (error) {
    next(error);
  }
};

export const publishDepartmentKeyResult = async (
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
    const result = await deptService.publishDepartmentKeyResult(
      id,
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("already published"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const submitDepartmentKeyResult = async (
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
    const result = await deptService.submitDepartmentKeyResult(
      id,
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("transition") ||
      error.message?.includes("submitted") ||
      error.message?.includes("Published")
    )
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const approveDepartmentKeyResult = async (
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
    const { action, comments } = req.body || {};
    // 1. Resolve department ID for access check
    const kr = await prisma.employeeKeyResult.findUnique({
      where: { id },
      include: { employeeObjective: { select: { user_id: true } } },
    });

    if (!kr || kr.company_id !== req.user!.company_id) {
      return res
        .status(404)
        .json({ status: "fail", message: "Department key result not found." });
    }

    const ownerUser = await prisma.appUser.findFirst({
      where: {
        employee_id: kr.employeeObjective.user_id,
        company_id: kr.company_id,
      },
      include: {
        employee: { include: { employments: { where: { is_active: true } } } },
      },
    });

    const departmentId = ownerUser?.employee?.employments[0]?.department_id;
    if (!departmentId) {
      return res.status(404).json({
        status: "fail",
        message: "Department not found for this KR's owner.",
      });
    }

    // 2. Perform access check
    const hasAccess = await checkDepartmentAccess(
      req.user!,
      departmentId,
      req.user!.company_id,
    );
    if (!hasAccess) {
      return res.status(403).json({
        status: "fail",
        message:
          "You do not have permission to approve this department's key results.",
      });
    }

    const result = await deptService.approveDepartmentKeyResult(
      id,
      req.user!.company_id,
      req.user!.user_id,
      req.user!.role,
      action,
      comments,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("transition") ||
      error.message?.includes("approved") ||
      error.message?.includes("Published")
    )
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

// ─── Month Plan ───────────────────────────────────────────────────────────────

export const createMonthPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeKrId = parsePositiveInt(req.params.id);
    if (employeeKrId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }

    const {
      month_number,
      description,
      metric_definition_id,
      target_value,
      current_value,
      weight_percent,
      is_direct,
    } = req.body;
    console.log("the target value for the month plan", target_value);

    const metricDefinitionId = parsePositiveInt(metric_definition_id);
    const targetValue = parseOptionalFiniteNumber(
      target_value.items.target_value,
    );
    const weightPercent = parseOptionalFiniteNumber(weight_percent);

    const plan = await deptService.createMonthPlan({
      companyId: req.user!.company_id,
      employeeKrId,
      monthNumber: Number(month_number),
      description,
      metricDefinitionId: metricDefinitionId || undefined,
      targetValue: targetValue || undefined,
      currentValue: current_value,
      weightPercent: weightPercent || undefined,
      isDirect: is_direct,
      createdBy: req.user!.user_id,
      actorRole: req.user!.role,
    });

    res.status(201).json({ status: "success", data: plan });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("must be between") ||
      error.message?.includes("must exist before") ||
      error.message?.includes("disabled") ||
      error.message?.includes("not available")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const listMonthPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeKrId = parsePositiveInt(req.params.id);
    if (employeeKrId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const plans = await deptService.listMonthPlans(
      employeeKrId,
      req.user!.company_id,
    );
    res
      .status(200)
      .json({ status: "success", results: plans.length, data: plans });
  } catch (error) {
    next(error);
  }
};

// ─── Weekly Plan ───────────────────────────────────────────────────────────────

export const createWeeklyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeKrId = parsePositiveInt(req.params.id);
    if (employeeKrId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const {
      week_number,
      description,
      metric_definition_id,
      target_value,
      current_value,
      is_direct,
    } = req.body;

    const weekNumber = parsePositiveInt(week_number);
    const metricDefinitionId =
      metric_definition_id === undefined ||
      metric_definition_id === null ||
      metric_definition_id === ""
        ? undefined
        : parsePositiveInt(metric_definition_id);
    const targetValue = parseOptionalFiniteNumber(target_value);
    const currentValue = parseOptionalFiniteNumber(current_value);

    if (req.body?.confidence_level !== undefined) {
      return res.status(400).json({
        status: "fail",
        message:
          "confidence_level is system-generated. Provide current_value and target_value instead.",
      });
    }

    if (weekNumber === null || !description) {
      return res.status(400).json({
        status: "fail",
        message: "week_number and description are required.",
      });
    }

    if (metricDefinitionId === null) {
      return res.status(400).json({
        status: "fail",
        message:
          "metric_definition_id must be a positive integer when provided.",
      });
    }

    if (targetValue === null || currentValue === null) {
      return res.status(400).json({
        status: "fail",
        message:
          "target_value and current_value must be valid numbers when provided.",
      });
    }

    const plan = await deptService.createWeeklyPlan({
      companyId: req.user!.company_id,
      employeeKrId,
      weekNumber,
      description,
      metricDefinitionId,
      targetValue,
      currentValue,
      isDirect: is_direct,
      createdBy: req.user!.user_id,
      actorRole: req.user!.role,
    });

    res.status(201).json({ status: "success", data: plan });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("disabled") ||
      error.message?.includes("not available")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const listWeeklyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeKrId = parsePositiveInt(req.params.id);
    if (employeeKrId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const plans = await deptService.listWeeklyPlans(
      employeeKrId,
      req.user!.company_id,
    );
    res
      .status(200)
      .json({ status: "success", results: plans.length, data: plans });
  } catch (error) {
    next(error);
  }
};

// ─── Department Daily Plans ──────────────────────────────────────────────────

export const createDepartmentDailyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const weekly_task_id_from_params = parsePositiveInt(req.params.id);
    if (weekly_task_id_from_params === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const {
      title,
      weekly_task_ref,
      completion_day,
      description,
      target_value,
      current_value,
    } = req.body;

    const targetValue = parseOptionalFiniteNumber(target_value);

    const dailyPlan = await deptService.createDepartmentDailyPlan({
      companyId: req.user!.company_id,
      weeklyTaskId: weekly_task_id_from_params,
      title,
      weeklyTaskRef: weekly_task_ref,
      completionDay: completion_day,
      description,
      targetValue: targetValue || undefined,
      currentValue: current_value,
      createdBy: req.user!.user_id,
      actorRole: req.user!.role,
    });

    res.status(201).json({ status: "success", data: dailyPlan });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    if (
      error.message?.includes("disabled") ||
      error.message?.includes("not available")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const updateDepartmentDailyPlan = async (
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
    const {
      title,
      weekly_task_ref,
      completion_day,
      description,
      status_code,
      metric_definition_id,
      target_value,
      current_value,
      is_direct,
    } = req.body;

    const metricDefinitionId =
      metric_definition_id === undefined ||
      metric_definition_id === null ||
      metric_definition_id === ""
        ? undefined
        : parsePositiveInt(metric_definition_id);
    const targetValue = parseOptionalFiniteNumber(target_value);
    const currentValue = parseOptionalFiniteNumber(current_value);

    if (
      req.body?.progress_percent !== undefined ||
      req.body?.confidence_level !== undefined
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "progress_percent and confidence_level are system-generated. Provide current_value and target_value instead.",
      });
    }

    if (metricDefinitionId === null) {
      return res.status(400).json({
        status: "fail",
        message:
          "metric_definition_id must be a positive integer when provided.",
      });
    }

    if (targetValue === null || currentValue === null) {
      return res.status(400).json({
        status: "fail",
        message:
          "target_value and current_value must be valid numbers when provided.",
      });
    }

    const dailyPlan = await deptService.updateDepartmentDailyPlan(
      id,
      req.user!.company_id,
      {
        title,
        weeklyTaskRef: weekly_task_ref,
        completionDay: completion_day,
        description,
        statusCode: status_code,
        metricDefinitionId,
        targetValue,
        currentValue,
        isDirect: is_direct,
      },
    );

    res.status(200).json({ status: "success", data: dailyPlan });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const deleteDepartmentDailyPlan = async (
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
    const result = await deptService.deleteDepartmentDailyPlan(
      id,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const listDepartmentDailyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const weeklyTaskId = parsePositiveInt(req.params.id);
    if (weeklyTaskId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }
    const dailyPlans = await deptService.listDepartmentDailyPlans(
      weeklyTaskId,
      req.user!.company_id,
    );

    res.status(200).json({
      status: "success",
      results: dailyPlans.length,
      data: dailyPlans,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Department Unified Approvals ────────────────────────────────────────────────

export const listPendingDepartmentApprovals = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parsePositiveInt(req.query.cycle_id);
    const departmentIdRaw = req.query.department_id;
    const departmentId = departmentIdRaw !== undefined ? parsePositiveInt(departmentIdRaw) : undefined;

    if (cycleId === null) {
      return res.status(400).json({ status: "fail", message: "cycle_id query param required." });
    }

    if (departmentIdRaw !== undefined && departmentId === null) {
      return res.status(400).json({
        status: "fail",
        message: "department_id must be a positive integer.",
      });
    }

    const approvals = await deptService.listPendingDepartmentApprovals(
      req.user!.company_id,
      cycleId,
      departmentId !== undefined ? (departmentId as number) : undefined,
    );

    res.status(200).json({ status: "success", data: approvals });
  } catch (error) {
    next(error);
  }
};

export const bulkApproveDepartmentItems = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { objective_ids, kr_ids, month_plan_ids, weekly_plan_ids, daily_plan_ids, action, comments } = req.body;

    if (!objective_ids && !kr_ids && !month_plan_ids && !weekly_plan_ids && !daily_plan_ids) {
      return res.status(400).json({
        status: "fail",
        message: "At least one list of entity IDs is required.",
      });
    }

    const result = await deptService.bulkApproveDepartmentItems(
      objective_ids || [],
      kr_ids || [],
      month_plan_ids || [],
      weekly_plan_ids || [],
      daily_plan_ids || [],
      req.user!.company_id,
      req.user!.user_id,
      action,
      comments,
    );

    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("not found") ||
      error.message?.includes("transition") ||
      error.message?.includes("approved") ||
      error.message?.includes("Published")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const approveDepartmentItem = async (
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

    const result = await deptService.approveDepartmentItem(
      entity_type,
      Number(entity_id),
      req.user!.company_id,
      req.user!.user_id,
      action,
      comments,
    );

    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("not found") ||
      error.message?.includes("transition") ||
      error.message?.includes("approved") ||
      error.message?.includes("Published")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};
