import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";

// ─── Assign Contributor ───────────────────────────────────────────────────────

interface AssignContributorInput {
  companyId: number;
  companyKrId?: number;
  employeeKrId?: number;
  userId: string;
  roleType:
  | "EMPLOYEE"
  | "TEAM_LEADER"
  | "MANAGER"
  | "DIRECTOR"
  | "DEPARTMENT_HEAD";
  isRequiredForCompletion?: boolean;
  requiredTarget?: number;
  weightPercent?: number;
  assignedBy: string;
}

export async function assignContributor(input: AssignContributorInput) {
  if (!input.employeeKrId && !input.companyKrId) {
    throw new Error("company_kr_id or employee_kr_id is required.");
  }

  let parentTitle = "";
  let cycleId = 0;
  let context: any = {};

  if (input.companyKrId) {
    const compKr = await prisma.companyKeyResult.findFirst({
      where: { id: input.companyKrId, company_id: input.companyId },
      include: { objective: { select: { cycle_id: true } } }
    });
    if (!compKr) throw new Error("Company key result not found.");
    parentTitle = compKr.title;
    cycleId = compKr.objective.cycle_id;
    context = { cycle_id: cycleId, company_kr_title: compKr.title };
  } else if (input.employeeKrId) {
    const empKr = await prisma.employeeKeyResult.findFirst({
      where: { id: input.employeeKrId, company_id: input.companyId },
      include: {
        employeeObjective: {
          select: { id: true, cycle_id: true, title: true },
        },
      },
    });
    if (!empKr) throw new Error("Employee key result not found.");
    if (!["draft", "approved", "published"].includes(empKr.status_code)) {
      throw new Error("Employee key results must be in draft, approved, or published status to assign contributors.");
    }
    parentTitle = empKr.title;
    cycleId = empKr.employeeObjective.cycle_id;
    context = {
      cycle_id: cycleId,
      employee_kr_title: empKr.title,
      employee_objective_id: empKr.employeeObjective.id,
    };
  }

  const numericId = parseInt(input.userId);
  const contributorUser = await prisma.appUser.findFirst({
    where: {
      company_id: input.companyId,
      is_active: true,
      OR: [
        { id: (!isNaN(numericId) && String(numericId) === String(input.userId)) ? numericId : undefined },
        { employee_id: input.userId }
      ].filter(cond => cond.id !== undefined || cond.employee_id !== undefined)
    },
    select: { id: true, employee_id: true },
  });

  if (!contributorUser || !contributorUser.employee_id) {
    throw new Error(
      "Selected contributor user is not active, does not have an associated employee profile, or does not exist in this company.",
    );
  }

  // Use the employee_id from the found user record for employment validation
  const employeeId = contributorUser.employee_id;
  if (!employeeId) {
    throw new Error("This user account is not linked to an employee record.");
  }

  const contributorEmployment = await prisma.employment.findFirst({
    where: {
      company_id: input.companyId,
      employee_id: employeeId,
      is_active: true,
    },
    select: { id: true },
  });

  if (!contributorEmployment) {
    throw new Error(
      "Selected contributor must have an active employment record in this company.",
    );
  }

  // 2. Check for duplicate assignment
  const existing = await prisma.krContributor.findFirst({
    where: {
      company_id: input.companyId,
      user_id: employeeId,
      company_kr_id: input.companyKrId,
      employee_kr_id: input.employeeKrId,
    },
  });
  if (existing)
    throw new Error("User is already a contributor on this KR.");

  // 3. Create the contributor
  const contributor = await prisma.krContributor.create({
    data: {
      company_id: input.companyId,
      company_kr_id: input.companyKrId,
      employee_kr_id: input.employeeKrId,
      user_id: employeeId,
      role_type: input.roleType,
      is_required_for_completion: input.isRequiredForCompletion ?? true,
      required_target: input.requiredTarget,
      weight_percent: input.weightPercent,
      status_code: "active",
      assigned_by: input.assignedBy,
    },
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "KR_CONTRIBUTOR",
    entityId: contributor.id,
    actorId: input.assignedBy,
    action: "contributor_assigned",
    description: `User ${input.userId} assigned as contributor (${input.roleType}) to KR "${parentTitle}"`,
    metadata: {
      employee_kr_id: input.employeeKrId,
      user_id: input.userId,
    },
  });

  // 4. Do not auto-create employee objective.
  // Employee should explicitly adopt the assigned KR using the employee adoption endpoint.
  const existingObjective = await prisma.employeeObjective.findUnique({
    where: { kr_contributor_id: contributor.id },
    select: { id: true, status_code: true },
  });

  return {
    contributor,
    employeeObjective: existingObjective,
    requires_adoption: !existingObjective,
    assignment_context: context,
  };
}

// ─── Remove Contributor ───────────────────────────────────────────────────────

export async function removeContributor(
  contributorId: number,
  companyId: number,
  actorId: string,
) {
  const contributor = await prisma.krContributor.findFirst({
    where: { id: contributorId, company_id: companyId },
    include: {
      companyKr: {
        select: { status_code: true },
      },
      employeeKr: {
        select: { status_code: true },
      },
      employeeObjectives: { select: { id: true, status_code: true } },
    },
  });
  if (!contributor) throw new Error("Contributor not found.");

  if (contributor.companyKr) {
    if (
      contributor.companyKr.status_code !== "draft" &&
      contributor.companyKr.status_code !== "published"
    ) {
      throw new Error(
        "Contributors can only be removed while the company KR is in draft or published status.",
      );
    }
  } else if (contributor.employeeKr) {
    if (!["draft", "approved", "published"].includes(contributor.employeeKr.status_code)) {
      throw new Error("Contributors can only be removed while the employee KR is in draft, approved, or published status.");
    }
  }

  // Check if the employee objective has progressed beyond draft
  const empObj = contributor.employeeObjectives;
  if (empObj && empObj.status_code !== "draft") {
    throw new Error(
      "Cannot remove contributor — employee objective has progressed beyond draft status.",
    );
  }

  // Delete employee objectives (cascade) and then contributor
  await prisma.employeeObjective.deleteMany({
    where: { kr_contributor_id: contributorId },
  });

  await prisma.krContributor.delete({ where: { id: contributorId } });

  await logActivity({
    companyId,
    entityType: "KR_CONTRIBUTOR",
    entityId: contributorId,
    actorId,
    action: "contributor_removed",
    description: `Contributor ${contributor.user_id} removed from KR #${contributor.company_kr_id || contributor.employee_kr_id}`,
    metadata: { user_id: contributor.user_id, kr_id: contributor.company_kr_id || contributor.employee_kr_id },
  });

  return { removed: true };
}

// ─── Update Contributor Flag ──────────────────────────────────────────────────

export async function updateContributorFlag(
  contributorId: number,
  companyId: number,
  isRequired: boolean,
  actorId: string,
) {
  const contributor = await prisma.krContributor.findFirst({
    where: { id: contributorId, company_id: companyId },
    include: {
      companyKr: {
        select: { status_code: true },
      },
      employeeKr: {
        select: { status_code: true },
      },
    },
  });
  if (!contributor) throw new Error("Contributor not found.");

  if (contributor.companyKr) {
    if (
      contributor.companyKr.status_code !== "draft" &&
      contributor.companyKr.status_code !== "published"
    ) {
      throw new Error(
        "Contributor flags can only be updated while the company KR is in draft or published status.",
      );
    }
  } else if (contributor.employeeKr) {
    if (!["draft", "approved", "published"].includes(contributor.employeeKr.status_code)) {
      throw new Error("Contributor flags can only be updated while the employee KR is in draft, approved, or published status.");
    }
  }

  const updated = await prisma.krContributor.update({
    where: { id: contributorId },
    data: { is_required_for_completion: isRequired },
  });

  await logActivity({
    companyId,
    entityType: "KR_CONTRIBUTOR",
    entityId: contributorId,
    actorId,
    action: "contributor_flag_updated",
    description: `Contributor (User #${contributor.user_id}) required flag set to ${isRequired}`,
    metadata: { is_required_for_completion: isRequired },
  });

  return updated;
}

// ─── List Contributors ────────────────────────────────────────────────────────

export async function listCompanyKrContributors(
  companyKrId: number,
  companyId: number,
) {
  const contributors = await prisma.krContributor.findMany({
    where: { company_kr_id: companyKrId, company_id: companyId },
    orderBy: { assigned_at: "asc" },
    include: {
      employeeObjectives: {
        select: {
          id: true,
          title: true,
          status_code: true,
          final_score: true,
          _count: { select: { keyResults: true } },
        },
      },
    },
  });

  return Promise.all(
    contributors.map(async (c) => {
      const emp = await prisma.employee.findFirst({
        where: { id: c.user_id, company_id: companyId },
        select: { full_name: true },
      });
      return {
        ...c,
        full_name: emp?.full_name || null,
        name: emp?.full_name || null,
      };
    }),
  );
}

export async function listEmployeeKrContributors(
  employeeKrId: number,
  companyId: number,
) {
  const contributors = await prisma.krContributor.findMany({
    where: { employee_kr_id: employeeKrId, company_id: companyId },
    orderBy: { assigned_at: "asc" },
    include: {
      employeeObjectives: {
        select: {
          id: true,
          title: true,
          status_code: true,
          final_score: true,
          _count: { select: { keyResults: true } },
        },
      },
    },
  });

  return Promise.all(
    contributors.map(async (c) => {
      const emp = await prisma.employee.findFirst({
        where: { id: c.user_id },
        select: { full_name: true },
      });
      return {
        ...c,
        full_name: emp?.full_name || null,
        name: emp?.full_name || null,
      };
    }),
  );
}

export async function listContributors(
  companyKrId: number,
  companyId: number,
) {
  return listCompanyKrContributors(companyKrId, companyId);
}

export async function getDepartmentContributorSummary(
  departmentId: number,
  cycleId: number,
  companyId: number,
) {
  const contributors = await prisma.krContributor.findMany({
    where: {
      company_id: companyId,
      OR: [
        { companyKr: { objective: { cycle_id: cycleId } } },
        { employeeKr: { employeeObjective: { cycle_id: cycleId } } }
      ],
      user: {
        employee: {
          employments: { some: { department_id: departmentId, is_active: true } }
        }
      }
    },
    include: {
      user: { select: { employee: { select: { full_name: true } } } },
      employeeObjectives: { select: { status_code: true, final_score: true } }
    }
  });

  return contributors.map(c => ({
    id: c.id,
    fullName: (c as any).user?.employee?.full_name ?? "Unknown",
    roleType: c.role_type,
    objectiveStatus: c.employeeObjectives?.status_code ?? "pending",
    finalScore: c.employeeObjectives?.final_score ?? 0,
  }));
}
