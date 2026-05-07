import { Request, Response } from "express";
import { prisma } from "../app";
import { ChangeRequestStatus } from "@prisma/client";
import * as crService from "../services/okrChangeRequestService";

export const createChangeRequest = async (req: Request, res: Response) => {
  try {
    const { cycleId, entityType, entityId, newValues, changeSummary } =
      req.body;

    console.log("the request body", req.body);

    const requesterId = (req as any).user.employee_id;
    const companyId = (req as any).user.company_id;

    const cr = await crService.createChangeRequest({
      companyId,
      cycleId,
      entityType,
      entityId,
      requesterId,
      newValues,
      changeSummary,
    });

    res.status(201).json({
      success: true,
      message: "Change request submitted successfully.",
      data: cr,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getPendingChangeRequests = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).user.employee_id;
    const companyId = (req as any).user.company_id;
    console.log("it is begin");

    const requests = await prisma.okrChangeRequest.findMany({
      where: {
        company_id: companyId,
        reviewer_id: reviewerId,
        status: ChangeRequestStatus.PENDING,
      },
      include: {
        requester: {
          include: {
            employee: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
    console.log("the requests send", requests);

    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const approveChangeRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const approverId = (req as any).user.employee_id;

    await crService.approveChangeRequest(Number(id), approverId, comment);

    res.status(200).json({
      success: true,
      message: "Change request approved.",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const rejectChangeRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const approverId = (req as any).user.employee_id;

    await crService.rejectChangeRequest(Number(id), approverId, reason);

    res.status(200).json({
      success: true,
      message: "Change request rejected.",
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getMyRealignmentFlags = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.employee_id;
    const companyId = (req as any).user.company_id;

    const flags = await crService.getMyRealignmentFlags(userId, companyId);

    res.status(200).json({
      success: true,
      data: flags,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const acknowledgeRealignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.employee_id;

    await crService.acknowledgeRealignment(Number(id), userId);

    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const dismissRealignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user.employee_id;

    await crService.dismissRealignment(Number(id), userId, reason);

    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
