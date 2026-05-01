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

    const data = await empService.listAssignedKRsForEmployee(
      req.user!.company_id,
      userId,
      cycleId,
      includeAdopted,
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
      current_value,
      weight_percent,
      contributes_to_score,
      contributes_to_value,
      is_mandatory,
      execution_mode,
      contributor_user_ids,
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
      currentValue: current_value,
      weightPercent: weight_percent,
      contributesToScore: contributes_to_score,
      contributesToValue: contributes_to_value,
      isMandatory: is_mandatory,
      executionMode: execution_mode,
      createdBy: req.user!.user_id,
      contributorUserIds: contributor_user_ids,
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
      current_value,
      weight_percent,
      contributes_to_score,
      contributes_to_value,
      is_mandatory,
      contributor_user_ids,
    } = req.body;

    const kr = await empService.updateEmployeeKR(id, req.user!.company_id, {
      title,
      description,
      metricDefinitionId: metric_definition_id,
      unitOfMeasure: unit_of_measure,
      targetValue: target_value,
      currentValue: current_value,
      weightPercent: weight_percent,
      contributesToScore: contributes_to_score,
      contributesToValue: contributes_to_value,
      isMandatory: is_mandatory,
      contributorUserIds: contributor_user_ids,
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

// ─── Employee Month Plans ─────────────────────────────────────────────────────

export const createEmployeeMonthPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeObjectiveId = parseInt(req.params.id);
    if (isNaN(employeeObjectiveId)) {
      return res.status(400).json({
        status: "fail",
        message: "Valid numeric employee objective ID required in URL path.",
      });
    }

    console.log("the request body", req.body);
    const { month_number, description, items } = req.body;
    const title = description;

    if (
      !month_number ||
      !title ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "month_number, title, and at least one item are required.",
      });
    }

    const plan = await empService.createEmployeeMonthPlan({
      companyId: req.user!.company_id,
      employeeObjectiveId,
      monthNumber: Number(month_number),
      title,
      description,
      items: items.map((i: any) => ({
        employeeKrId: Number(i.employee_kr_id),
        title: i.title || "Untitled",
        targetValue: Number(i.target_value),
        currentValue: Number(i.current_value || 0),
        parentMonthPlanItemId: i.parent_employee_month_plan_item_id ? Number(i.parent_employee_month_plan_item_id) : undefined,
        note: i.note,
      })),
      createdBy: req.user!.user_id,
      actorRole: req.user!.role,
    });
    res.status(201).json({ status: "success", data: plan });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("must be") ||
      error.message?.includes("required") ||
      error.message?.includes("≥") ||
      error.message?.includes("duplicate")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const createEmployeeKRMonthPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeKrId = parseInt(req.params.id);
    if (isNaN(employeeKrId)) {
      return res.status(400).json({
        status: "fail",
        message: "Valid numeric employee key result ID required in URL path.",
      });
    }

    const {
      month_number,
      description,
      target_value,
      weight_percent,
      contributes_to_parent_score,
      contributes_to_parent_value,
    } = req.body;

    if (!month_number) {
      return res.status(400).json({
        status: "fail",
        message: "month_number is required.",
      });
    }

    const plan = await empService.createOrUpdateKRMonthPlan({
      companyId: req.user!.company_id,
      employeeKrId: Number(employeeKrId),
      monthNumber: Number(month_number),
      targetValue: Number(target_value),
      currentValue: Number(req.body.current_value || 0),
      description,
      contributesToParentScore: contributes_to_parent_score,
      contributesToParentValue: contributes_to_parent_value,
      weightPercent: weight_percent,
      createdBy: req.user!.user_id,
      actorRole: req.user!.role,
    });
    res.status(201).json({ status: "success", data: plan });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("approved"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const updateEmployeeMonthPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description } = req.body;

    const plan = await empService.updateEmployeeMonthPlan(
      id,
      req.user!.company_id,
      { title, description },
    );
    res.status(200).json({ status: "success", data: plan });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("Only draft"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const deleteEmployeeMonthPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.deleteEmployeeMonthPlan(
      id,
      req.user!.company_id,
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

export const listEmployeeMonthPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const objectiveId = parseInt(req.params.id);
    const plans = await empService.listEmployeeMonthPlans(
      objectiveId,
      req.user!.company_id,
    );
    res
      .status(200)
      .json({ status: "success", results: plans.length, data: plans });
  } catch (error) {
    next(error);
  }
};

export const listEmployeeKRMonthPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const krId = parseInt(req.params.id);
    if (isNaN(krId)) {
      return res.status(400).json({
        status: "fail",
        message: "Valid numeric employee key result ID required in URL path.",
      });
    }

    const plans = await empService.listEmployeeKRMonthPlans(
      krId,
      req.user!.company_id,
    );
    res
      .status(200)
      .json({ status: "success", results: plans.length, data: plans });
  } catch (error) {
    next(error);
  }
};

export const addMonthPlanItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const planId = parseInt(req.params.id);
    const { employee_kr_id, target_value, note } = req.body;
    const item = await empService.addMonthPlanItem(
      planId,
      req.user!.company_id,
      {
        employeeKrId: employee_kr_id,
        title: req.body.title || "Untitled",
        targetValue: target_value,
        currentValue: req.body.current_value
          ? Number(req.body.current_value)
          : 0,
        parentMonthPlanItemId: req.body.parent_employee_month_plan_item_id ? Number(req.body.parent_employee_month_plan_item_id) : undefined,
        note,
      },
      req.user!.user_id,
    );
    res.status(201).json({ status: "success", data: item });
  } catch (error) {
    next(error);
  }
};

export const removeMonthPlanItem = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const planId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const result = await empService.removeMonthPlanItem(
      planId,
      itemId,
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

// ─── Weekly Plans ─────────────────────────────────────────────────────────────
export const createWeeklyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    console.log("[DEBUG] createWeeklyPlans Body:", JSON.stringify(req.body, null, 2));
    const employeeMonthPlanId = parseInt(req.params.id);
    const {
      week_number,
      title,
      description,
      items,
      tasks,
    } = req.body;

    if (!week_number || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: "fail", message: "week_number and a non-empty items array are required." });
    }

    const plans = await empService.createWeeklyPlans({
      companyId: req.user!.company_id,
      employeeMonthPlanId,
      weekNumber: week_number,
      title,
      description,
      items: items.map((i: any) => ({
        employeeKrId: Number(i.employee_kr_id),
        employeeMonthPlanItemId: i.employee_month_plan_item_id ? Number(i.employee_month_plan_item_id) : undefined,
        targetValue: Number(i.target_value),
        currentValue: Number(i.current_value || 0),
        metricDefinitionId: i.metric_definition_id ? Number(i.metric_definition_id) : undefined,
        blockers: i.blockers,
        tasks: i.tasks,
      })),
      createdBy: req.user!.user_id,
      actorRole: req.user!.role,
    });
    
    res.status(201).json({ status: "success", data: plans });
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

export const createWeeklyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    console.log("[DEBUG] createWeeklyPlan Body:", JSON.stringify(req.body, null, 2));
    const employeeKrId = parseInt(req.params.id);
    const {
      week_number,
      employee_month_plan_id,
      blockers,
      metric_definition_id,
      target_value,
      current_value,
      contributes_to_parent_score,
      contributes_to_parent_value,
      title,
      tasks,
    } = req.body;

    delete req.body.confidence_level;

    if (!week_number)
      return res
        .status(400)
        .json({ status: "fail", message: "week_number is required." });

    const plan = await empService.createWeeklyPlan({
      companyId: req.user!.company_id,
      employeeKrId,
      employeeMonthPlanId: employee_month_plan_id,
      weekNumber: week_number,
      blockers,
      title,
      tasks,
      metricDefinitionId: metric_definition_id,
      targetValue: target_value,
      currentValue: current_value,
      contributesToParentScore: contributes_to_parent_score,
      contributesToParentValue: contributes_to_parent_value,
      employeeMonthPlanItemId: req.body.employee_month_plan_item_id ? Number(req.body.employee_month_plan_item_id) : undefined,
      parentWeeklyPlanId: req.body.parent_weekly_plan_id ? Number(req.body.parent_weekly_plan_id) : undefined,
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

export const updateWeeklyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    console.log("[DEBUG] updateWeeklyPlan Body:", JSON.stringify(req.body, null, 2));
    const id = parseInt(req.params.id);
    const {
      blockers,
      employee_month_plan_id,
      metric_definition_id,
      target_value,
      current_value,
      contributes_to_parent_score,
      contributes_to_parent_value,
      tasks,
    } = req.body;

    delete req.body.confidence_level;

    const plan = await empService.updateWeeklyPlan(id, req.user!.company_id, {
      blockers,
      employeeMonthPlanId: employee_month_plan_id,
      metricDefinitionId: metric_definition_id,
      targetValue: target_value,
      currentValue: current_value,
      contributesToParentScore: contributes_to_parent_score,
      contributesToParentValue: contributes_to_parent_value,
      tasks,
    });
    res.status(200).json({ status: "success", data: plan });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const deleteWeeklyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.deleteWeeklyPlan(id, req.user!.company_id);
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("Only draft"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const listWeeklyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const krId = parseInt(req.params.id);
    const plans = await empService.listWeeklyPlans(krId, req.user!.company_id);
    const weeklyPlansData = plans;
    console.log("[DEBUG] Fetched Weekly Plans:", weeklyPlansData);
    res
      .status(200)
      .json({ status: "success", results: plans.length, data: plans });
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

// ─── Daily Plans ───────────────────────────────────────────────────────────────

export const createDailyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    console.log("[DEBUG] createDailyPlan Body:", JSON.stringify(req.body, null, 2));
    const weeklyPlanId = parseInt(req.params.id);
    const {
      title,
      weekly_task_ref,
      completion_day,
      description,
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

    if (!title || !weekly_task_ref || !completion_day)
      return res.status(400).json({
        status: "fail",
        message: "title, weekly_task_ref, and completion_day are required.",
      });

    const dailyPlan = await empService.createDailyPlan({
      companyId: req.user!.company_id,
      weeklyTaskId: weeklyPlanId,
      title,
      weeklyTaskRef: weekly_task_ref,
      completionDay: completion_day,
      description,
      metricDefinitionId: metric_definition_id,
      targetValue: target_value,
      currentValue: current_value,
      contributesToParentScore: contributes_to_parent_score,
      contributesToParentValue: contributes_to_parent_value,
      createdBy: req.user!.user_id,
    });
    res.status(201).json({ status: "success", data: dailyPlan });
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

export const createDailyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    console.log("[DEBUG] createDailyPlans Body:", JSON.stringify(req.body, null, 2));
    const { completion_day, title, description, weekly_task_ref, items } =
      req.body;

    if (
      !completion_day ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "completion_day and a non-empty items array are required.",
      });
    }

    const dailyPlans = await empService.createDailyPlans({
      companyId: req.user!.company_id,
      completionDay: completion_day,
      title,
      description,
      weeklyTaskRef: weekly_task_ref,
      items: items.map((i: any) => ({
        weeklyTaskId: Number(i.weekly_task_id),
        targetValue: Number(i.target_value),
        currentValue: Number(i.current_value || 0),
        metricDefinitionId: i.metric_definition_id
          ? Number(i.metric_definition_id)
          : undefined,
      })),
      createdBy: req.user!.user_id,
      actorRole: req.user!.role,
    });

    res.status(201).json({ status: "success", data: dailyPlans });
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

export const updateDailyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const {
      title,
      weekly_task_ref,
      completion_day,
      description,
      status_code,
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

    const dailyPlan = await empService.updateDailyPlan(
      id,
      req.user!.company_id,
      {
        title,
        weeklyTaskRef: weekly_task_ref,
        completionDay: completion_day,
        description,
        statusCode: status_code,
        metricDefinitionId: metric_definition_id,
        targetValue: target_value,
        currentValue: current_value,
        contributesToParentScore: contributes_to_parent_score,
        contributesToParentValue: contributes_to_parent_value,
      },
    );
    res.status(200).json({ status: "success", data: dailyPlan });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const deleteDailyPlan = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await empService.deleteDailyPlan(id, req.user!.company_id);
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const listDailyPlans = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const weeklyPlanId = parseInt(req.params.id);
    const dailyPlans = await empService.listDailyPlans(
      weeklyPlanId,
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
      daily_plan_id,
      completion_day,
      current_value,
      target_value,
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
      dailyPlanId: daily_plan_id,
      completionDay: completion_day,
      currentValue: current_value,
      targetValue: target_value,
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

export const bulkSubmitEmployeePlanning = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { month_plan_ids, weekly_plan_ids, daily_plan_ids } = req.body;
    if (!month_plan_ids && !weekly_plan_ids && !daily_plan_ids) {
      return res.status(400).json({
        status: "fail",
        message:
          "month_plan_ids, weekly_plan_ids or daily_plan_ids are required.",
      });
    }

    const result = await empService.bulkSubmitEmployeePlanning(
      month_plan_ids || [],
      weekly_plan_ids || [],
      daily_plan_ids || [],
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

export const bulkPublishEmployeePlanning = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { month_plan_ids, weekly_plan_ids, daily_plan_ids } = req.body;
    if (!month_plan_ids && !weekly_plan_ids && !daily_plan_ids) {
      return res.status(400).json({
        status: "fail",
        message:
          "month_plan_ids, weekly_plan_ids or daily_plan_ids are required.",
      });
    }

    const result = await empService.bulkPublishEmployeePlanning(
      month_plan_ids || [],
      weekly_plan_ids || [],
      daily_plan_ids || [],
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("not found") ||
      error.message?.includes("transition") ||
      error.message?.includes("Published")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};
