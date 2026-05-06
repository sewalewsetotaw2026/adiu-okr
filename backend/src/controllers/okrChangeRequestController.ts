import { Request, Response, NextFunction } from "express";
import * as changeRequestService from "src/services/okrChangeRequestService";

// ─── Create Change Request ─────────────────────────────────────────────────────

export const createChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity_type, entity_id, new_values, parent_change_request_id } = req.body;
    if (!entity_type || !entity_id || !new_values) {
      return res.status(400).json({ status: "fail", message: "entity_type, entity_id, and new_values are required." });
    }

    const cr = await changeRequestService.createChangeRequest({
      companyId: req.user!.company_id,
      entityType: entity_type,
      entityId: Number(entity_id),
      requesterId: req.user!.employee_id || req.user!.user_id,
      newValues: new_values,
      parentChangeRequestId: parent_change_request_id ? Number(parent_change_request_id) : undefined,
    });

    res.status(201).json({ status: "success", data: cr });
  } catch (error: any) {
    next(error);
  }
};

// ─── Approve Change Request ────────────────────────────────────────────────────

export const approveChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ status: "fail", message: "Valid numeric ID required." });

    const { comment } = req.body;
    const result = await changeRequestService.approveChangeRequest({
      changeRequestId: id,
      reviewerId: req.user!.employee_id || req.user!.user_id,
      companyId: req.user!.company_id,
      comment,
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized") || error.message?.includes("already")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── Reject Change Request ─────────────────────────────────────────────────────

export const rejectChangeRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ status: "fail", message: "Valid numeric ID required." });

    const { comment } = req.body;
    if (!comment?.trim()) {
      return res.status(400).json({ status: "fail", message: "A comment/reason is required for rejection." });
    }

    const result = await changeRequestService.rejectChangeRequest({
      changeRequestId: id,
      reviewerId: req.user!.employee_id || req.user!.user_id,
      companyId: req.user!.company_id,
      comment,
    });
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    if (error.message?.includes("Unauthorized") || error.message?.includes("already")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── List Change Requests ──────────────────────────────────────────────────────

export const listChangeRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cycle_id, status, requester_id, reviewer_id } = req.query;

    const data = await changeRequestService.listChangeRequests({
      companyId: req.user!.company_id,
      cycleId: cycle_id ? Number(cycle_id) : undefined,
      status: status ? String(status) : undefined,
      requesterId: requester_id ? String(requester_id) : undefined,
      reviewerId: reviewer_id ? String(reviewer_id) : undefined,
    });
    res.status(200).json({ status: "success", results: data.length, data });
  } catch (error: any) {
    next(error);
  }
};

// ─── Get Change Request Detail ─────────────────────────────────────────────────

export const getChangeRequestDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ status: "fail", message: "Valid numeric ID required." });

    const data = await changeRequestService.getChangeRequestDetail(id, req.user!.company_id);
    res.status(200).json({ status: "success", data });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── List My Pending Change Requests (reviewer view) ───────────────────────────

export const listMyPendingReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cycle_id } = req.query;
    const data = await changeRequestService.listChangeRequests({
      companyId: req.user!.company_id,
      cycleId: cycle_id ? Number(cycle_id) : undefined,
      status: "PENDING",
      reviewerId: req.user!.employee_id || req.user!.user_id,
    });
    res.status(200).json({ status: "success", results: data.length, data });
  } catch (error: any) {
    next(error);
  }
};

// ─── List My Realignment Flags ─────────────────────────────────────────────────

export const listMyRealignmentFlags = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const data = await changeRequestService.listMyRealignmentFlags({
      companyId: req.user!.company_id,
      employeeId: req.user!.employee_id || req.user!.user_id,
      status: status ? String(status) : undefined,
    });
    res.status(200).json({ status: "success", results: data.length, data });
  } catch (error: any) {
    next(error);
  }
};

// ─── Acknowledge Realignment ───────────────────────────────────────────────────

export const acknowledgeRealignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ status: "fail", message: "Valid numeric ID required." });

    const result = await changeRequestService.acknowledgeRealignment(
      id,
      req.user!.employee_id || req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    next(error);
  }
};

// ─── Dismiss Realignment ───────────────────────────────────────────────────────

export const dismissRealignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ status: "fail", message: "Valid numeric ID required." });

    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ status: "fail", message: "A reason is required to dismiss." });
    }

    const result = await changeRequestService.dismissRealignment(
      id,
      req.user!.employee_id || req.user!.user_id,
      reason,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    next(error);
  }
};

// ─── Complete Realignment (after subordinate edits and re-submits) ──────────────

export const completeRealignment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ status: "fail", message: "Valid numeric ID required." });

    const result = await changeRequestService.completeRealignment(
      id,
      req.user!.employee_id || req.user!.user_id,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    next(error);
  }
};

// ─── Manager: Subordinate Alignment Status ─────────────────────────────────────

export const getSubordinateAlignmentStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cycle_id } = req.query;
    const data = await changeRequestService.getSubordinateAlignmentStatus({
      companyId: req.user!.company_id,
      managerId: req.user!.employee_id || req.user!.user_id,
      cycleId: cycle_id ? Number(cycle_id) : undefined,
    });
    res.status(200).json({ status: "success", data });
  } catch (error: any) {
    next(error);
  }
};

// ─── Check entity realignment flags (for UI banner) ────────────────────────────

export const getEntityRealignmentFlags = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) {
      return res.status(400).json({ status: "fail", message: "entity_type and entity_id are required." });
    }

    const data = await changeRequestService.getEntityRealignmentFlags({
      companyId: req.user!.company_id,
      entityType: String(entity_type),
      entityId: Number(entity_id),
    });
    res.status(200).json({ status: "success", data });
  } catch (error: any) {
    next(error);
  }
};
