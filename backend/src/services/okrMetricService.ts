import { prisma } from "src/app";
import { OkrMetricCategory } from "@prisma/client";

export type MetricBehaviorType =
  | "NUMERIC"
  | "PERCENTAGE"
  | "CURRENCY"
  | "MILESTONE"
  | "RATING"
  | "CUSTOM";

interface CreateMetricInput {
  companyId: number;
  code?: string;
  name: string;
  category?: OkrMetricCategory;
  category_code?: string;
  unit_of_measure?: string;
  isFinancial?: boolean;
  requiresTargetValue?: boolean;
  allowsBinaryCompletion?: boolean;
  supportsValueRollup?: boolean;
  supportsWeightedScore?: boolean;
  valueBasedProgress?: boolean;
}

interface UpdateMetricInput {
  metricId: number;
  companyId: number;
  code?: string;
  name?: string;
  category?: OkrMetricCategory;
  category_code?: string;
  unit_of_measure?: string | null;
  isFinancial?: boolean;
  requiresTargetValue?: boolean;
  allowsBinaryCompletion?: boolean;
  supportsValueRollup?: boolean;
  supportsWeightedScore?: boolean;
  valueBasedProgress?: boolean;
  isActive?: boolean;
}

interface CreateMetricCategoryInput {
  companyId: number;
  actorId: string;
  name: string;
  code?: string;
  behavior_type?: MetricBehaviorType;
  description?: string;
}

interface UpdateMetricCategoryInput {
  categoryId: number;
  companyId: number;
  name?: string;
  code?: string;
  behavior_type?: MetricBehaviorType;
  description?: string | null;
  is_active?: boolean;
}

const RESERVED_CATEGORY_CODES = new Set([
  "NUMERIC",
  "PERCENTAGE",
  "CURRENCY",
  "MILESTONE",
  "RATING",
  "CUSTOM",
]);

function toCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function titleize(input: string): string {
  return input
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStatusCode(value: string): string {
  return toCode(value);
}

function resolveBehaviorConfig(behaviorType: MetricBehaviorType) {
  if (behaviorType === "MILESTONE") {
    return {
      category: "MILESTONE" as OkrMetricCategory,
      requiresTargetValue: false,
      allowsBinaryCompletion: true,
    };
  }

  if (behaviorType === "PERCENTAGE") {
    return {
      category: "PERCENTAGE" as OkrMetricCategory,
      requiresTargetValue: true,
      allowsBinaryCompletion: false,
    };
  }

  if (behaviorType === "NUMERIC") {
    return {
      category: "NUMERIC" as OkrMetricCategory,
      requiresTargetValue: true,
      allowsBinaryCompletion: false,
    };
  }

  if (behaviorType === "CURRENCY") {
    return {
      category: "CURRENCY" as OkrMetricCategory,
      requiresTargetValue: true,
      allowsBinaryCompletion: false,
    };
  }

  if (behaviorType === "RATING") {
    return {
      category: "RATING" as OkrMetricCategory,
      requiresTargetValue: true,
      allowsBinaryCompletion: false,
    };
  }

  return {
    category: "CUSTOM" as OkrMetricCategory,
    requiresTargetValue: true,
    allowsBinaryCompletion: false,
  };
}

async function ensureDefaultCategoryOptions(
  companyId: number,
  actorId = "system",
) {
  const defaults: Array<{
    code: string;
    name: string;
    behavior_type: MetricBehaviorType;
    description: string;
  }> = [
    {
      code: "NUMERIC",
      name: "Numeric",
      behavior_type: "NUMERIC",
      description: "Numeric values against a target.",
    },
    {
      code: "PERCENTAGE",
      name: "Percentage",
      behavior_type: "PERCENTAGE",
      description: "Percent completion or ratio metrics.",
    },
    {
      code: "CURRENCY",
      name: "Currency",
      behavior_type: "CURRENCY",
      description: "Financial metrics expressed as currency.",
    },
    {
      code: "MILESTONE",
      name: "Milestone",
      behavior_type: "MILESTONE",
      description: "Milestone completion style metric.",
    },
    {
      code: "RATING",
      name: "Rating",
      behavior_type: "RATING",
      description: "Rating-based metrics.",
    },
    {
      code: "CUSTOM",
      name: "Custom",
      behavior_type: "CUSTOM",
      description: "Custom metric behavior.",
    },
  ];

  await Promise.all(
    defaults.map((item) =>
      prisma.okrMetricCategoryOption.upsert({
        where: {
          company_id_code: {
            company_id: companyId,
            code: item.code,
          },
        },
        update: {
          name: item.name,
          behavior_type: item.behavior_type,
          description: item.description,
          is_active: true,
        },
        create: {
          company_id: companyId,
          code: item.code,
          name: item.name,
          behavior_type: item.behavior_type,
          description: item.description,
          is_active: true,
          created_by: actorId,
        },
      }),
    ),
  );
}

async function resolveCategoryOption(params: {
  companyId: number;
  actorId?: string;
  categoryCode?: string;
  category?: OkrMetricCategory;
}) {
  const { companyId, categoryCode, category } = params;
  await ensureDefaultCategoryOptions(companyId, params.actorId || "system");

  const requestedCode = normalizeStatusCode(
    categoryCode || category || "CUSTOM",
  );

  const categoryOption = await prisma.okrMetricCategoryOption.findFirst({
    where: {
      company_id: companyId,
      code: requestedCode,
      is_active: true,
    },
  });

  if (!categoryOption) {
    throw new Error(`Metric category '${requestedCode}' not found.`);
  }

  return categoryOption;
}

function normalizeMetricResponse(metric: any) {
  const categoryCode = String(metric.category || "CUSTOM").toUpperCase();
  const behavior = categoryCode === "BINARY" ? "MILESTONE" : categoryCode;

  return {
    ...metric,
    category: behavior,
    category_code: metric.category_label
      ? normalizeStatusCode(String(metric.category_label))
      : behavior,
    category_label: metric.category_label || titleize(behavior),
    value_based_progress: metric.value_based_progress ?? false,
    supports_value_rollup: metric.supports_value_rollup ?? true,
    supports_weighted_score: metric.supports_weighted_score ?? true,
  };
}

export async function createMetric(input: CreateMetricInput) {
  const rawCode = input.code || input.name;
  const code = toCode(rawCode);

  if (!code) {
    throw new Error("Metric code could not be derived from the provided name.");
  }

  const metricName = String(input.name || "").trim();
  if (!metricName) {
    throw new Error("Metric name is required.");
  }

  const categoryOption = await resolveCategoryOption({
    companyId: input.companyId,
    categoryCode: input.category_code,
    category: input.category,
  });

  const behaviorConfig = resolveBehaviorConfig(
    categoryOption.behavior_type as MetricBehaviorType,
  );

  // Idempotent write to avoid duplicate key crashes on (company_id, code)
  // Validation: value_based_progress requires supports_value_rollup
  const valueBasedProgress = input.valueBasedProgress ?? false;
  const supportsValueRollup = valueBasedProgress ? true : (input.supportsValueRollup ?? true);
  const supportsWeightedScore = input.supportsWeightedScore ?? true;

  const metric = await prisma.okrMetricDefinition.upsert({
    where: {
      company_id_code: {
        company_id: input.companyId,
        code,
      },
    },
    create: {
      company_id: input.companyId,
      code,
      name: metricName,
      category: behaviorConfig.category,
      category_label: categoryOption.name,
      unit_of_measure: input.unit_of_measure,
      is_financial: input.isFinancial ?? false,
      requires_target_value:
        input.requiresTargetValue ?? behaviorConfig.requiresTargetValue,
      allows_binary_completion:
        input.allowsBinaryCompletion ?? behaviorConfig.allowsBinaryCompletion,
      supports_value_rollup: supportsValueRollup,
      supports_weighted_score: supportsWeightedScore,
      value_based_progress: valueBasedProgress,
    },
    update: {
      name: metricName,
      category: behaviorConfig.category,
      category_label: categoryOption.name,
      unit_of_measure: input.unit_of_measure,
      is_financial: input.isFinancial ?? false,
      requires_target_value:
        input.requiresTargetValue ?? behaviorConfig.requiresTargetValue,
      allows_binary_completion:
        input.allowsBinaryCompletion ?? behaviorConfig.allowsBinaryCompletion,
      supports_value_rollup: supportsValueRollup,
      supports_weighted_score: supportsWeightedScore,
      value_based_progress: valueBasedProgress,
      is_active: true,
    },
  });

  return normalizeMetricResponse(metric);
}

export async function updateMetric(input: UpdateMetricInput) {
  const existingMetric = await prisma.okrMetricDefinition.findFirst({
    where: {
      id: input.metricId,
      company_id: input.companyId,
    },
  });

  if (!existingMetric) {
    throw new Error("Metric not found.");
  }

  const hasCategoryUpdate = Boolean(input.category || input.category_code);
  const categoryOption = hasCategoryUpdate
    ? await resolveCategoryOption({
        companyId: input.companyId,
        categoryCode: input.category_code,
        category: input.category,
      })
    : null;

  const behaviorConfig = categoryOption
    ? resolveBehaviorConfig(categoryOption.behavior_type as MetricBehaviorType)
    : null;

  const nextCode =
    input.code !== undefined ? toCode(input.code) : existingMetric.code;

  if (!nextCode) {
    throw new Error("Metric code cannot be empty.");
  }

  const nextName =
    input.name !== undefined ? String(input.name).trim() : existingMetric.name;

  if (!nextName) {
    throw new Error("Metric name cannot be empty.");
  }

  // Validation: value_based_progress requires supports_value_rollup
  let resolvedSupportsValueRollup = input.supportsValueRollup;
  if (input.valueBasedProgress === true) {
    resolvedSupportsValueRollup = true;
  }

  const updated = await prisma.okrMetricDefinition.update({
    where: { id: existingMetric.id },
    data: {
      code: nextCode,
      name: nextName,
      category: behaviorConfig ? behaviorConfig.category : undefined,
      category_label: categoryOption ? categoryOption.name : undefined,
      unit_of_measure:
        input.unit_of_measure !== undefined ? input.unit_of_measure : undefined,
      is_financial:
        input.isFinancial !== undefined ? input.isFinancial : undefined,
      requires_target_value:
        input.requiresTargetValue !== undefined
          ? input.requiresTargetValue
          : behaviorConfig
            ? behaviorConfig.requiresTargetValue
            : undefined,
      allows_binary_completion:
        input.allowsBinaryCompletion !== undefined
          ? input.allowsBinaryCompletion
          : behaviorConfig
            ? behaviorConfig.allowsBinaryCompletion
            : undefined,
      supports_value_rollup: resolvedSupportsValueRollup,
      supports_weighted_score: input.supportsWeightedScore,
      value_based_progress: input.valueBasedProgress,
      is_active: input.isActive,
    },
  });

  return normalizeMetricResponse(updated);
}

export async function deleteMetric(companyId: number, metricId: number) {
  const metric = await prisma.okrMetricDefinition.findFirst({
    where: { id: metricId, company_id: companyId },
    include: {
      CompanyKeyResult: { select: { id: true }, take: 1 },
      EmployeeKeyResult: { select: { id: true }, take: 1 },
      DailyPlan: { select: { id: true }, take: 1 },
      WeeklyPlan: { select: { id: true }, take: 1 },
      Subtask: { select: { id: true }, take: 1 },
    },
  });

  if (!metric) {
    throw new Error("Metric not found.");
  }

  const inUse =
    metric.CompanyKeyResult.length > 0 ||
    metric.EmployeeKeyResult.length > 0 ||
    metric.DailyPlan.length > 0 ||
    metric.WeeklyPlan.length > 0 ||
    metric.Subtask.length > 0;

  if (inUse) {
    throw new Error("Cannot delete metric that is already in use.");
  }

  await prisma.okrMetricDefinition.update({
    where: { id: metric.id },
    data: { is_active: false },
  });

  return { deleted: true, id: metric.id };
}

export async function listMetrics(companyId: number) {
  const metrics = await prisma.okrMetricDefinition.findMany({
    where: { company_id: companyId, is_active: true },
    orderBy: { name: "asc" },
  });

  return metrics.map(normalizeMetricResponse);
}

export async function getMetricByCode(companyId: number, code: string) {
  const metric = await prisma.okrMetricDefinition.findUnique({
    where: { company_id_code: { company_id: companyId, code } },
  });

  if (!metric) return null;
  return normalizeMetricResponse(metric);
}

export async function listMetricCategories(
  companyId: number,
  actorId = "system",
) {
  await ensureDefaultCategoryOptions(companyId, actorId);

  const categories = await prisma.okrMetricCategoryOption.findMany({
    where: { company_id: companyId, is_active: true },
    orderBy: { name: "asc" },
  });

  return categories.map((category) => ({
    ...category,
    code: normalizeStatusCode(category.code),
    behavior_type:
      category.behavior_type === "BINARY"
        ? "MILESTONE"
        : category.behavior_type,
  }));
}

export async function createMetricCategory(input: CreateMetricCategoryInput) {
  await ensureDefaultCategoryOptions(input.companyId, input.actorId);

  const name = String(input.name || "").trim();
  if (!name) {
    throw new Error("Category name is required.");
  }

  const code = normalizeStatusCode(input.code || name);
  if (!code) {
    throw new Error("Category code could not be generated.");
  }

  const behaviorType = (
    input.behavior_type || "CUSTOM"
  ).toUpperCase() as MetricBehaviorType;

  if (
    ![
      "NUMERIC",
      "PERCENTAGE",
      "CURRENCY",
      "MILESTONE",
      "RATING",
      "CUSTOM",
    ].includes(behaviorType)
  ) {
    throw new Error("Invalid category behavior type.");
  }

  const created = await prisma.okrMetricCategoryOption.upsert({
    where: {
      company_id_code: {
        company_id: input.companyId,
        code,
      },
    },
    update: {
      name,
      behavior_type: behaviorType,
      description: input.description || null,
      is_active: true,
    },
    create: {
      company_id: input.companyId,
      code,
      name,
      behavior_type: behaviorType,
      description: input.description || null,
      is_active: true,
      created_by: input.actorId,
    },
  });

  return {
    ...created,
    behavior_type:
      created.behavior_type === "BINARY" ? "MILESTONE" : created.behavior_type,
  };
}

export async function updateMetricCategory(input: UpdateMetricCategoryInput) {
  const existing = await prisma.okrMetricCategoryOption.findFirst({
    where: {
      id: input.categoryId,
      company_id: input.companyId,
    },
  });

  if (!existing) {
    throw new Error("Metric category not found.");
  }

  if (RESERVED_CATEGORY_CODES.has(existing.code)) {
    if (input.name || input.code || input.behavior_type) {
      throw new Error(
        "Default metric categories cannot be renamed or retyped.",
      );
    }
  }

  const nextCode =
    input.code !== undefined ? normalizeStatusCode(input.code) : existing.code;
  const nextName =
    input.name !== undefined ? String(input.name).trim() : existing.name;

  if (!nextCode) {
    throw new Error("Category code cannot be empty.");
  }
  if (!nextName) {
    throw new Error("Category name cannot be empty.");
  }

  const nextBehaviorType = (
    input.behavior_type || existing.behavior_type
  ).toUpperCase() as MetricBehaviorType;

  if (
    ![
      "NUMERIC",
      "PERCENTAGE",
      "CURRENCY",
      "MILESTONE",
      "RATING",
      "CUSTOM",
    ].includes(nextBehaviorType)
  ) {
    throw new Error("Invalid category behavior type.");
  }

  const updated = await prisma.okrMetricCategoryOption.update({
    where: { id: existing.id },
    data: {
      code: nextCode,
      name: nextName,
      behavior_type: nextBehaviorType,
      description:
        input.description !== undefined ? input.description : undefined,
      is_active: input.is_active,
    },
  });

  return {
    ...updated,
    behavior_type:
      updated.behavior_type === "BINARY" ? "MILESTONE" : updated.behavior_type,
  };
}

export async function deleteMetricCategory(
  companyId: number,
  categoryId: number,
) {
  const category = await prisma.okrMetricCategoryOption.findFirst({
    where: {
      id: categoryId,
      company_id: companyId,
    },
  });

  if (!category) {
    throw new Error("Metric category not found.");
  }

  if (RESERVED_CATEGORY_CODES.has(category.code)) {
    throw new Error("Default metric categories cannot be deleted.");
  }

  const linkedMetric = await prisma.okrMetricDefinition.findFirst({
    where: {
      company_id: companyId,
      category_label: category.name,
      is_active: true,
    },
    select: { id: true },
  });

  if (linkedMetric) {
    throw new Error("Cannot delete category that is in use by active metrics.");
  }

  await prisma.okrMetricCategoryOption.update({
    where: { id: category.id },
    data: { is_active: false },
  });

  return { deleted: true, id: category.id };
}

export async function normalizeAndBuildStatus(input: {
  displayName: string;
  statusCode?: string;
}) {
  const displayName = String(input.displayName || "").trim();
  if (!displayName) {
    throw new Error("Status name is required.");
  }

  const statusCode = normalizeStatusCode(input.statusCode || displayName);
  if (!statusCode) {
    throw new Error("Status code could not be generated.");
  }

  return {
    display_name: titleize(displayName),
    status_code: statusCode,
  };
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
        category_label: "Percentage",
        unit_of_measure: "%",
        is_financial: false,
        requires_target_value: true,
        allows_binary_completion: false,
        supports_weighted_score: true,
        supports_value_rollup: true,
      },
    });
  }

  return normalizeMetricResponse(metric);
}
