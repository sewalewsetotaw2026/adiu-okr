import { prisma } from "src/app";
import { validateStatusTransition } from "./okrStatusTransitionService";
import { validateWeightsBeforePublish } from "./okrWeightValidationService";
import { captureConfigSnapshot } from "./okrAuditHookService";
import * as configResolver from "./okrConfigResolverService";
import { validateSafePublish } from "./okrValidationService";
import { notifySubmissionCreated } from "./okrNotificationService";

/**
 * High-level orchestration use case for publishing a Company Objective.
 * It strictly enforces validations before interacting with the database.
 */
export async function publishCompanyObjectiveSet(companyId: number, cycleId: number, objectiveId: number, actorId: string) {
  const objective = await prisma.companyObjective.findUnique({
    where: { id: objectiveId },
    include: { keyResults: true }
  });

  if (!objective) {
    throw new Error("Company Objective not found");
  }

  if (objective.status_code === "published") {
    return { success: true, message: "Objective is already published." };
  }

  // 1. Status Engine Validation
  await validateStatusTransition({
    companyId,
    entityType: "COMPANY_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: "published"
  });

  await validateSafePublish(companyId, objectiveId, "COMPANY", cycleId);

  // 2. Business Logic Validators

  await validateWeightsBeforePublish(companyId, cycleId, objectiveId, "COMPANY");

  // 3. Capture point-in-time configuration snapshot for reproducibility
  const activeConfigs = { 
    planning_cadence: await configResolver.getPlanningCadence(companyId, cycleId),
    strict_sequence: await configResolver.isStrictSequenceEnabled(companyId, cycleId),
    parent_publish_required: await configResolver.isParentPublishRequired(companyId, cycleId),
    weight_validation: await configResolver.isWeightValidationEnabled(companyId, cycleId),
    monthly_plan_required: await configResolver.isMonthlyPlanRequired(companyId, cycleId),
    snapshot_timestamp: new Date().toISOString()
  };
  const snapshotId = await captureConfigSnapshot(companyId, "COMPANY_OBJECTIVE", objectiveId, actorId, activeConfigs);

  // 4. Execution & Write Hooks
  await prisma.$transaction(async (tx) => {
    // Update parent
    await tx.companyObjective.update({
      where: { id: objectiveId },
      data: { status_code: "published", published_by: actorId, published_at: new Date() }
    });

    // Cascade update to child KRs
    await tx.companyKeyResult.updateMany({
      where: { objective_id: objectiveId },
      data: { status_code: "published", published_by: actorId, published_at: new Date() }
    });
    
    // Write Audit Hook
    await tx.okrAuditLog.create({
      data: {
        company_id: companyId,
        entity_type: "COMPANY_OBJECTIVE" as any,
        entity_id: objectiveId,
        action_type: "STATUS_TRANSITION",
        old_value_json: { status: objective.status_code },
        new_value_json: { status: "published", snapshot_id: snapshotId },
        changed_by: actorId
      }
    });

    // Write Publish Approval Hook
    await tx.okrApprovalLog.create({
      data: {
        company_id: companyId,
        entity_type: "COMPANY_OBJECTIVE" as any,
        entity_id: objectiveId,
        approver_id: actorId,
        action: "PUBLISHED" as any,
        comments: "Automated transition output from orchestrator."
      }
    });
  });

  return { success: true, snapshotId };
}

/**
 * Use case: Submit a Company Plan for approval
 */
export async function submitCompanyObjective(companyId: number, cycleId: number, objectiveId: number, actorId: string) {
  const objective = await prisma.companyObjective.findUnique({
    where: { id: objectiveId },
    include: { keyResults: true }
  });

  if (!objective) throw new Error("Company Objective not found");

  if (objective.status_code === "pending_approval" || objective.status_code === "published") {
    return { success: true, message: `Objective is already ${objective.status_code}.` };
  }

  await validateStatusTransition({
    companyId,
    entityType: "COMPANY_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: "pending_approval"
  });

  await validateSafePublish(companyId, objectiveId, "COMPANY", cycleId);
  await validateWeightsBeforePublish(companyId, cycleId, objectiveId, "COMPANY");


  await prisma.companyObjective.update({
    where: { id: objectiveId },
    data: { status_code: "pending_approval" }
  });

  await prisma.okrAuditLog.create({
    data: {
      company_id: companyId,
      entity_type: "COMPANY_OBJECTIVE" as any,
      entity_id: objectiveId,
      action_type: "STATUS_TRANSITION",
      old_value_json: { status: objective.status_code },
      new_value_json: { status: "pending_approval" },
      changed_by: actorId
    }
  });

  return { success: true };
}

/**
 * Use case: Approve a Company Plan
 */
export async function approveCompanyObjective(companyId: number, cycleId: number, objectiveId: number, actorId: string, userRole: string) {
  const objective = await prisma.companyObjective.findUnique({
    where: { id: objectiveId },
    include: { keyResults: true }
  });

  if (!objective) throw new Error("Company Objective not found");

  if (objective.status_code === "published" || objective.status_code === "approved") {
    return { success: true, message: `Objective is already ${objective.status_code}.` };
  }

  // Same logic as before for publishing automatically when approved
  const targetStatus = "approved"; // or published, let's keep approved here then the orchestrator publishes

  await validateStatusTransition({
    companyId,
    entityType: "COMPANY_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: targetStatus,
    userRole: userRole 
  });

  await validateSafePublish(companyId, objectiveId, "COMPANY", cycleId);

  await prisma.$transaction(async (tx) => {

    await tx.companyObjective.update({
      where: { id: objectiveId },
      data: { status_code: targetStatus, approved_by: actorId }
    });

    await tx.companyKeyResult.updateMany({
      where: { objective_id: objectiveId },
      data: { status_code: targetStatus, approved_by: actorId }
    });
    
    await tx.okrAuditLog.create({
      data: {
        company_id: companyId,
        entity_type: "COMPANY_OBJECTIVE" as any,
        entity_id: objectiveId,
        action_type: "STATUS_TRANSITION",
        old_value_json: { status: objective.status_code },
        new_value_json: { status: targetStatus },
        changed_by: actorId
      }
    });

    await tx.okrApprovalLog.create({
      data: {
        company_id: companyId,
        entity_type: "COMPANY_OBJECTIVE" as any,
        entity_id: objectiveId,
        approver_id: actorId,
        action: "APPROVED" as any,
        comments: "Board/Exec approval."
      }
    });
  });

  return { success: true, newStatus: targetStatus };
}

/**
 * Use case: Reject a Company Plan
 */
export async function rejectCompanyObjective(companyId: number, cycleId: number, objectiveId: number, actorId: string, comments: string) {
  const objective = await prisma.companyObjective.findUnique({
    where: { id: objectiveId },
    include: { keyResults: true }
  });

  if (!objective) throw new Error("Company Objective not found");

  await validateStatusTransition({
    companyId,
    entityType: "COMPANY_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: "draft"
  });

  await prisma.$transaction(async (tx) => {
    await tx.companyObjective.update({
      where: { id: objectiveId },
      data: { status_code: "draft" }
    });

    await tx.companyKeyResult.updateMany({
      where: { objective_id: objectiveId },
      data: { status_code: "draft" }
    });
    
    await tx.okrAuditLog.create({
      data: {
        company_id: companyId,
        entity_type: "COMPANY_OBJECTIVE" as any,
        entity_id: objectiveId,
        action_type: "STATUS_TRANSITION",
        old_value_json: { status: objective.status_code },
        new_value_json: { status: "draft" },
        changed_by: actorId
      }
    });

    await tx.okrApprovalLog.create({
      data: {
        company_id: companyId,
        entity_type: "COMPANY_OBJECTIVE" as any,
        entity_id: objectiveId,
        approver_id: actorId,
        action: "REJECTED" as any,
        comments: comments
      }
    });
  });

  return { success: true };
}

/**
 * Use case: Publish a Department Plan
 */
export async function publishDepartmentPlan(companyId: number, cycleId: number, deptObjectiveId: number, actorId: string) {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: deptObjectiveId },
    include: { keyResults: true }
  });

  if (!objective) {
    throw new Error("Department Objective not found");
  }

  if (objective.status_code === "published") {
    return { success: true, message: "Objective is already published." };
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: "published"
  });

  // department_id needs to be resolved from user if required by validator
  await validateSafePublish(companyId, deptObjectiveId, "DEPARTMENT", cycleId, undefined);

  await validateWeightsBeforePublish(companyId, cycleId, deptObjectiveId, "DEPARTMENT");

  const activeConfigs = {
    planning_cadence: await configResolver.getPlanningCadence(companyId, cycleId, undefined),
    strict_sequence: await configResolver.isStrictSequenceEnabled(companyId, cycleId, undefined),
    parent_publish_required: await configResolver.isParentPublishRequired(companyId, cycleId, undefined),
    weight_validation: await configResolver.isWeightValidationEnabled(companyId, cycleId),
    monthly_plan_required: await configResolver.isMonthlyPlanRequired(companyId, cycleId, undefined),
    snapshot_timestamp: new Date().toISOString()
  };

  const snapshotId = await captureConfigSnapshot(companyId, "EMPLOYEE_OBJECTIVE", deptObjectiveId, actorId, activeConfigs);

  await prisma.$transaction(async (tx) => {
    await tx.employeeObjective.update({
      where: { id: deptObjectiveId },
      data: { status_code: "published", published_by: actorId, published_at: new Date() }
    });

    await tx.employeeKeyResult.updateMany({
      where: { employee_objective_id: deptObjectiveId },
      data: { status_code: "published", published_by: actorId, published_at: new Date() }
    });
    
    await tx.okrAuditLog.create({
      data: {
        company_id: companyId,
        entity_type: "EMPLOYEE_OBJECTIVE" as any,
        entity_id: deptObjectiveId,
        action_type: "STATUS_TRANSITION",
        old_value_json: { status: objective.status_code },
        new_value_json: { status: "published", snapshot_id: snapshotId },
        changed_by: actorId
      }
    });
  });

  return { success: true, snapshotId };
}

/**
 * Use case: Submit a Department Plan for approval
 */
export async function submitDepartmentPlan(companyId: number, cycleId: number, deptObjectiveId: number, actorId: string) {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: deptObjectiveId },
    include: { keyResults: true }
  });

  if (!objective) {
    throw new Error("Department Objective not found");
  }

  if (objective.status_code === "pending_approval" || objective.status_code === "published") {
    return { success: true, message: `Objective is already ${objective.status_code}.` };
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: "pending_approval"
  });

  await validateSafePublish(companyId, deptObjectiveId, "DEPARTMENT", cycleId, undefined);

  await validateWeightsBeforePublish(companyId, cycleId, deptObjectiveId, "DEPARTMENT");

  await prisma.employeeObjective.update({
    where: { id: deptObjectiveId },
    data: { 
      status_code: "pending_approval"
    }
  });

  await prisma.okrAuditLog.create({
    data: {
      company_id: companyId,
      entity_type: "EMPLOYEE_OBJECTIVE" as any,
      entity_id: deptObjectiveId,
      action_type: "STATUS_TRANSITION",
      old_value_json: { status: objective.status_code },
      new_value_json: { status: "pending_approval" },
      changed_by: actorId
    }
  });

  // Create notification for Admin/HR approvers
  const adminRoles = await prisma.appRole.findMany({
    where: {
      company_id: companyId,
      OR: [
        { name: { in: ["Admin", "SuperAdmin", "Super Admin"] } },
        { name: { contains: "admin", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  const adminRoleIds = adminRoles.map(r => r.id);

  const adminUsers = adminRoleIds.length > 0
    ? await prisma.appUser.findMany({
        where: {
          company_id: companyId,
          role_id: { in: adminRoleIds },
          employee_id: { not: null },
        },
      })
    : [];

  const submitter = await prisma.employee.findFirst({
    where: { id: actorId, company_id: companyId },
    select: { full_name: true }
  });

  for (const admin of adminUsers) {
    if (admin.employee_id) {
      await notifySubmissionCreated({
        companyId,
        submissionId: deptObjectiveId,
        entityType: "DEPARTMENT_OBJECTIVE",
        entityId: deptObjectiveId,
        submitterName: submitter?.full_name || "Unknown",
        reviewerUserId: admin.employee_id,
      });
    }
  }

  return { success: true };
}

/**
 * Use case: Approve and Publish a Department Plan
 */
export async function approveDepartmentPlan(companyId: number, cycleId: number, deptObjectiveId: number, actorId: string, userRole: string, comments?: string, targetStatus: string = "published") {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: deptObjectiveId },
    include: { keyResults: true }
  });

  if (!objective) {
    throw new Error("Department Objective not found");
  }

  if (objective.status_code === "published") {
    return { success: true, message: "Objective is already published." };
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: targetStatus,
    userRole: userRole 
  });

  await validateSafePublish(companyId, deptObjectiveId, "DEPARTMENT", cycleId, undefined);

  const activeConfigs = {
    planning_cadence: await configResolver.getPlanningCadence(companyId, cycleId, undefined),
    strict_sequence: await configResolver.isStrictSequenceEnabled(companyId, cycleId, undefined),
    parent_publish_required: await configResolver.isParentPublishRequired(companyId, cycleId, undefined),
    weight_validation: await configResolver.isWeightValidationEnabled(companyId, cycleId),
    monthly_plan_required: await configResolver.isMonthlyPlanRequired(companyId, cycleId, undefined),
    snapshot_timestamp: new Date().toISOString()
  };

  const snapshotId = await captureConfigSnapshot(companyId, "EMPLOYEE_OBJECTIVE", deptObjectiveId, actorId, activeConfigs);

  await prisma.$transaction(async (tx) => {
    await tx.employeeObjective.update({
      where: { id: deptObjectiveId },
      data: { 
        status_code: targetStatus, 
        published_by: targetStatus === "published" ? actorId : undefined, 
        published_at: targetStatus === "published" ? new Date() : undefined
      }
    });

    await tx.employeeKeyResult.updateMany({
      where: { employee_objective_id: deptObjectiveId },
      data: { 
        status_code: targetStatus, 
        published_by: targetStatus === "published" ? actorId : undefined, 
        published_at: targetStatus === "published" ? new Date() : undefined
      }
    });
    
    await tx.okrAuditLog.create({
      data: {
        company_id: companyId,
        entity_type: "EMPLOYEE_OBJECTIVE" as any,
        entity_id: deptObjectiveId,
        action_type: "STATUS_TRANSITION",
        old_value_json: { status: objective.status_code },
        new_value_json: { status: "published", snapshot_id: snapshotId },
        changed_by: actorId
      }
    });

    await tx.okrApprovalLog.create({
      data: {
        company_id: companyId,
        entity_type: "EMPLOYEE_OBJECTIVE" as any,
        entity_id: deptObjectiveId,
        approver_id: actorId,
        action: "APPROVED" as any,
        comments: comments || "CEO/Admin approval."
      }
    });
  });

  return { success: true, snapshotId };
}

/**
 * Use case: Submit an Employee Plan for approval
 */
export async function submitEmployeePlan(companyId: number, cycleId: number, employeeObjectiveId: number, actorId: string) {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: employeeObjectiveId },
    include: { keyResults: true }
  });

  if (!objective) {
    throw new Error("Employee Objective not found");
  }

  if (objective.status_code === "pending_approval" || objective.status_code === "published") {
    return { success: true, message: `Objective is already ${objective.status_code}.` };
  }

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: "pending_approval"
  });

  await validateSafePublish(companyId, employeeObjectiveId, "EMPLOYEE", cycleId);
  await validateWeightsBeforePublish(companyId, cycleId, employeeObjectiveId, "EMPLOYEE");


  await prisma.employeeObjective.update({
    where: { id: employeeObjectiveId },
    data: { status_code: "pending_approval" }
  });

  await prisma.okrAuditLog.create({
    data: {
      company_id: companyId,
      entity_type: "EMPLOYEE_OBJECTIVE" as any,
      entity_id: employeeObjectiveId,
      action_type: "STATUS_TRANSITION",
      old_value_json: { status: objective.status_code },
      new_value_json: { status: "pending_approval" },
      changed_by: actorId
    }
  });

  return { success: true };
}

/**
 * Use case: Approve an Employee Plan
 */
export async function approveEmployeePlan(companyId: number, cycleId: number, employeeObjectiveId: number, actorId: string, userRole: string) {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: employeeObjectiveId },
    include: { keyResults: true }
  });

  if (!objective) throw new Error("Employee Objective not found");

  if (objective.status_code === "published" || objective.status_code === "approved") {
    return { success: true, message: `Objective is already ${objective.status_code}.` };
  }

  const autoPublish = await configResolver.isAutoPublishOnApprovalEnabled(companyId, cycleId);
  const targetStatus = autoPublish ? "published" : "approved";

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: targetStatus,
    userRole: userRole 
  });

  await validateSafePublish(companyId, employeeObjectiveId, "EMPLOYEE", cycleId);

  // --- Manager Hierarchy Enforcement (Item 6) ---
  const isSuperUser = ["ADMIN", "CEO", "SUPER_ADMIN"].includes((userRole || "").toUpperCase());
  if (!isSuperUser) {
    const ownerEmployment = await prisma.employment.findFirst({
      where: { employee_id: objective.user_id, company_id: companyId, is_active: true }
    });

    if (!ownerEmployment) {
      throw new Error(`Employment record not found for user ${objective.user_id}`);
    }

    if (ownerEmployment.manager_id !== actorId) {
      throw new Error("Approval denied. Only the immediate supervisor or an administrator can approve this plan.");
    }
  }
  // ----------------------------------------------

  await prisma.$transaction(async (tx) => {

    await tx.employeeObjective.update({
      where: { id: employeeObjectiveId },
      data: { 
        status_code: targetStatus, 
        approved_by: actorId, 
        published_by: autoPublish ? actorId : undefined,
        published_at: autoPublish ? new Date() : undefined
      }
    });

    await tx.employeeKeyResult.updateMany({
      where: { employee_objective_id: employeeObjectiveId },
      data: { 
        status_code: targetStatus, 
        approved_by: actorId, 
        published_by: autoPublish ? actorId : undefined,
        published_at: autoPublish ? new Date() : undefined
      }
    });
    
    await tx.okrAuditLog.create({
      data: {
        company_id: companyId,
        entity_type: "EMPLOYEE_OBJECTIVE" as any,
        entity_id: employeeObjectiveId,
        action_type: "STATUS_TRANSITION",
        old_value_json: { status: objective.status_code },
        new_value_json: { status: targetStatus },
        changed_by: actorId
      }
    });

    await tx.okrApprovalLog.create({
      data: {
        company_id: companyId,
        entity_type: "EMPLOYEE_OBJECTIVE" as any,
        entity_id: employeeObjectiveId,
        approver_id: actorId,
        action: "APPROVED" as any,
        comments: "Manager approval."
      }
    });
  });

  return { success: true, newStatus: targetStatus };
}

/**
 * Use case: Reject an Employee Plan
 */
export async function rejectEmployeePlan(companyId: number, cycleId: number, employeeObjectiveId: number, actorId: string, comments: string) {
  const objective = await prisma.employeeObjective.findUnique({
    where: { id: employeeObjectiveId },
    include: { keyResults: true }
  });

  if (!objective) throw new Error("Employee Objective not found");

  await validateStatusTransition({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    fromStatus: objective.status_code,
    toStatus: "draft"
  });

  await prisma.$transaction(async (tx) => {
    await tx.employeeObjective.update({
      where: { id: employeeObjectiveId },
      data: { status_code: "draft" }
    });

    await tx.employeeKeyResult.updateMany({
      where: { employee_objective_id: employeeObjectiveId },
      data: { status_code: "draft" }
    });
    
    // Cascade to plans — reset all monthly/weekly plans linked to KRs of this objective.
    await tx.employeeMonthPlan.updateMany({
      where: {
        employeeKr: { employee_objective_id: employeeObjectiveId },
      },
      data: { plan_status: "DRAFT" },
    });
    await tx.weeklyPlan.updateMany({
      where: {
        monthPlan: {
          employeeKr: { employee_objective_id: employeeObjectiveId },
        },
      },
      data: { plan_status: "DRAFT" },
    });
    
    await tx.okrAuditLog.create({
      data: {
        company_id: companyId,
        entity_type: "EMPLOYEE_OBJECTIVE" as any,
        entity_id: employeeObjectiveId,
        action_type: "STATUS_TRANSITION",
        old_value_json: { status: objective.status_code },
        new_value_json: { status: "draft" },
        changed_by: actorId
      }
    });

    await tx.okrApprovalLog.create({
      data: {
        company_id: companyId,
        entity_type: "EMPLOYEE_OBJECTIVE" as any,
        entity_id: employeeObjectiveId,
        approver_id: actorId,
        action: "REJECTED" as any,
        comments: comments
      }
    });
  });

  return { success: true };
}
