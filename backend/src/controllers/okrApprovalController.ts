import { Request, Response, NextFunction } from "express";
import * as approvalService from "src/services/okrApprovalService";

export const submitForApproval = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { cycle_id, department_id, type } = req.body;
    if (!cycle_id || !type) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id and type are required." });
    }

    const submission = await approvalService.submitForApproval({
      companyId: req.user!.company_id,
      cycleId: Number(cycle_id),
      submitterId: req.user!.employee_id || req.user!.user_id,
      departmentId: department_id ? Number(department_id) : undefined,
      type: type,
    });

    res.status(201).json({ status: "success", data: submission });
  } catch (error: any) {
    next(error);
  }
};

export const addReviewComment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { entity_type, entity_id, comment } = req.body;
    if (!entity_type || !entity_id || !comment) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "entity_type, entity_id, and comment are required.",
        });
    }

    const okrComment = await approvalService.addReviewComment({
      companyId: req.user!.company_id,
      entityType: entity_type,
      entityId: Number(entity_id),
      comment: comment,
      authorId: req.user!.employee_id || req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: okrComment });
  } catch (error: any) {
    next(error);
  }
};

export const addBatchReviewComments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { feedbacks } = req.body;
    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      return res.status(400).json({
        status: "fail",
        message: "feedbacks array is required with at least one item",
      });
    }

    // Validate each feedback item
    for (const fb of feedbacks) {
      if (!fb.entity_type || !fb.entity_id || !fb.comment) {
        return res.status(400).json({
          status: "fail",
          message:
            "Each feedback must have entity_type, entity_id, and comment",
        });
      }
    }

    const result = await approvalService.addBatchReviewComments({
      companyId: req.user!.company_id,
      authorId: req.user!.employee_id || req.user!.user_id,
      feedbacks: feedbacks.map((fb: any) => ({
        entity_type: fb.entity_type,
        entity_id: Number(fb.entity_id),
        comment: fb.comment,
      })),
    });

    res.status(201).json({ status: "success", data: result });
  } catch (error: any) {
    next(error);
  }
};

export const approveSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res
        .status(400)
        .json({ status: "fail", message: "Valid numeric ID required." });

    const result = await approvalService.approveSubmission(
      id,
      req.user!.employee_id || req.user!.user_id,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("Cannot approve") ||
      error.message?.includes("Unauthorized")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const rejectSubmission = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res
        .status(400)
        .json({ status: "fail", message: "Valid numeric ID required." });

    const { reason } = req.body;
    if (!reason?.trim()) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "A reason is required for rejection.",
        });
    }

    const result = await approvalService.rejectSubmission({
      submissionId: id,
      reviewerId: req.user!.employee_id || req.user!.user_id,
      companyId: req.user!.company_id,
      reason: reason,
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (
      error.message?.includes("Unauthorized") ||
      error.message?.includes("already rejected")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const getSubmissionDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res
        .status(400)
        .json({ status: "fail", message: "Valid numeric ID required." });

    const detail = await approvalService.getSubmissionDetail(
      id,
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", data: detail });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const listManagerSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { cycle_id, status, type, search, department_id } = req.query;
    if (!cycle_id) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });
    }

    const submissions = await approvalService.listManagerSubmissions({
      reviewerUserId: req.user!.employee_id || req.user!.user_id,
      companyId: req.user!.company_id,
      cycleId: Number(cycle_id),
      status: status ? String(status) : undefined,
      type: type ? (String(type) as any) : undefined,
      search: search ? String(search) : undefined,
      departmentId: department_id ? Number(department_id) : undefined,
    });

    res.status(200).json({ status: "success", data: submissions });
  } catch (error: any) {
    next(error);
  }
};

export const listAdminSubmissions = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { cycle_id, status, type, search, department_id } = req.query;
    if (!cycle_id) {
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });
    }

    const submissions = await approvalService.listAdminSubmissions({
      companyId: req.user!.company_id,
      cycleId: Number(cycle_id),
      status: status ? String(status) : undefined,
      type: type ? (String(type) as any) : undefined,
      search: search ? String(search) : undefined,
      departmentId: department_id ? Number(department_id) : undefined,
    });

    res.status(200).json({ status: "success", data: submissions });
  } catch (error: any) {
    next(error);
  }
};

export const getEntityComments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) {
      return res
        .status(400)
        .json({
          status: "fail",
          message: "entity_type and entity_id are required query parameters.",
        });
    }

    const comments = await approvalService.getEntityComments({
      companyId: req.user!.company_id,
      entityType: entity_type as any,
      entityId: Number(entity_id),
    });

    res.status(200).json({ status: "success", data: comments });
  } catch (error: any) {
    next(error);
  }
};

export const getSubmissionComments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id))
      return res
        .status(400)
        .json({ status: "fail", message: "Valid numeric ID required." });

    const comments = await approvalService.getSubmissionComments({
      companyId: req.user!.company_id,
      submissionId: id,
    });
    res.status(200).json({ status: "success", data: comments });
  } catch (error: any) {
    next(error);
  }
};
