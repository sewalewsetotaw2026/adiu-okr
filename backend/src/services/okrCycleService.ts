import { prisma } from "src/app";
import { OkrCycleStatus } from "@prisma/client";
import { logActivity } from "src/services/okrActivityLogService";

interface CreateCycleInput {
  companyId: number;
  name: string;
  quarterLabel?: string;
  startDate: string;
  endDate: string;
  description?: string;
  createdBy: string;
}

interface UpdateCycleInput {
  name?: string;
  quarterLabel?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

export async function createCycle(input: CreateCycleInput) {
  const existing = await prisma.okrCycle.findUnique({
    where: {
      company_id_name: { company_id: input.companyId, name: input.name },
    },
  });
  if (existing) {
    throw new Error(`Cycle "${input.name}" already exists for this company.`);
  }

  const cycle = await prisma.okrCycle.create({
    data: {
      company_id: input.companyId,
      name: input.name,
      quarter_label: input.quarterLabel,
      start_date: new Date(input.startDate),
      end_date: new Date(input.endDate),
      description: input.description,
      status: "DRAFT",
      created_by: input.createdBy,
    },
  });

  await logActivity({
    companyId: input.companyId,
    entityType: "CYCLE",
    entityId: cycle.id,
    actorId: input.createdBy,
    action: "cycle_created",
    description: `Cycle "${cycle.name}" created`,
  });

  return cycle;
}

export async function updateCycle(
  id: number,
  companyId: number,
  input: UpdateCycleInput
) {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id, company_id: companyId },
  });
  if (!cycle) throw new Error("Cycle not found.");
  if (cycle.status !== "DRAFT" && cycle.status !== "OPEN") {
    throw new Error("Only DRAFT or OPEN cycles can be edited.");
  }

  return prisma.okrCycle.update({
    where: { id },
    data: {
      name: input.name,
      quarter_label: input.quarterLabel,
      start_date: input.startDate ? new Date(input.startDate) : undefined,
      end_date: input.endDate ? new Date(input.endDate) : undefined,
      description: input.description,
    },
  });
}

export async function listCycles(companyId: number) {
  const cycles = await prisma.okrCycle.findMany({
    where: { company_id: companyId },
    orderBy: { created_at: "desc" },
    include: {
      _count: { select: { companyObjectives: true } },
    },
  });

  return cycles.map((c) => ({
    ...c,
    totalObjectives: c._count.companyObjectives,
    _count: undefined,
  }));
}

export async function getCycleById(id: number, companyId: number) {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id, company_id: companyId },
    include: {
      _count: { select: { companyObjectives: true, employeeObjectives: true } },
    },
  });
  if (!cycle) throw new Error("Cycle not found.");
  return {
    ...cycle,
    totalObjectives: cycle._count.companyObjectives,
    totalEmployeeObjectives: cycle._count.employeeObjectives,
    _count: undefined,
  };
}

export async function openCycle(id: number, companyId: number, actorId: string) {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id, company_id: companyId },
  });
  if (!cycle) throw new Error("Cycle not found.");
  if (cycle.status !== "DRAFT") {
    throw new Error("Only DRAFT cycles can be opened.");
  }

  const existingOpen = await prisma.okrCycle.findFirst({
    where: { company_id: companyId, status: "OPEN" },
  });
  if (existingOpen) {
    throw new Error(
      `Cycle "${existingOpen.name}" is already open. Close it before opening a new one.`
    );
  }

  const updated = await prisma.okrCycle.update({
    where: { id },
    data: { status: "OPEN" },
  });

  await logActivity({
    companyId,
    entityType: "CYCLE",
    entityId: id,
    actorId,
    action: "cycle_opened",
    description: `Cycle "${cycle.name}" opened for planning`,
  });

  return updated;
}

export async function closeCycle(id: number, companyId: number, actorId: string) {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id, company_id: companyId },
  });
  if (!cycle) throw new Error("Cycle not found.");
  if (cycle.status === "CLOSED" || cycle.status === "ARCHIVED") {
    return cycle;
  }
  if (cycle.status !== "OPEN") {
    throw new Error("Only OPEN cycles can be closed.");
  }

  const updated = await prisma.okrCycle.update({
    where: { id },
    data: {
      status: "CLOSED",
      closed_by: actorId,
      closed_at: new Date(),
    },
  });

  await logActivity({
    companyId,
    entityType: "CYCLE",
    entityId: id,
    actorId,
    action: "cycle_closed",
    description: `Cycle "${cycle.name}" closed`,
  });

  return updated;
}

export async function getCurrentOpenCycle(companyId: number) {
  return prisma.okrCycle.findFirst({
    where: { company_id: companyId, status: "OPEN" },
    include: {
      _count: { select: { companyObjectives: true } },
    },
  });
}

export async function getArchiveReadySummary(id: number, companyId: number) {
  const cycle = await prisma.okrCycle.findFirst({
    where: { id, company_id: companyId },
    include: {
      _count: { select: { companyObjectives: true, employeeObjectives: true } },
    },
  });
  if (!cycle) throw new Error("Cycle not found.");

  const completedObjectives = await prisma.companyObjective.count({
    where: { cycle_id: id, company_id: companyId, status_code: "completed" },
  });

  return {
    cycleId: cycle.id,
    cycleName: cycle.name,
    status: cycle.status,
    totalCompanyObjectives: cycle._count.companyObjectives,
    completedCompanyObjectives: completedObjectives,
    totalEmployeeObjectives: cycle._count.employeeObjectives,
    isArchiveReady: cycle.status === "CLOSED",
  };
}
