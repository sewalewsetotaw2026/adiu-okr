import { Request, Response, NextFunction } from "express";
import * as approvalService from "src/services/okrApprovalService";

export const submitForApproval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cycle_id, department_id, type } = req.body;
    if (!cycle_id || !type) {
      return res.status(400).json({ status: "fail", message: "cycle_id and type are required." });
    }

    const submission = await approvalService.submitForApproval({
      companyId: req.user!.company_id,
      cycleId: Number(cycle_id),
      submitterId: req.user!.user_id,
      departmentId: department_id ? Number(department_id) : undefined,
      type: type,
    });

    res.status(201).json({ status: "success", data: submission });
  } catch (error: any) {
    next(error);
  }
};

export const addReviewComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity_type, entity_id, comment } = req.body;
    if (!entity_type || !entity_id || !comment) {
      return res.status(400).json({ status: "fail", message: "entity_type, entity_id, and comment are required." });
    }

    const okrComment = await approvalService.addReviewComment({
      companyId: req.user!.company_id,
      entityType: entity_type,
      entityId: Number(entity_id),
      comment: comment,
      authorId: req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: okrComment });
  } catch (error: any) {
    next(error);
  }
};

export const approveSubmission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ status: "fail", message: "Valid numeric ID required." });

    const result = await approvalService.approveSubmission(id, req.user!.user_id);
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("Cannot approve")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};
