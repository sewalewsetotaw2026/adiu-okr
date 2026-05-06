import { prisma } from "src/app";
import { resolveConfigValue } from "src/services/okrConfigResolverService";

/**
 * Validates that a title is present and has a minimum length.
 */
export function validateTitleAndDescription(
  title?: string,
  description?: string,
) {
  if (!title || title.trim().length === 0) {
    throw new Error("Title is required.");
  }
  if (title.trim().length < 3) {
    throw new Error("Title must be at least 3 characters long.");
  }
  // Optional: Enforce description length if present
  if (
    description !== undefined &&
    description !== null &&
    description.trim().length > 2000
  ) {
    throw new Error("Description exceeds maximum allowed length.");
  }
}

/**
 * Ensures duplicate KRs with exact same titles are not created under the same Objective.
 * Excludes archived records to allow reuse of titles for archived key results.
 */
export async function validateDuplicateKR(
  companyId: number,
  title: string,
  parentObjectiveId: number,
  layer: "COMPANY" | "DEPARTMENT" | "EMPLOYEE",
  excludeKrId?: number,
) {
  if (layer === "COMPANY") {
    const existing = await prisma.companyKeyResult.findFirst({
      where: {
        company_id: companyId,
        objective_id: parentObjectiveId,
        title: { equals: title, mode: "insensitive" },
        status_code: { not: "archived" },
        id: excludeKrId ? { not: excludeKrId } : undefined,
      },
    });
    if (existing)
      throw new Error(
        `A Company Key Result with the title "${title}" already exists under this objective.`,
      );
  } else if (layer === "DEPARTMENT") {
    const existing = await prisma.employeeKeyResult.findFirst({
      where: {
        company_id: companyId,
        employee_objective_id: parentObjectiveId,
        title: { equals: title, mode: "insensitive" },
        status_code: { not: "archived" },
        id: excludeKrId ? { not: excludeKrId } : undefined,
      },
    });
    if (existing)
      throw new Error(
        `A Department Key Result with the title "${title}" already exists under this objective.`,
      );
  } else if (layer === "EMPLOYEE") {
    const existing = await prisma.employeeKeyResult.findFirst({
      where: {
        company_id: companyId,
        employee_objective_id: parentObjectiveId,
        title: { equals: title, mode: "insensitive" },
        status_code: { not: "archived" },
        id: excludeKrId ? { not: excludeKrId } : undefined,
      },
    });
    if (existing)
      throw new Error(
        `An Employee Key Result with the title "${title}" already exists under this objective.`,
      );
  }
}

/**
 * Ensures an Objective is safe to publish (based on KR count limits).
 */
export async function validateSafePublish(
  companyId: number,
  objectiveId: number,
  layer: "COMPANY" | "DEPARTMENT" | "EMPLOYEE",
  cycleId?: number,
  departmentId?: number,
) {
  let count = 0;
  if (layer === "COMPANY") {
    count = await prisma.companyKeyResult.count({
      where: {
        company_id: companyId,
        objective_id: objectiveId,
        status_code: { not: "archived" },
      },
    });
  } else if (layer === "DEPARTMENT") {
    count = await prisma.employeeKeyResult.count({
      where: {
        company_id: companyId,
        employee_objective_id: objectiveId,
        status_code: { not: "archived" },
      },
    });
  } else if (layer === "EMPLOYEE") {
    count = await prisma.employeeKeyResult.count({
      where: {
        company_id: companyId,
        employee_objective_id: objectiveId,
        status_code: { not: "archived" },
      },
    });
  }

  const minKrs =
    (await resolveConfigValue({
      companyId,
      configKey: "min_krs_per_objective",
      cycleId,
      departmentId,
    })) || 2;
  const maxKrs =
    (await resolveConfigValue({
      companyId,
      configKey: "max_krs_per_objective",
      cycleId,
      departmentId,
    })) || 6;

  if (count < Number(minKrs)) {
    throw new Error(
      `Cannot publish objective. It must have at least ${minKrs} Key Result(s). Currently has ${count}.`,
    );
  }
  if (count > Number(maxKrs)) {
    throw new Error(
      `Cannot publish objective. It exceeds the maximum of ${maxKrs} Key Results. Currently has ${count}.`,
    );
  }
}

/**
 * Validates that if a KR contributes to value, it should ideally have a valid metric definition.
 * It strictly forbids using empty string or missing definitions if value contribution is required.
 */
export async function validateMetricRequirement(
  companyId: number,
  metricDefinitionId?: number | null,
  contributesToValue: boolean = true,
) {
  if (!contributesToValue) return; // Non-value contributing KRs are less strict.

  if (!metricDefinitionId) {
    throw new Error(
      "A valid metric definition is required for Key Results that contribute to value.",
    );
  }

  const metric = await prisma.okrMetricDefinition.findFirst({
    where: { id: metricDefinitionId, company_id: companyId, is_active: true },
  });

  if (!metric) {
    throw new Error(
      `Metric definition ID ${metricDefinitionId} is invalid or inactive.`,
    );
  }
}

/**
 * Ensures an entity is not archived before allowing mutations.
 */
export async function validateNotArchived(
  companyId: number,
  objectiveId: number,
  layer: "COMPANY" | "DEPARTMENT" | "EMPLOYEE",
) {
  let isArchived = false;
  if (layer === "COMPANY") {
    const obj = await prisma.companyObjective.findFirst({
      where: { id: objectiveId, company_id: companyId },
      select: { is_archived: true },
    });
    if (obj?.is_archived) isArchived = true;
  } else if (layer === "DEPARTMENT") {
    const obj = await prisma.employeeObjective.findFirst({
      where: { id: objectiveId, company_id: companyId },
      select: { is_archived: true },
    });
    if (obj?.is_archived) isArchived = true;
  } else if (layer === "EMPLOYEE") {
    const obj = await prisma.employeeObjective.findFirst({
      where: { id: objectiveId, company_id: companyId },
      select: { is_archived: true },
    });
    if (obj?.is_archived) isArchived = true;
  }

  if (isArchived) {
    throw new Error(
      `Cannot modify Objective #${objectiveId} because it has been archived.`,
    );
  }
}
