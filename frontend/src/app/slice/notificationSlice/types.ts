export enum NotificationType {
  LEAVE_SUBMITTED = "LEAVE_SUBMITTED",
  LEAVE_APPROVED = "LEAVE_APPROVED",
  LEAVE_APPROVED_BY_MANAGER = "LEAVE_APPROVED_BY_MANAGER",
  LEAVE_REJECTED = "LEAVE_REJECTED",
  LEAVE_CANCELLED = "LEAVE_CANCELLED",
  RECALL_REQUEST = "RECALL_REQUEST",
  RECALL_ACCEPTED = "RECALL_ACCEPTED",
  RECALL_DECLINED = "RECALL_DECLINED",
  LEAVE_EXPIRING = "LEAVE_EXPIRING",
  BALANCE_LOW = "BALANCE_LOW",
  PROMOTION = "PROMOTION",
}

export interface Notification {
  id: number;
  company_id: number;
  recipient_id: string;
  type: NotificationType | string;
  title: string;
  message: string;
  action_url: string | null;
  related_entity_type: string | null;
  related_entity_id: number | null;
  is_read: boolean;
  email_sent: boolean;
  created_at: string;
  read_at: string | null;
  recipient?: any;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    total: number;
  };
}

export interface GetNotificationsPayload {
  page?: number;
  limit?: number;
  is_read?: boolean;
  type?: string;
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
