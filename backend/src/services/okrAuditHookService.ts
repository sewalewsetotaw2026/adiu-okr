import { prisma } from "src/app";
import { EntityTypeKeys } from "./okrStatusTransitionService";

export type ApprovalActionKeys = "SUBMITTED" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED" | "PUBLISHED";

/**
 * Audit Hook to track status changes over time.
 */
export async function logStatusTransitionAudit(
  companyId: number,
  entityType: EntityTypeKeys,
  entityId: number,
  oldStatus: string,
  newStatus: string,
  actorId: string,
  snapshotReferenceId?: number
) {
  await prisma.okrAuditLog.create({
    data: {
      company_id: companyId,
      entity_type: entityType as any,
      entity_id: entityId,
      action_type: "STATUS_TRANSITION",
      old_value_json: { status: oldStatus },
      new_value_json: { status: newStatus, snapshot_id: snapshotReferenceId || null },
      changed_by: actorId
    }
  });
}

/**
 * Goverance Hook to track who explicitly approved/rejected an action.
 */
export async function logApprovalAction(
  companyId: number,
  entityType: EntityTypeKeys,
  entityId: number,
  approverId: string,
  action: ApprovalActionKeys,
  comments?: string
) {
  await prisma.okrApprovalLog.create({
    data: {
      company_id: companyId,
      entity_type: entityType as any,
      entity_id: entityId,
      approver_id: approverId,
      action: action as any,
      comments: comments || null
    }
  });
}

/**
 * Snapshots the dynamic configuration JSON at a particular moment (e.g., Publish Time).
 * Output provides reproducibility foundation.
 */
export async function captureConfigSnapshot(
  companyId: number,
  entityType: EntityTypeKeys,
  entityId: number,
  actorId: string,
  resolvedConfigJson: any
) {
  const snapshot = await prisma.okrConfigSnapshot.create({
    data: {
      company_id: companyId,
      entity_type: entityType as any,
      entity_id: entityId,
      resolved_config_json: resolvedConfigJson,
      captured_by: actorId
    }
  });
  return snapshot.id;
}
