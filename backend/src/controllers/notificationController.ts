import { Request, Response, NextFunction } from "express";
import {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
} from "../services/notificationService";

/**
 * Get notifications for the current user
 */
export const getMyNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const employeeId = req.user?.employee_id;
    const companyId = req.user?.company_id;

    if (!employeeId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID or Company ID not found",
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const is_read = req.query.is_read === "true" ? true : req.query.is_read === "false" ? false : undefined;
    const type = req.query.type as string;

    const result = await getNotifications(employeeId, companyId, {
      page,
      limit,
      is_read,
      type: type as any,
    });

    res.status(200).json({
      status: "success",
      message: "Notifications fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count
 */
export const getUnreadNotificationCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const employeeId = req.user?.employee_id;
    const companyId = req.user?.company_id;

    if (!employeeId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID or Company ID not found",
      });
    }

    const count = await getUnreadCount(employeeId, companyId);

    res.status(200).json({
      status: "success",
      message: "Unread count fetched successfully",
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const employeeId = req.user?.employee_id;

    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found",
      });
    }

    await markAsRead(Number(id), employeeId);

    res.status(200).json({
      status: "success",
      message: "Notification marked as read",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const employeeId = req.user?.employee_id;
    const companyId = req.user?.company_id;

    if (!employeeId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID or Company ID not found",
      });
    }

    await markAllAsRead(employeeId, companyId);

    res.status(200).json({
      status: "success",
      message: "All notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a notification
 */
export const deleteNotificationById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const employeeId = req.user?.employee_id;

    if (!employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID not found",
      });
    }

    await deleteNotification(Number(id), employeeId);

    res.status(200).json({
      status: "success",
      message: "Notification deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
