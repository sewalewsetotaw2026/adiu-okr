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
