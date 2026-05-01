import { prisma } from "src/app";
import { OkrEntityType } from "@prisma/client";

interface LogActivityParams {
  companyId: number;
  entityType: OkrEntityType;
  entityId: number;
  actorId: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;
}

export async function logActivity(params: LogActivityParams) {
  return prisma.okrActivityLog.create({
    data: {
      company_id: params.companyId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      actor_id: params.actorId,
      action: params.action,
      description: params.description,
      metadata: params.metadata || undefined,
    },
  });
}

export async function getActivityLog(
  entityType: OkrEntityType,
  entityId: number,
  limit = 50
) {
  return prisma.okrActivityLog.findMany({
    where: { entity_type: entityType, entity_id: entityId },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}

export async function getActivityLogByCompany(
  companyId: number,
  limit = 100
) {
  return prisma.okrActivityLog.findMany({
    where: { company_id: companyId },
    orderBy: { created_at: "desc" },
    take: limit,
  });
}
