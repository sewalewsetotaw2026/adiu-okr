import { prisma } from "src/app";
import { logActivity } from "src/services/okrActivityLogService";

export async function markEmployeeKrAsComplete(companyId: number, krId: number, actorId: string) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id: krId, company_id: companyId },
    include: { subtasks: true }
  });
  if (!kr) throw new Error("Employee Key Result not found.");

  // For binary/milestone completions, ensure all subtasks are done if any exist
  if (kr.subtasks.length > 0) {
    const incompleteSubtasks = kr.subtasks.filter(s => s.status_code !== "completed");
    if (incompleteSubtasks.length > 0) {
      throw new Error(`Cannot mark KR as complete. There are ${incompleteSubtasks.length} incomplete subtasks.`);
    }
  }

  const updatedKr = await prisma.employeeKeyResult.update({
    where: { id: krId },
    data: { status_code: "completed", final_score: 100 }
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_KR",
    entityId: krId,
    actorId,
    action: "employee_kr_completed",
    description: `Employee KR '${kr.title}' marked as complete.`
  });

  await checkObjectiveCompletionStatus(companyId, kr.employee_objective_id, actorId);

  return updatedKr;
}

export async function markEmployeeObjectiveAsComplete(companyId: number, objectiveId: number, actorId: string) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id: objectiveId, company_id: companyId }
  });
  if (!objective) throw new Error("Employee Objective not found.");

  await prisma.employeeObjective.update({
    where: { id: objectiveId },
    data: { status_code: "completed" }
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    entityId: objectiveId,
    actorId,
    action: "employee_objective_completed",
    description: `Employee Objective '${objective.title}' mapped and marked as complete.`
  });

  await updateContributorCompletion(companyId, objective.kr_contributor_id, actorId);
}

export async function checkObjectiveCompletionStatus(companyId: number, objectiveId: number, actorId: string) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id: objectiveId, company_id: companyId },
    include: { keyResults: true }
  });
  
  if (!objective || objective.status_code === "completed") return;

  const requiredKrs = objective.keyResults.filter(kr => kr.is_mandatory_for_completion);
  if (requiredKrs.length === 0) return;

  const allRequiredDone = requiredKrs.every(kr => kr.status_code === "completed");
  if (allRequiredDone) {
    await markEmployeeObjectiveAsComplete(companyId, objectiveId, actorId);
  }
}

export async function updateContributorCompletion(companyId: number, krContributorId: number, actorId: string) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { kr_contributor_id: krContributorId }
  });
  let statusCode = "active";
  if (objective && objective.status_code === "completed") {
    statusCode = "completed";
  }

  await prisma.krContributor.update({
    where: { id: krContributorId },
    data: { status_code: statusCode }
  });

  if (statusCode === "completed") {
    const contributor = await prisma.krContributor.findUnique({
      where: { id: krContributorId },
      select: { employee_kr_id: true }
    });
    if (contributor && contributor.employee_kr_id) {
      await checkDepartmentKrCompletionStatus(companyId, contributor.employee_kr_id, actorId);
    }
  }
}

export async function checkDepartmentKrCompletionStatus(companyId: number, krId: number, actorId: string) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id: krId, company_id: companyId },
    include: { contributors: true }
  });
  if (!kr || kr.status_code === "completed") return;

  const requiredContributors = kr.contributors.filter(c => c.is_required_for_completion);
  if (requiredContributors.length === 0) return;

  const allDone = requiredContributors.every(c => c.status_code === "completed");
  if (allDone) {
    await markDepartmentKrAsComplete(companyId, krId, actorId);
  }
}

export async function markDepartmentKrAsComplete(companyId: number, krId: number, actorId: string) {
  const kr = await prisma.employeeKeyResult.findFirst({
    where: { id: krId, company_id: companyId }
  });
  if (!kr) return;

  await prisma.employeeKeyResult.update({
    where: { id: krId },
    data: { status_code: "completed", final_score: 100 }
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_KR",
    entityId: krId,
    actorId,
    action: "department_kr_completed",
    description: `Department KR '${kr.title}' marked as complete based on contributor success.`
  });

  await checkDepartmentObjectiveCompletionStatus(companyId, kr.employee_objective_id, actorId);
}

// === DEPARTMENT LEVEL ===

export async function markDepartmentObjectiveAsComplete(companyId: number, objectiveId: number, actorId: string) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id: objectiveId, company_id: companyId },
    include: { keyResults: true }
  });
  if (!objective) throw new Error("Department Objective not found.");

  // Guard: Ensure mandatory KRs are complete
  const requiredKrs = objective.keyResults.filter(kr => kr.is_mandatory_for_completion);
  const incompleteRequired = requiredKrs.filter(kr => kr.status_code !== "completed" && kr.status_code !== "done");
  if (incompleteRequired.length > 0) {
    throw new Error(`Cannot complete Department Objective: ${incompleteRequired.length} mandatory KRs are incomplete.`);
  }

  await prisma.employeeObjective.update({
    where: { id: objectiveId },
    data: { status_code: "completed" }
  });

  await logActivity({
    companyId,
    entityType: "EMPLOYEE_OBJECTIVE",
    entityId: objectiveId,
    actorId,
    action: "department_objective_completed",
    description: `Department Objective '${objective.title}' marked as complete.`
  });

  if (objective.chosen_parent_kr_id) {
    await checkCompanyKrCompletionStatus(companyId, objective.chosen_parent_kr_id, actorId);
  }
}

export async function checkDepartmentObjectiveCompletionStatus(companyId: number, objectiveId: number, actorId: string) {
  const objective = await prisma.employeeObjective.findFirst({
    where: { id: objectiveId, company_id: companyId },
    include: { keyResults: true }
  });
  
  if (!objective || objective.status_code === "completed") return;

  const requiredKrs = objective.keyResults.filter(kr => kr.is_mandatory_for_completion);
  if (requiredKrs.length === 0) return;

  const allRequiredDone = requiredKrs.every(kr => kr.status_code === "completed" || kr.status_code === "done");
  if (allRequiredDone) {
    await markDepartmentObjectiveAsComplete(companyId, objectiveId, actorId);
  }
}

// === COMPANY LEVEL ===

export async function checkCompanyKrCompletionStatus(companyId: number, krId: number, actorId: string) {
  const kr = await prisma.companyKeyResult.findFirst({
    where: { id: krId, company_id: companyId },
    include: { employeeObjectives: true }
  });
  if (!kr || kr.status_code === "completed") return;

  const incompleteDepts = kr.employeeObjectives.filter(do_ => do_.status_code !== "completed");
  
  if (incompleteDepts.length === 0 && kr.employeeObjectives.length > 0) {
    await prisma.companyKeyResult.update({
      where: { id: krId },
      data: { status_code: "completed" }
    });

    await logActivity({
      companyId,
      entityType: "COMPANY_KR",
      entityId: krId,
      actorId,
      action: "company_kr_completed",
      description: `Company KR '${kr.title}' marked as complete as all linked department objectives finished.`
    });

    await checkCompanyObjectiveCompletionStatus(companyId, kr.objective_id, actorId);
  }
}

export async function markCompanyObjectiveAsComplete(companyId: number, objectiveId: number, actorId: string) {
  const objective = await prisma.companyObjective.findFirst({
    where: { id: objectiveId, company_id: companyId },
    include: { keyResults: true }
  });
  if (!objective) throw new Error("Company Objective not found.");

  // Guard: Ensure mandatory KRs are complete
  const requiredKrs = objective.keyResults.filter(kr => kr.is_mandatory_for_completion);
  const incompleteRequired = requiredKrs.filter(kr => kr.status_code !== "completed" && kr.status_code !== "done");
  if (incompleteRequired.length > 0) {
    throw new Error(`Cannot complete Company Objective: ${incompleteRequired.length} mandatory KRs are incomplete.`);
  }

  await prisma.companyObjective.update({
    where: { id: objectiveId },
    data: { status_code: "completed" }
  });

  await logActivity({
    companyId,
    entityType: "COMPANY_OBJECTIVE",
    entityId: objectiveId,
    actorId,
    action: "company_objective_completed",
    description: `Company Objective '${objective.title}' marked as complete.`
  });
}

export async function checkCompanyObjectiveCompletionStatus(companyId: number, objectiveId: number, actorId: string) {
  const objective = await prisma.companyObjective.findFirst({
    where: { id: objectiveId, company_id: companyId },
    include: { keyResults: true }
  });
  
  if (!objective || objective.status_code === "completed") return;

  const requiredKrs = objective.keyResults.filter(kr => kr.is_mandatory_for_completion);
  if (requiredKrs.length === 0) return;

  const allRequiredDone = requiredKrs.every(kr => kr.status_code === "completed" || kr.status_code === "done");
  if (allRequiredDone) {
    await markCompanyObjectiveAsComplete(companyId, objectiveId, actorId);
  }
}
