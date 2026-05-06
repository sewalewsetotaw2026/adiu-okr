import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";
import { OkrEntityType } from "@prisma/client";

// ─── Helper: Resolve direct manager ────────────────────────────────────────────

async function resolveDirectManager(employeeId: string, companyId: number) {
  const employment = await prisma.employment.findFirst({
    where: { employee_id: employeeId, company_id: companyId, is_active: true, manager_id: { not: null } },
    select: { manager_id: true },
  });
  if (!employment?.manager_id) return null;
  const manager = await prisma.employee.findFirst({
    where: { id: employment.manager_id, company_id: companyId },
    select: { full_name: true },
  });
  return { managerId: employment.manager_id, managerName: manager?.full_name || "Manager" };
}

// ─── Helper: Snapshot entity fields ────────────────────────────────────────────

async function snapshotEntity(entityType: string, entityId: number): Promise<{ title: string; values: Record<string, any> } | null> {
  switch (entityType) {
    case "EMPLOYEE_KR": {
      const kr = await prisma.employeeKeyResult.findUnique({ 
        where: { id: entityId }, 
        select: { title: true, target_value: true, weight_percent: true, description: true, metric_definition_id: true, unit_of_measure: true } 
      });
      if (!kr) return null;
      return { title: kr.title, values: { title: kr.title, target_value: kr.target_value, weight_percent: kr.weight_percent, description: kr.description, metric_definition_id: kr.metric_definition_id, unit_of_measure: kr.unit_of_measure } };
    }
    case "EMPLOYEE_MONTH_PLAN": {
      const plan = await prisma.employeeMonthPlan.findUnique({ 
        where: { id: entityId }, 
        select: { title: true, target_value: true, weight_pct: true, description: true, start_value: true } 
      });
      if (!plan) return null;
      return { title: plan.title, values: { title: plan.title, target_value: plan.target_value, weight_pct: plan.weight_pct, description: plan.description, start_value: plan.start_value } };
    }
    case "WEEKLY_PLAN": {
      const plan = await prisma.weeklyPlan.findUnique({ where: { id: entityId }, select: { title: true, target_value: true, weight_pct: true, start_value: true, metric_definition_id: true } });
      if (!plan) return null;
      return { title: plan.title, values: { title: plan.title, target_value: plan.target_value, weight_pct: plan.weight_pct, start_value: plan.start_value } };
    }
    default: return null;
  }
}

// ─── Helper: Build human-readable change summary ──────────────────────────────

function buildChangeSummary(oldVals: Record<string, any>, newVals: Record<string, any>): string {
  const parts: string[] = [];
  for (const key of Object.keys(newVals)) {
    const oldV = oldVals[key];
    const newV = newVals[key];
    if (oldV !== undefined && newV !== undefined && String(oldV) !== String(newV)) {
      parts.push(`${key}: ${oldV} → ${newV}`);
    }
  }
  return parts.length > 0 ? parts.join("; ") : "No visible changes";
}

// ─── Helper: Resolve entity owner ─────────────────────────────────────────────

async function resolveEntityOwner(entityType: string, entityId: number): Promise<string | null> {
  switch (entityType) {
    case "EMPLOYEE_KR": {
      const kr = await prisma.employeeKeyResult.findUnique({
        where: { id: entityId },
        select: { employeeObjective: { select: { user_id: true } } },
      });
      return kr?.employeeObjective.user_id || null;
    }
    case "EMPLOYEE_MONTH_PLAN": {
      const plan = await prisma.employeeMonthPlan.findUnique({ where: { id: entityId }, select: { owner_id: true } });
      return plan?.owner_id || null;
    }
    case "WEEKLY_PLAN": {
      const plan = await prisma.weeklyPlan.findUnique({ where: { id: entityId }, select: { owner_id: true } });
      return plan?.owner_id || null;
    }
    default: return null;
  }
}

// ─── Helper: Resolve cycle_id for entity ──────────────────────────────────────

async function resolveCycleId(entityType: string, entityId: number): Promise<number | null> {
  switch (entityType) {
    case "EMPLOYEE_KR": {
      const kr = await prisma.employeeKeyResult.findUnique({
        where: { id: entityId },
        select: { employeeObjective: { select: { cycle_id: true } } },
      });
      return kr?.employeeObjective.cycle_id || null;
    }
    case "EMPLOYEE_MONTH_PLAN": {
      const plan = await prisma.employeeMonthPlan.findUnique({ where: { id: entityId }, select: { cycle_id: true } });
      return plan?.cycle_id || null;
    }
    case "WEEKLY_PLAN": {
      const plan = await prisma.weeklyPlan.findUnique({
        where: { id: entityId },
        select: { monthPlan: { select: { cycle_id: true } } },
      });
      return plan?.monthPlan.cycle_id || null;
    }
    default: return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE CHANGE REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

export async function createChangeRequest(params: {
  companyId: number;
  entityType: string;
  entityId: number;
  requesterId: string;
  newValues: Record<string, any>;
  parentChangeRequestId?: number;
}) {
  const { companyId, entityType, entityId, requesterId, newValues, parentChangeRequestId } = params;

  // 1. Snapshot current values
  const snapshot = await snapshotEntity(entityType, entityId);
  if (!snapshot) throw new Error(`Entity ${entityType}#${entityId} not found.`);

  const cycleId = await resolveCycleId(entityType, entityId);
  if (!cycleId) throw new Error("Could not resolve cycle for entity.");

  // 2. Determine reviewer (direct manager)
  const directManager = await resolveDirectManager(requesterId, companyId);
  const reviewerId = directManager?.managerId || null;

  // 3. Build diff summary
  const changeSummary = buildChangeSummary(snapshot.values, newValues);

  // 4. Determine cascade depth
  let cascadeDepth = 0;
  if (parentChangeRequestId) {
    const parentCR = await prisma.okrChangeRequest.findUnique({
      where: { id: parentChangeRequestId },
      select: { cascade_depth: true },
    });
    cascadeDepth = (parentCR?.cascade_depth || 0) + 1;
  }

  // 5. Create the change request
  const cr = await prisma.okrChangeRequest.create({
    data: {
      company_id: companyId,
      cycle_id: cycleId,
      entity_type: entityType as OkrEntityType,
      entity_id: entityId,
      entity_title: snapshot.title,
      requester_id: requesterId,
      reviewer_id: reviewerId,
      status: "PENDING",
      old_values_json: snapshot.values,
      new_values_json: newValues,
      change_summary: changeSummary,
      parent_change_request_id: parentChangeRequestId || null,
      cascade_depth: cascadeDepth,
    },
  });

  await logActivity({
    companyId,
    entityType: "CHANGE_REQUEST",
    entityId: cr.id,
    actorId: requesterId,
    action: "change_request_created",
    description: `Change request for ${entityType}#${entityId}: ${changeSummary}`,
  });

  // 6. Send notification to reviewer
  if (reviewerId) {
    try {
      const { notifyChangeRequestSubmitted } = await import("src/services/okrNotificationService");
      const requester = await prisma.employee.findFirst({
        where: { id: requesterId, company_id: companyId },
        select: { full_name: true },
      });
      await notifyChangeRequestSubmitted({
        companyId,
        changeRequestId: cr.id,
        requesterName: requester?.full_name || "Employee",
        reviewerEmployeeId: reviewerId,
        entityTitle: snapshot.title,
        changeSummary,
      });
    } catch (e) {
      console.warn("[ChangeRequest] Failed to send notification:", e);
    }
  }

  return cr;
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVE CHANGE REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

export async function approveChangeRequest(params: {
  changeRequestId: number;
  reviewerId: string;
  companyId: number;
  comment?: string;
}) {
  const { changeRequestId, reviewerId, companyId, comment } = params;

  const cr = await prisma.okrChangeRequest.findUnique({ where: { id: changeRequestId } });
  if (!cr) throw new Error("Change request not found.");
  if (cr.status !== "PENDING") throw new Error(`Change request is already ${cr.status}.`);
  if (cr.reviewer_id && cr.reviewer_id !== reviewerId) {
    throw new Error("Unauthorized: You are not the assigned reviewer.");
  }

  const newValues = cr.new_values_json as Record<string, any>;

  // Apply changes to the entity in a transaction
  await prisma.$transaction(async (tx) => {
    // 1. Update the change request status
    await tx.okrChangeRequest.update({
      where: { id: changeRequestId },
      data: { status: "APPROVED", review_comment: comment || null, reviewed_at: new Date() },
    });

    // 2. Apply new values to the entity
    switch (cr.entity_type) {
      case "EMPLOYEE_KR": {
        const krData: any = { ...newValues };
        if (krData.contributes_to_score !== undefined) {
          krData.contributes_to_objective_score = krData.contributes_to_score;
          delete krData.contributes_to_score;
        }
        if (krData.contributes_to_value !== undefined) {
          krData.contributes_to_objective_value = krData.contributes_to_value;
          delete krData.contributes_to_value;
        }
        delete krData.employee_objective_id;
        delete krData.id;
        delete krData.company_id;
        await tx.employeeKeyResult.update({ where: { id: cr.entity_id }, data: krData });
        break;
      }
      case "EMPLOYEE_MONTH_PLAN": {
        const mpData: any = { ...newValues };
        delete mpData.employee_kr_id;
        delete mpData.id;
        delete mpData.company_id;
        delete mpData.cycle_id;
        await tx.employeeMonthPlan.update({ where: { id: cr.entity_id }, data: mpData });
        break;
      }
      case "WEEKLY_PLAN": {
        const wpData: any = { ...newValues };
        delete wpData.employee_month_plan_id;
        delete wpData.id;
        delete wpData.company_id;
        await tx.weeklyPlan.update({ where: { id: cr.entity_id }, data: wpData });
        break;
      }
    }

    // 3. Audit log
    await tx.okrAuditLog.create({
      data: {
        company_id: companyId,
        entity_type: cr.entity_type,
        entity_id: cr.entity_id,
        action_type: "POST_PUBLISH_EDIT",
        old_value_json: cr.old_values_json as any,
        new_value_json: cr.new_values_json as any,
        changed_by: cr.requester_id,
      },
    });
  });

  await logActivity({
    companyId,
    entityType: "CHANGE_REQUEST",
    entityId: changeRequestId,
    actorId: reviewerId,
    action: "change_request_approved",
    description: `Approved change request for ${cr.entity_type}#${cr.entity_id}.`,
  });

  // 4. Notify the requester
  try {
    const { notifyChangeRequestApproved } = await import("src/services/okrNotificationService");
    const reviewer = await prisma.employee.findFirst({
      where: { id: reviewerId, company_id: companyId },
      select: { full_name: true },
    });
    await notifyChangeRequestApproved({
      companyId,
      changeRequestId,
      reviewerName: reviewer?.full_name || "Manager",
      requesterEmployeeId: cr.requester_id,
      entityTitle: cr.entity_title || "Plan",
    });
  } catch (e) {
    console.warn("[ChangeRequest] Failed to send approval notification:", e);
  }

  // 5. Cascade: create realignment flags for affected subordinates
  await triggerCascadeNotifications(cr.id, companyId);

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REJECT CHANGE REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

export async function rejectChangeRequest(params: {
  changeRequestId: number;
  reviewerId: string;
  companyId: number;
  comment: string;
}) {
  const { changeRequestId, reviewerId, companyId, comment } = params;

  const cr = await prisma.okrChangeRequest.findUnique({ where: { id: changeRequestId } });
  if (!cr) throw new Error("Change request not found.");
  if (cr.status !== "PENDING") throw new Error(`Change request is already ${cr.status}.`);
  if (cr.reviewer_id && cr.reviewer_id !== reviewerId) {
    throw new Error("Unauthorized: You are not the assigned reviewer.");
  }

  await prisma.okrChangeRequest.update({
    where: { id: changeRequestId },
    data: { status: "REJECTED", review_comment: comment, reviewed_at: new Date() },
  });

  await logActivity({
    companyId,
    entityType: "CHANGE_REQUEST",
    entityId: changeRequestId,
    actorId: reviewerId,
    action: "change_request_rejected",
    description: `Rejected change request for ${cr.entity_type}#${cr.entity_id}. Reason: ${comment}`,
  });

  // Notify requester
  try {
    const { notifyChangeRequestRejected } = await import("src/services/okrNotificationService");
    const reviewer = await prisma.employee.findFirst({
      where: { id: reviewerId, company_id: companyId },
      select: { full_name: true },
    });
    await notifyChangeRequestRejected({
      companyId,
      changeRequestId,
      reviewerName: reviewer?.full_name || "Manager",
      requesterEmployeeId: cr.requester_id,
      entityTitle: cr.entity_title || "Plan",
      reason: comment,
    });
  } catch (e) {
    console.warn("[ChangeRequest] Failed to send rejection notification:", e);
  }

  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CASCADE: Find affected subordinates and create realignment flags
// ═══════════════════════════════════════════════════════════════════════════════

async function triggerCascadeNotifications(changeRequestId: number, companyId: number) {
  const cr = await prisma.okrChangeRequest.findUnique({ where: { id: changeRequestId } });
  if (!cr) return;

  const affectedEntities: Array<{ entityType: string; entityId: number; ownerId: string }> = [];

  switch (cr.entity_type) {
    case "EMPLOYEE_KR": {
      // Find subordinate objectives that adopted this KR
      const childObjectives = await prisma.employeeObjective.findMany({
        where: { chosen_parent_employee_kr_id: cr.entity_id },
        select: { id: true, user_id: true },
      });
      for (const obj of childObjectives) {
        affectedEntities.push({ entityType: "EMPLOYEE_OBJECTIVE", entityId: obj.id, ownerId: obj.user_id });
        // Also flag their KRs
        const childKrs = await prisma.employeeKeyResult.findMany({
          where: { employee_objective_id: obj.id },
          select: { id: true },
        });
        for (const kr of childKrs) {
          affectedEntities.push({ entityType: "EMPLOYEE_KR", entityId: kr.id, ownerId: obj.user_id });
        }
      }
      // Also find monthly plans under this KR owned by subordinates
      const monthPlans = await prisma.employeeMonthPlan.findMany({
        where: { employee_kr_id: cr.entity_id, owner_id: { not: cr.requester_id } },
        select: { id: true, owner_id: true },
      });
      for (const mp of monthPlans) {
        affectedEntities.push({ entityType: "EMPLOYEE_MONTH_PLAN", entityId: mp.id, ownerId: mp.owner_id });
      }
      break;
    }
    case "EMPLOYEE_MONTH_PLAN": {
      // Find weekly plans under this monthly plan owned by subordinates
      const weeklyPlans = await prisma.weeklyPlan.findMany({
        where: { employee_month_plan_id: cr.entity_id, owner_id: { not: cr.requester_id } },
        select: { id: true, owner_id: true },
      });
      for (const wp of weeklyPlans) {
        affectedEntities.push({ entityType: "WEEKLY_PLAN", entityId: wp.id, ownerId: wp.owner_id });
      }
      break;
    }
    case "WEEKLY_PLAN": {
      // Find daily plans under this weekly plan owned by subordinates
      const dailyPlans = await prisma.dailyPlan.findMany({
        where: { weekly_plan_id: cr.entity_id, owner_id: { not: cr.requester_id } },
        select: { id: true, owner_id: true },
      });
      for (const dp of dailyPlans) {
        affectedEntities.push({ entityType: "DAILY_PLAN", entityId: dp.id, ownerId: dp.owner_id });
      }
      break;
    }
  }

  if (affectedEntities.length === 0) return;

  // Deduplicate by owner (one flag per unique entity)
  const seen = new Set<string>();
  const unique = affectedEntities.filter((e) => {
    const key = `${e.entityType}:${e.entityId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Create realignment flags
  for (const entity of unique) {
    await prisma.okrRealignmentFlag.create({
      data: {
        company_id: companyId,
        change_request_id: changeRequestId,
        affected_entity_type: entity.entityType as OkrEntityType,
        affected_entity_id: entity.entityId,
        affected_owner_id: entity.ownerId,
        status: "PENDING",
      },
    });

    // Send notification to each affected owner
    try {
      const { notifyRealignmentRequired } = await import("src/services/okrNotificationService");
      const requester = await prisma.employee.findFirst({
        where: { id: cr.requester_id, company_id: companyId },
        select: { full_name: true },
      });
      await notifyRealignmentRequired({
        companyId,
        changeRequestId,
        managerName: requester?.full_name || "Your manager",
        affectedEmployeeId: entity.ownerId,
        entityTitle: cr.entity_title || "Plan",
        changeSummary: cr.change_summary || "",
      });
    } catch (e) {
      console.warn("[ChangeRequest] Failed to send realignment notification:", e);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REALIGNMENT FLAG ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function acknowledgeRealignment(flagId: number, employeeId: string) {
  const flag = await prisma.okrRealignmentFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new Error("Realignment flag not found.");
  if (flag.affected_owner_id !== employeeId) throw new Error("Unauthorized.");
  await prisma.okrRealignmentFlag.update({
    where: { id: flagId },
    data: { status: "ACKNOWLEDGED", acknowledged_at: new Date() },
  });
  return { success: true };
}

export async function completeRealignment(flagId: number, employeeId: string) {
  const flag = await prisma.okrRealignmentFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new Error("Realignment flag not found.");
  if (flag.affected_owner_id !== employeeId) throw new Error("Unauthorized.");
  await prisma.okrRealignmentFlag.update({
    where: { id: flagId },
    data: { status: "REALIGNED", realigned_at: new Date() },
  });
  return { success: true };
}

export async function dismissRealignment(flagId: number, employeeId: string, reason: string) {
  const flag = await prisma.okrRealignmentFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new Error("Realignment flag not found.");
  if (flag.affected_owner_id !== employeeId) throw new Error("Unauthorized.");
  if (!reason?.trim()) throw new Error("A reason is required to dismiss.");
  await prisma.okrRealignmentFlag.update({
    where: { id: flagId },
    data: { status: "DISMISSED", dismissed_at: new Date(), dismiss_reason: reason },
  });
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIST / GET ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function listChangeRequests(params: {
  companyId: number;
  cycleId?: number;
  status?: string;
  requesterId?: string;
  reviewerId?: string;
}) {
  const { companyId, cycleId, status, requesterId, reviewerId } = params;
  const where: any = { company_id: companyId };
  if (cycleId) where.cycle_id = cycleId;
  if (status) where.status = status;
  if (requesterId) where.requester_id = requesterId;
  if (reviewerId) where.reviewer_id = reviewerId;

  const crs = await prisma.okrChangeRequest.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: 100,
  });

  if (crs.length === 0) return [];

  // Fetch employee details to mimic the requester object frontend expects
  const employeeIds = [...new Set(crs.map(c => c.requester_id))];
  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds }, company_id: companyId },
    select: { id: true, full_name: true }
  });
  
  const empMap = new Map(employees.map(e => [e.id, e]));

  return crs.map(cr => ({
    ...cr,
    requester: empMap.get(cr.requester_id) || { full_name: "Team Member" }
  }));
}

export async function getChangeRequestDetail(id: number, companyId: number) {
  const cr = await prisma.okrChangeRequest.findFirst({
    where: { id, company_id: companyId },
    include: {
      realignmentFlags: {
        orderBy: { created_at: "desc" },
      },
    },
  });
  if (!cr) throw new Error("Change request not found.");

  // Enrich with requester/reviewer names
  const [requester, reviewer] = await Promise.all([
    prisma.employee.findFirst({ where: { id: cr.requester_id, company_id: companyId }, select: { full_name: true } }),
    cr.reviewer_id ? prisma.employee.findFirst({ where: { id: cr.reviewer_id, company_id: companyId }, select: { full_name: true } }) : null,
  ]);

  return {
    ...cr,
    requester_name: requester?.full_name || "Unknown",
    reviewer_name: reviewer?.full_name || null,
  };
}

export async function listMyRealignmentFlags(params: {
  companyId: number;
  employeeId: string;
  status?: string;
}) {
  const { companyId, employeeId, status } = params;
  const where: any = { company_id: companyId, affected_owner_id: employeeId };
  if (status) where.status = status;

  return prisma.okrRealignmentFlag.findMany({
    where,
    include: {
      changeRequest: {
        select: {
          id: true,
          entity_type: true,
          entity_id: true,
          entity_title: true,
          old_values_json: true,
          new_values_json: true,
          change_summary: true,
          requester_id: true,
          created_at: true,
        },
      },
    },
    orderBy: { created_at: "desc" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER VIEW: Subordinate alignment status
// ═══════════════════════════════════════════════════════════════════════════════

export async function getSubordinateAlignmentStatus(params: {
  companyId: number;
  managerId: string;
  cycleId?: number;
}) {
  const { companyId, managerId, cycleId } = params;

  // Find all change requests made by this manager
  const crWhere: any = { company_id: companyId, requester_id: managerId, status: "APPROVED" };
  if (cycleId) crWhere.cycle_id = cycleId;

  const changeRequests = await prisma.okrChangeRequest.findMany({
    where: crWhere,
    include: {
      realignmentFlags: {
        include: {
          changeRequest: { select: { entity_title: true, change_summary: true } },
        },
      },
    },
    orderBy: { created_at: "desc" },
  });

  // Build a summary per subordinate
  const subordinateMap: Record<string, { total: number; pending: number; acknowledged: number; realigned: number; dismissed: number }> = {};

  for (const cr of changeRequests) {
    for (const flag of cr.realignmentFlags) {
      if (!subordinateMap[flag.affected_owner_id]) {
        subordinateMap[flag.affected_owner_id] = { total: 0, pending: 0, acknowledged: 0, realigned: 0, dismissed: 0 };
      }
      const s = subordinateMap[flag.affected_owner_id];
      s.total++;
      if (flag.status === "PENDING") s.pending++;
      else if (flag.status === "ACKNOWLEDGED") s.acknowledged++;
      else if (flag.status === "REALIGNED") s.realigned++;
      else if (flag.status === "DISMISSED") s.dismissed++;
    }
  }

  // Enrich with employee names
  const employeeIds = Object.keys(subordinateMap);
  const employees = employeeIds.length > 0
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds }, company_id: companyId },
        select: { id: true, full_name: true },
      })
    : [];
  const nameMap = Object.fromEntries(employees.map((e) => [e.id, e.full_name]));

  return employeeIds.map((id) => ({
    employee_id: id,
    employee_name: nameMap[id] || "Unknown",
    is_aligned: subordinateMap[id].pending === 0 && subordinateMap[id].acknowledged === 0,
    ...subordinateMap[id],
  }));
}

// ─── Check if entity has pending realignment flags (for UI banner) ────────────

export async function getEntityRealignmentFlags(params: {
  companyId: number;
  entityType: string;
  entityId: number;
}) {
  return prisma.okrRealignmentFlag.findMany({
    where: {
      company_id: params.companyId,
      affected_entity_type: params.entityType as OkrEntityType,
      affected_entity_id: params.entityId,
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
    },
    include: {
      changeRequest: {
        select: {
          id: true,
          entity_title: true,
          old_values_json: true,
          new_values_json: true,
          change_summary: true,
          requester_id: true,
        },
      },
    },
  });
}
