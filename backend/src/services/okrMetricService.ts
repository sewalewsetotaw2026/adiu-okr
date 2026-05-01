import { prisma } from "src/app";
import { OkrMetricCategory } from "@prisma/client";

interface CreateMetricInput {
  companyId: number;
  code?: string;
  name: string;
  category: OkrMetricCategory;
  unit_of_measure?: string;
  isFinancial?: boolean;
  requiresTargetValue?: boolean;
  allowsBinaryCompletion?: boolean;
}

export async function createMetric(input: CreateMetricInput) {
  const rawCode = input.code || input.name;
  const code = rawCode
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");

  // Idempotent write to avoid duplicate key crashes on (company_id, code)
  return prisma.okrMetricDefinition.upsert({
    where: {
      company_id_code: {
        company_id: input.companyId,
        code,
      },
    },
    create: {
      company_id: input.companyId,
      code,
      name: input.name,
      category: input.category,
      unit_of_measure: input.unit_of_measure,
      is_financial: input.isFinancial ?? false,
      requires_target_value: input.requiresTargetValue ?? true,
      allows_binary_completion: input.allowsBinaryCompletion ?? false,
    },
    update: {
      name: input.name,
      category: input.category,
      unit_of_measure: input.unit_of_measure,
      is_financial: input.isFinancial ?? false,
      requires_target_value: input.requiresTargetValue ?? true,
      allows_binary_completion: input.allowsBinaryCompletion ?? false,
      is_active: true,
    },
  });
}

export async function listMetrics(companyId: number) {
  return prisma.okrMetricDefinition.findMany({
    where: { company_id: companyId, is_active: true },
    orderBy: { name: "asc" },
  });
}

export async function getMetricByCode(companyId: number, code: string) {
  return prisma.okrMetricDefinition.findUnique({
    where: { company_id_code: { company_id: companyId, code } },
  });
}

export async function getOrCreateFallbackMetric(companyId: number) {
  // 1. Try to find the specific DEFAULT metric
  let metric = await prisma.okrMetricDefinition.findUnique({
    where: { company_id_code: { company_id: companyId, code: "DEFAULT" } },
  });

  // 2. If not found, try any active metric for the company
  if (!metric) {
    metric = await prisma.okrMetricDefinition.findFirst({
      where: { company_id: companyId, is_active: true },
    });
  }

  // 3. If still not found, create the DEFAULT metric
  if (!metric) {
    metric = await prisma.okrMetricDefinition.create({
      data: {
        company_id: companyId,
        code: "DEFAULT",
        name: "Default Metric",
        category: "PERCENTAGE",
        unit_of_measure: "%",
        is_financial: false,
        requires_target_value: true,
        allows_binary_completion: false,
        supports_weighted_score: true,
        supports_value_rollup: true,
      },
    });
  }
  return metric;
}
