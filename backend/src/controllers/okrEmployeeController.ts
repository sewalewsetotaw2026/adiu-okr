import { Request, Response, NextFunction } from "express";
import * as empService from "src/services/okrEmployeeService";

// ─── Employee Objectives ──────────────────────────────────────────────────────

export const listEmployeeObjectives = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    if (!cycleId)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id query param required." });

    const requestedUserId = (req.query.user_id as string)?.trim();
    const role = String(req.user?.role || "");
    const isAdminLike = ["Admin", "CEO", "SUPER_ADMIN"].includes(role);

    const objectives = requestedUserId
      ? await empService.listEmployeeObjectives(
        requestedUserId,
        req.user!.company_id,
        cycleId,
      )
      : isAdminLike
        ? await empService.listEmployeeObjectivesForCycle(
          req.user!.company_id,
          cycleId,
        )
        : await empService.listEmployeeObjectives(
          [
            req.user!.user_id,
            String((req.user as any)?.employee_id || ""),
          ].filter((v) => !!v),
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

export const listAssignedKRs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleIdRaw = req.query.cycle_id as string | undefined;
    const cycleId = cycleIdRaw ? parseInt(cycleIdRaw) : undefined;
    const includeAdoptedRaw =
      (req.query.include_adopted as string | undefined)?.toLowerCase() ||
      "false";
    const includeAdopted = includeAdoptedRaw === "true";
    const requestedUserId = (req.query.user_id as string)?.trim();
    const userId = requestedUserId || req.user!.user_id;
    
    // Optional department ID for department heads viewing their execution dashboard
    const departmentIdRaw = req.query.department_id as string | undefined;
    const departmentId = departmentIdRaw ? parseInt(departmentIdRaw) : undefined;

    const data = await empService.listAssignedKRsForEmployee(
      req.user!.company_id,
      userId,
      cycleId,
      includeAdopted,
      departmentId,
    );

    res.status(200).json({ status: "success", results: data.length, data });
  } catch (error) {
    next(error);
  }
};

export const getEmployeeObjectiveDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res.status(400).json({
        status: "fail",
        message: "Valid numeric ID required in URL path.",
      });
    const objective = await empService.getEmployeeObjectiveDetail(
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

export const adoptAssignedKR = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      contributor_id,
      department_kr_id,
      employee_kr_id,
      cycle_id,
      user_id,
      execution_mode,
      title,
      description,
    } = req.body;
    const hasContributorId =
      contributor_id !== undefined && contributor_id !== null;
    const hasDepartmentKrId =
      department_kr_id !== undefined && department_kr_id !== null;
    const hasEmployeeKrId =
      employee_kr_id !== undefined && employee_kr_id !== null;
    const hasCycleId = cycle_id !== undefined && cycle_id !== null;

    const contributorId = hasContributorId ? Number(contributor_id) : undefined;
    const departmentKrId = hasDepartmentKrId
      ? Number(department_kr_id)
      : undefined;
    const employeeKrId = hasEmployeeKrId ? Number(employee_kr_id) : undefined;
    const cycleId = hasCycleId ? Number(cycle_id) : undefined;

    if (!contributorId && !departmentKrId && !employeeKrId) {
      return res.status(400).json({
        status: "fail",
        message:
          "Either contributor_id, company_kr_id, or employee_kr_id is required.",
      });
    }

    if (hasContributorId && !Number.isFinite(contributorId)) {
      return res.status(400).json({
        status: "fail",
        message: "contributor_id must be numeric.",
      });
    }

    if (hasDepartmentKrId && !Number.isFinite(departmentKrId)) {
      return res.status(400).json({
        status: "fail",
        message: "department_kr_id must be numeric.",
      });
    }

    if (hasEmployeeKrId && !Number.isFinite(employeeKrId)) {
      return res.status(400).json({
        status: "fail",
        message: "employee_kr_id must be numeric.",
      });
    }

    if (hasCycleId && !Number.isFinite(cycleId)) {
      return res.status(400).json({
        status: "fail",
        message: "cycle_id must be numeric.",
      });
    }

    if (
      !execution_mode ||
      !["DIRECT_ADOPTION", "CUSTOMIZED"].includes(execution_mode)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "execution_mode must be DIRECT_ADOPTION or CUSTOMIZED.",
      });
    }

    if (execution_mode === "CUSTOMIZED" && !String(title || "").trim()) {
      return res.status(400).json({
        status: "fail",
        message: "title is required for CUSTOMIZED adoption mode.",
      });
    }

    const role = String(req.user?.role || "");
    const isAdminLike = ["Admin", "CEO", "SUPER_ADMIN"].includes(role);
    const assignmentUserId =
      user_id && isAdminLike ? String(user_id) : req.user!.user_id;

    const result = await empService.adoptAssignedKR({
      companyId: req.user!.company_id,
      contributorId,
      companyKrId: departmentKrId,
      employeeKrId,
      cycleId,
      executionMode: execution_mode,
      title,
      description,
      assignmentUserId,
      actorId: req.user!.user_id,
    });

    res
      .status(result.created ? 201 : 200)
      .json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("Only active") ||
      error.message?.includes("required") ||
      error.message?.includes("execution_mode")
    )
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

// ─── Execution Mode ───────────────────────────────────────────────────────────

export const selectExecutionMode = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res.status(400).json({
        status: "fail",
        message: "Valid numeric ID required in URL path.",
      });
    const { execution_mode } = req.body;
    if (
      !execution_mode ||
      !["DIRECT_ADOPTION", "CUSTOMIZED"].includes(execution_mode)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "execution_mode must be DIRECT_ADOPTION or DECOMPOSED.",
      });
    }

    const result = await empService.selectExecutionMode(
      id,
      req.user!.company_id,
      execution_mode,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("Only") || error.message?.includes("only"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

// ─── Employee Key Results ─────────────────────────────────────────────────────

export const createEmployeeKR = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const objectiveId = parseInt(req.params.id);
    if (isNaN(objectiveId)) {
      return res.status(400).json({
        status: "fail",
        message: "Valid numeric employee objective ID required in URL path.",
      });
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
      execution_mode,
    } = req.body;

    if (!title)
      return res
        .status(400)
        .json({ status: "fail", message: "title is required." });

    const kr = await empService.createEmployeeKR({
      companyId: req.user!.company_id,
      employeeObjectiveId: objectiveId,
      title,
      description,
      metricDefinitionId: metric_definition_id,
      unitOfMeasure: unit_of_measure,
      targetValue: target_value,
      weightPercent: weight_percent,
      contributesToScore: contributes_to_score,
      contributesToValue: contributes_to_value,
      isMandatory: is_mandatory,
      executionMode: execution_mode,
      createdBy: req.user!.user_id,
    });
    res.status(201).json({ status: "success", data: kr });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("Maximum"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const updateEmployeeKR = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
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
    } = req.body;

    const kr = await empService.updateEmployeeKR(id, req.user!.company_id, {
      title,
      description,
      metricDefinitionId: metric_definition_id,
      unitOfMeasure: unit_of_measure,
      targetValue: target_value,
      weightPercent: weight_percent,
      contributesToScore: contributes_to_score,
      contributesToValue: contributes_to_value,
      isMandatory: is_mandatory,
    });
    res.status(200).json({ status: "success", data: kr });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("Only draft"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const deleteEmployeeKR = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.deleteEmployeeKR(
      id,
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("Only draft"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const listEmployeeKRs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const objectiveId = parseInt(req.params.id);
    if (isNaN(objectiveId)) {
      return res.status(400).json({
        status: "fail",
        message: "Valid numeric employee objective ID required in URL path.",
      });
    }
    const krs = await empService.listEmployeeKRs(
      objectiveId,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", results: krs.length, data: krs });
  } catch (error) {
    next(error);
  }
};

// ─── Subtasks ─────────────────────────────────────────────────────────────────

export const createSubtask = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeKrId = parseInt(req.params.id);
    const {
      title,
      description,
      target_month,
      target_week,
      sequence_order,
      metric_definition_id,
      target_value,
      current_value,
      contributes_to_parent_score,
      contributes_to_parent_value,
    } = req.body;

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

    if (!title)
      return res
        .status(400)
        .json({ status: "fail", message: "title is required." });

    const subtask = await empService.createSubtask({
      companyId: req.user!.company_id,
      employeeKrId,
      title,
      description,
      metricDefinitionId: metric_definition_id,
      targetValue: target_value,
      currentValue: current_value,
      contributesToParentScore: contributes_to_parent_score,
      contributesToParentValue: contributes_to_parent_value,
      targetMonth: target_month,
      targetWeek: target_week,
      sequenceOrder: sequence_order,
      createdBy: req.user!.user_id,
    });
    res.status(201).json({ status: "success", data: subtask });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const updateSubtask = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const {
      title,
      description,
      status_code,
      metric_definition_id,
      target_value,
      current_value,
      contributes_to_parent_score,
      contributes_to_parent_value,
      target_month,
      target_week,
      sequence_order,
    } = req.body;

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

    const subtask = await empService.updateSubtask(id, req.user!.company_id, {
      title,
      description,
      statusCode: status_code,
      metricDefinitionId: metric_definition_id,
      targetValue: target_value,
      currentValue: current_value,
      contributesToParentScore: contributes_to_parent_score,
      contributesToParentValue: contributes_to_parent_value,
      targetMonth: target_month,
      targetWeek: target_week,
      sequenceOrder: sequence_order,
    });
    res.status(200).json({ status: "success", data: subtask });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const deleteSubtask = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.deleteSubtask(id, req.user!.company_id);
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const listSubtasks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const krId = parseInt(req.params.id);
    const subtasks = await empService.listSubtasks(krId, req.user!.company_id);
    res
      .status(200)
      .json({ status: "success", results: subtasks.length, data: subtasks });
  } catch (error) {
    next(error);
  }
};

// ─── Progress Updates ─────────────────────────────────────────────────────────

export const submitProgressUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeKrId = parseInt(req.params.id);
    const {
      week_number,
      month_number,
      current_value,
      blockers,
      comment,
      is_completed,
      cycle_label,
    } = req.body;

    if (
      req.body?.confidence_level !== undefined ||
      req.body?.progress_percent !== undefined
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "confidence_level and progress_percent are system-generated. Provide current_value instead.",
      });
    }

    const update = await empService.submitProgressUpdate({
      companyId: req.user!.company_id,
      employeeKrId,
      weekNumber: week_number,
      monthNumber: month_number,
      currentValue: current_value,
      blockers,
      comment,
      isCompleted: is_completed,
      updatedBy: req.user!.user_id,
      cycleLabel: cycle_label,
    });
    res.status(201).json({ status: "success", data: update });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("Metric") ||
      error.message?.includes("cannot be negative")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const listProgressHistory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const krId = parseInt(req.params.id);
    const updates = await empService.listProgressHistory(
      krId,
      req.user!.company_id,
    );
    res
      .status(200)
      .json({ status: "success", results: updates.length, data: updates });
  } catch (error) {
    next(error);
  }
};

// ─── Publishing ───────────────────────────────────────────────────────────────

export const publishEmployeeObjective = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.publishEmployeeObjective(
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

export const publishEmployeeKeyResult = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.publishEmployeeKeyResult(
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

export const submitEmployeeObjective = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.submitEmployeeObjective(
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
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const submitEmployeeKeyResult = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.submitEmployeeKeyResult(
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
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const bulkPublishEmployee = async (
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

    const result = await empService.bulkPublishEmployee(
      objective_ids || [],
      kr_ids || [],
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const bulkSubmitEmployee = async (
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

    const result = await empService.bulkSubmitEmployee(
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

