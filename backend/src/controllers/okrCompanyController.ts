import { Request, Response, NextFunction } from "express";
import * as companyService from "src/services/okrCompanyService";
import { getCurrentOpenCycle } from "src/services/okrCycleService";

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

// ─── Company Objectives ───────────────────────────────────────────────────────

export const createObjective = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { cycle_id, title, description } = req.body;
    if (!cycle_id || !title) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id and title are required." });
    }

    const objective = await companyService.createObjective({
      companyId: req.user!.company_id,
      cycleId: cycle_id,
      title,
      description,
      createdBy: req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: objective });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("Maximum") || error.message?.includes("OPEN")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const updateObjective = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description } = req.body;

    const objective = await companyService.updateObjective(
      id,
      req.user!.company_id,
      {
        title,
        description,
      },
    );

    res.status(200).json({ status: "success", data: objective });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("Only draft"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const listObjectives = async (
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

    const objectives = await companyService.listObjectives(
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

export const getObjectiveDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const objective = await companyService.getObjectiveDetail(
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

export const publishObjective = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await companyService.publishObjective(
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

export const publishCompanyPlanning = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { cycle_id } = req.body;
    if (!cycle_id)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });

    const result = await companyService.publishCompanyPlanning(
      cycle_id,
      req.user!.company_id,
      req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("No objectives") ||
      error.message?.includes("must be in") ||
      error.message?.includes("weights")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── Company Key Results ──────────────────────────────────────────────────────

export const createKeyResult = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const objectiveId = parseInt(req.params.id);
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
      assign_user_ids,
      assign_department_ids,
      assignUserIds,
      assignDepartmentIds,
    } = req.body;

    if (!title)
      return res
        .status(400)
        .json({ status: "fail", message: "title is required." });

    const kr = await companyService.createKeyResult({
      companyId: req.user!.company_id,
      objectiveId,
      title,
      description,
      metricDefinitionId: metric_definition_id,
      unitOfMeasure: unit_of_measure,
      targetValue: target_value,
      weightPercent: weight_percent,
      contributesToScore: contributes_to_score,
      contributesToValue: contributes_to_value,
      isDirect: is_direct,
      isMandatory: is_mandatory,
      assignUserIds: assign_user_ids || assignUserIds,
      assignDepartmentIds: assign_department_ids || assignDepartmentIds,
      createdBy: req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: kr });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("Maximum") ||
      error.message?.includes("OPEN") ||
      error.message?.includes("Total weight")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const updateKeyResult = async (
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
      is_direct,
      is_mandatory,
      assign_user_ids,
      assign_department_ids,
      assignUserIds,
      assignDepartmentIds,
    } = req.body;

    const kr = await companyService.updateKeyResult(id, req.user!.company_id, {
      title,
      description,
      metricDefinitionId: metric_definition_id,
      unitOfMeasure: unit_of_measure,
      targetValue: target_value,
      weightPercent: weight_percent,
      contributesToScore: contributes_to_score,
      contributesToValue: contributes_to_value,
      isDirect: is_direct,
      isMandatory: is_mandatory,
      assignUserIds: assign_user_ids || assignUserIds,
      assignDepartmentIds: assign_department_ids || assignDepartmentIds,
    });

    res.status(200).json({ status: "success", data: kr });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (
      error.message?.includes("draft") ||
      error.message?.includes("Total weight")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const listKeyResults = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const objectiveId = parseInt(req.params.id);
    const krs = await companyService.listKeyResults(
      objectiveId,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", results: krs.length, data: krs });
  } catch (error) {
    next(error);
  }
};

export const getKeyResultDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const kr = await companyService.getKeyResultDetail(
      id,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", data: kr });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const publishKeyResult = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    const result = await companyService.publishKeyResult(
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

export const assignUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const krId = parsePositiveInt(req.params.id);
    const { user_ids, department_ids, userIds, departmentIds } = req.body;
    if (krId === null) {
      return res
        .status(400)
        .json({ status: "fail", message: "id must be a positive integer." });
    }

    const finalUserIds = user_ids || userIds;
    const finalDeptIds = department_ids || departmentIds;

    const hasUsers =
      finalUserIds && Array.isArray(finalUserIds) && finalUserIds.length > 0;
    const hasDepts =
      finalDeptIds && Array.isArray(finalDeptIds) && finalDeptIds.length > 0;

    if (!hasUsers && !hasDepts) {
      return res.status(400).json({
        status: "fail",
        message: "user_ids or department_ids array is required.",
      });
    }

    const normalizedUserIds = hasUsers
      ? finalUserIds
          .map((id: unknown) => String(id).trim())
          .filter((id: string) => id.length > 0)
      : [];

    const results = await companyService.assignUsers(
      krId,
      req.user!.company_id,
      normalizedUserIds,
      req.user!.user_id,
      finalDeptIds,
    );

    res.status(200).json({ status: "success", data: results });
  } catch (error: any) {
    if (error.message?.includes("not found"))
      return res.status(404).json({ status: "fail", message: error.message });
    if (error.message?.includes("user_ids"))
      return res.status(400).json({ status: "fail", message: error.message });
    next(error);
  }
};

export const listAvailableCompanyKRs = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let cycleId = parseInt(req.query.cycle_id as string);
    const queryUserId = req.query.user_id as string;
    const departmentId = parseInt(req.query.department_id as string);

    let userId = queryUserId || (req.user as any)?.employee_id || req.user?.user_id;

    if (!userId && departmentId) {
      const heads = await companyService.resolveDepartmentHeads(req.user!.company_id, [departmentId]);
      if (heads.length > 0) {
        userId = heads[0];
      }
    }

    if (!userId) {
      return res.status(400).json({
        status: "fail",
        message: "user_id or department_id query param required.",
      });
    }

    if (!cycleId) {
      const openCycle = await getCurrentOpenCycle(req.user!.company_id);
      if (!openCycle) {
        return res.status(400).json({
          status: "fail",
          message:
            "No open cycle found. Provide cycle_id explicitly or open a cycle.",
        });
      }
      cycleId = openCycle.id;
    }

    const availableKrs = await companyService.listAvailableCompanyKRs(
      req.user!.company_id,
      cycleId,
      userId,
    );
    res.status(200).json({
      status: "success",
      results: availableKrs.length,
      data: availableKrs,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Metric Definitions ──────────────────────────────────────────────────────

export const listMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const metrics = await companyService.listMetrics();
    res
      .status(200)
      .json({ status: "success", results: metrics.length, data: metrics });
  } catch (error) {
    next(error);
  }
};
