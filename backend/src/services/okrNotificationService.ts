import { createNotification, NotificationType } from "./notificationService";

export interface OkrNotificationParams {
  companyId: number;
  submissionId?: number;
  entityType?: string;
  entityId?: number;
  submitterName?: string;
  reviewerName?: string;
  approverName?: string;
  submitterEmployeeId?: string;
  reviewerUserId?: string;
  comment?: string;
  reason?: string;
  type?: string;
  itemCount?: number;
  isAdmin?: boolean;
}

export async function notifySubmissionCreated(params: OkrNotificationParams) {
  if (!params.reviewerUserId) return;

  const actionUrl = params.isAdmin
    ? "/admin/okr/approvals"
    : "/manager/okr/approvals";

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.reviewerUserId,
    type: NotificationType.OKR_SUBMITTED,
    title: "New OKR Submission",
    message: `${params.submitterName} has submitted their OKR plan for review.`,
    action_url: actionUrl,
    related_entity_type: "OKR_SUBMISSION",
    related_entity_id: params.submissionId,
  });
}

export async function notifyFeedbackGiven(params: OkrNotificationParams) {
  if (!params.submitterEmployeeId) return;

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.submitterEmployeeId,
    type: NotificationType.OKR_FEEDBACK,
    title: "OKR Feedback Received",
    message: `${params.reviewerName} left a comment on your OKR: "${params.comment?.substring(0, 50)}..."`,
    action_url: `/employee/execution`,
    related_entity_type: params.entityType,
    related_entity_id: params.entityId,
  });
}

export async function notifySubmissionApproved(params: OkrNotificationParams) {
  if (!params.submitterEmployeeId) return;

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.submitterEmployeeId,
    type: NotificationType.OKR_APPROVED,
    title: "OKR Submission Approved",
    message: `Your OKR submission has been approved by ${params.approverName}.`,
    action_url: `/employee/execution`,
    related_entity_type: "OKR_SUBMISSION",
    related_entity_id: params.submissionId,
  });
}

export async function notifyAutoPublished(params: OkrNotificationParams) {
  if (!params.submitterEmployeeId) return;

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.submitterEmployeeId,
    type: NotificationType.OKR_PUBLISHED,
    title: "OKR Published",
    message: `Your OKR plan has been approved and published by ${params.approverName}.`,
    action_url: `/employee/execution`,
    related_entity_type: "OKR_SUBMISSION",
    related_entity_id: params.submissionId,
  });
}

export async function notifySubmissionRejected(params: OkrNotificationParams) {
  if (!params.submitterEmployeeId) return;

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.submitterEmployeeId,
    type: NotificationType.OKR_REJECTED,
    title: "OKR Submission Rejected",
    message: `Your OKR submission was rejected by ${params.approverName}. Reason: ${params.reason}`,
    action_url: `/manager/okr/planning`,
    related_entity_type: "OKR_SUBMISSION",
    related_entity_id: params.submissionId,
  });
}

// ─── Post-Publish Edit: Change Request Notifications ────────────────────────

export interface ChangeRequestNotificationParams {
  companyId: number;
  changeRequestId: number;
  requesterName?: string;
  reviewerName?: string;
  reviewerEmployeeId?: string;
  requesterEmployeeId?: string;
  affectedEmployeeId?: string;
  managerName?: string;
  entityTitle?: string;
  changeSummary?: string;
  reason?: string;
}

export async function notifyChangeRequestSubmitted(params: ChangeRequestNotificationParams) {
  if (!params.reviewerEmployeeId) return;

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.reviewerEmployeeId,
    type: NotificationType.OKR_CHANGE_REQUEST_SUBMITTED,
    title: "Plan Edit Request",
    message: `${params.requesterName} has requested to edit "${params.entityTitle}". Changes: ${params.changeSummary?.substring(0, 100)}`,
    action_url: `/manager/okr/approvals`,
    related_entity_type: "CHANGE_REQUEST",
    related_entity_id: params.changeRequestId,
  });
}

export async function notifyChangeRequestApproved(params: ChangeRequestNotificationParams) {
  if (!params.requesterEmployeeId) return;

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.requesterEmployeeId,
    type: NotificationType.OKR_CHANGE_REQUEST_APPROVED,
    title: "Edit Request Approved",
    message: `Your edit request for "${params.entityTitle}" has been approved by ${params.reviewerName}.`,
    action_url: `/employee/execution`,
    related_entity_type: "CHANGE_REQUEST",
    related_entity_id: params.changeRequestId,
  });
}

export async function notifyChangeRequestRejected(params: ChangeRequestNotificationParams) {
  if (!params.requesterEmployeeId) return;

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.requesterEmployeeId,
    type: NotificationType.OKR_CHANGE_REQUEST_REJECTED,
    title: "Edit Request Rejected",
    message: `Your edit request for "${params.entityTitle}" was rejected by ${params.reviewerName}. Reason: ${params.reason}`,
    action_url: `/employee/execution`,
    related_entity_type: "CHANGE_REQUEST",
    related_entity_id: params.changeRequestId,
  });
}

export async function notifyRealignmentRequired(params: ChangeRequestNotificationParams) {
  if (!params.affectedEmployeeId) return;

  await createNotification({
    company_id: params.companyId,
    recipient_id: params.affectedEmployeeId,
    type: NotificationType.OKR_REALIGNMENT_REQUIRED,
    title: "⚠️ Realignment Required",
    message: `${params.managerName} has updated "${params.entityTitle}". Please review and realign your plans. Changes: ${params.changeSummary?.substring(0, 80)}`,
    action_url: `/employee/execution`,
    related_entity_type: "CHANGE_REQUEST",
    related_entity_id: params.changeRequestId,
  });
}
