import { prisma } from "../app";
import { broadcastNotification, broadcastUnreadCount } from "./sseService";

/**
 * Notification Service
 * Core service for managing in-app notifications
 */

export interface CreateNotificationData {
  company_id: number;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string;
  related_entity_type?: string;
  related_entity_id?: number;
  email_sent?: boolean;
}

export enum NotificationType {
  LEAVE_SUBMITTED = "LEAVE_SUBMITTED",
  LEAVE_APPROVED = "LEAVE_APPROVED",
  LEAVE_REJECTED = "LEAVE_REJECTED",
  LEAVE_CANCELLED = "LEAVE_CANCELLED",
  RECALL_REQUEST = "RECALL_REQUEST",
  RECALL_ACCEPTED = "RECALL_ACCEPTED",
  RECALL_DECLINED = "RECALL_DECLINED",
  LEAVE_EXPIRING = "LEAVE_EXPIRING",
  BALANCE_LOW = "BALANCE_LOW",
  PROMOTION = "PROMOTION",
  PROBATION_MILESTONE = "PROBATION_MILESTONE",
  PENSION_REMINDER = "PENSION_REMINDER",
}

export interface GetNotificationsOptions {
  page?: number;
  limit?: number;
  is_read?: boolean;
  type?: NotificationType;
}

/**
 * Create a new notification
 */
export const createNotification = async (
  data: CreateNotificationData
): Promise<any> => {
  try {
    const notification = await prisma.notification.create({
      data: {
        company_id: data.company_id,
        recipient_id: data.recipient_id,
        type: data.type,
        title: data.title,
        message: data.message,
        action_url: data.action_url || null,
        related_entity_type: data.related_entity_type || null,
        related_entity_id: data.related_entity_id || null,
        email_sent: data.email_sent || false,
      },
    });

    console.log(
      `[NotificationService] Created notification ${notification.id} for employee ${data.recipient_id}`
    );

    // Broadcast via SSE for real-time delivery
    broadcastNotification(data.recipient_id, data.company_id, notification);

    // Also broadcast updated unread count
    const unreadCount = await prisma.notification.count({
      where: {
        recipient_id: data.recipient_id,
        company_id: data.company_id,
        is_read: false,
      },
    });
    broadcastUnreadCount(data.recipient_id, data.company_id, unreadCount);

    return notification;
  } catch (error) {
    console.error("[NotificationService] Error creating notification:", error);
    throw error;
  }
};

/**
 * Get notifications for a user
 */
export const getNotifications = async (
  recipient_id: string,
  company_id: number,
  options: GetNotificationsOptions = {}
): Promise<{ notifications: any[]; total: number; page: number; totalPages: number }> => {
  try {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      recipient_id,
      company_id,
    };

    if (options.is_read !== undefined) {
      where.is_read = options.is_read;
    }

    if (options.type) {
      where.type = options.type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      notifications,
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error("[NotificationService] Error getting notifications:", error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markAsRead = async (
  notificationId: number,
  recipient_id: string
): Promise<any> => {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        recipient_id,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    return notification;
  } catch (error) {
    console.error("[NotificationService] Error marking as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = async (
  recipient_id: string,
  company_id: number
): Promise<any> => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        recipient_id,
        company_id,
        is_read: false,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    console.log(
      `[NotificationService] Marked ${result.count} notifications as read for ${recipient_id}`
    );

    return result;
  } catch (error) {
    console.error("[NotificationService] Error marking all as read:", error);
    throw error;
  }
};

/**
 * Get unread notification count
 */
export const getUnreadCount = async (
  recipient_id: string,
  company_id: number
): Promise<number> => {
  try {
    const count = await prisma.notification.count({
      where: {
        recipient_id,
        company_id,
        is_read: false,
      },
    });

    return count;
  } catch (error) {
    console.error("[NotificationService] Error getting unread count:", error);
    throw error;
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (
  notificationId: number,
  recipient_id: string
): Promise<any> => {
  try {
    const notification = await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        recipient_id,
      },
    });

    return notification;
  } catch (error) {
    console.error("[NotificationService] Error deleting notification:", error);
    throw error;
  }
};

/**
 * Delete old notifications (cleanup)
 */
export const deleteOldNotifications = async (
  daysOld: number = 90
): Promise<number> => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.notification.deleteMany({
      where: {
        created_at: {
          lt: cutoffDate,
        },
        is_read: true,
      },
    });

    console.log(
      `[NotificationService] Deleted ${result.count} old notifications`
    );

    return result.count;
  } catch (error) {
    console.error(
      "[NotificationService] Error deleting old notifications:",
      error
    );
    throw error;
  }
};
