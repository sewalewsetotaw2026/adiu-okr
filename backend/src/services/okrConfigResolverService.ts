import { prisma } from "src/app";

export interface ConfigResolutionParams {
  companyId: number;
  configKey: string;
  cycleId?: number;
  departmentId?: number;
  roleCode?: string;
}

export type PlanningCadenceType = "MONTHLY" | "WEEKLY" | "DAILY";
export type PlanningLevel =
  | "CEO"
  | "DIRECTOR"
  | "MANAGER_TEAM_LEADER"
  | "EMPLOYEE";

export interface CadencePermission {
  allow_monthly: boolean;
  allow_weekly: boolean;
  allow_daily: boolean;
}

export interface LevelConfiguration {
  CEO: CadencePermission;
  DIRECTOR: CadencePermission;
  MANAGER_TEAM_LEADER: CadencePermission;
  EMPLOYEE: CadencePermission;
}

const DEFAULT_LEVEL_CONFIGURATION: LevelConfiguration = {
  CEO: { allow_monthly: true, allow_weekly: false, allow_daily: false },
  DIRECTOR: { allow_monthly: true, allow_weekly: false, allow_daily: false },
  MANAGER_TEAM_LEADER: {
    allow_monthly: true,
    allow_weekly: true,
    allow_daily: true,
  },
  EMPLOYEE: { allow_monthly: true, allow_weekly: true, allow_daily: true },
};

/**
 * Resolves a configuration value dynamically based on precedence rules.
 * Precedence: QUARTER > DEPARTMENT > ROLE > ORGANIZATION > GLOBAL
 */
export async function resolveConfigValue(params: ConfigResolutionParams) {
  const { companyId, configKey, cycleId, departmentId, roleCode } = params;

  const orConditions: any[] = [
    { profile: { scope_type: "ORGANIZATION" } },
    { profile: { scope_type: "GLOBAL" } },
  ];

  if (cycleId) {
    orConditions.push({
      cycle_id: cycleId,
      profile: { scope_type: "QUARTER" },
    });
  }
  if (departmentId) {
    orConditions.push({
      department_id: departmentId,
      profile: { scope_type: "DEPARTMENT" },
    });
  }
  if (roleCode) {
    orConditions.push({ role_code: roleCode, profile: { scope_type: "ROLE" } });
  }

  const values = await prisma.okrConfigValue.findMany({
    where: {
      company_id: companyId,
      config_key: configKey,
      profile: {
        is_active: true,
        assignments: {
          some: {
            company_id: companyId,
            is_active: true,
            OR: orConditions,
          },
        },
      },
    },
    include: {
      profile: true,
    },
  });

  if (!values || values.length === 0) {
    return null;
  }

  // Evaluate precedence
  const getPrecedenceScore = (scopeType: string) => {
    switch (scopeType) {
      case "QUARTER":
        return 5;
      case "DEPARTMENT":
        return 4;
      case "ROLE":
        return 3;
      case "ORGANIZATION":
        return 2;
      case "GLOBAL":
        return 1;
      default:
        return 0;
    }
  };

  const sortedValues = values.sort((a, b) => {
    const scoreA = getPrecedenceScore(a.profile.scope_type);
    const scoreB = getPrecedenceScore(b.profile.scope_type);
    return scoreB - scoreA; // Descending
  });

  return sortedValues[0].config_value_json;
}

function resolveCadence(
  value: unknown,
  fallback: PlanningCadenceType = "MONTHLY",
): PlanningCadenceType {
  if (typeof value === "string") {
    const normalized = value.toUpperCase();
    if (
      normalized === "MONTHLY" ||
      normalized === "WEEKLY" ||
      normalized === "DAILY"
    ) {
      return normalized;
    }
    return fallback;
  }

  if (value && typeof value === "object" && "cadence" in (value as any)) {
    return resolveCadence((value as any).cadence, fallback);
  }

  return fallback;
}

export function mapRoleToPlanningLevel(roleCode?: string): PlanningLevel {
  const normalized = String(roleCode || "").toLowerCase();

  if (normalized.includes("ceo")) return "CEO";
  if (normalized.includes("director")) return "DIRECTOR";
  if (
    normalized.includes("manager") ||
    normalized.includes("team_leader") ||
    normalized.includes("team leader")
  ) {
    return "MANAGER_TEAM_LEADER";
  }

  return "EMPLOYEE";
}

function normalizePermission(
  value: any,
  fallback: CadencePermission,
): CadencePermission {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  return {
    allow_monthly:
      value.allow_monthly !== undefined
        ? value.allow_monthly === true
        : fallback.allow_monthly,
    allow_weekly:
      value.allow_weekly !== undefined
        ? value.allow_weekly === true
        : fallback.allow_weekly,
    allow_daily:
      value.allow_daily !== undefined
        ? value.allow_daily === true
        : fallback.allow_daily,
  };
}

export async function getPlanningCadence(
  companyId: number,
  cycleId?: number,
  departmentId?: number,
): Promise<PlanningCadenceType> {
  const rules = await resolveConfigValue({
    companyId,
    configKey: "planning_cadence_rules",
    cycleId,
    departmentId,
  });

  if (
    rules &&
    typeof rules === "object" &&
    "active_cadence" in (rules as any)
  ) {
    return resolveCadence((rules as any).active_cadence, "MONTHLY");
  }

  const result = await resolveConfigValue({
    companyId,
    configKey: "planning_cadence",
    cycleId,
    departmentId,
  });
  return resolveCadence(result, "MONTHLY");
}

export function getCadencePermissionByConfiguredCadence(
  configuredCadence: PlanningCadenceType,
): CadencePermission {
  if (configuredCadence === "MONTHLY") {
    return { allow_monthly: true, allow_weekly: false, allow_daily: false };
  }
  if (configuredCadence === "WEEKLY") {
    return { allow_monthly: true, allow_weekly: true, allow_daily: false };
  }
  return { allow_monthly: true, allow_weekly: true, allow_daily: true };
}

export async function getLevelConfiguration(
  companyId: number,
  cycleId?: number,
  departmentId?: number,
): Promise<LevelConfiguration> {
  const value = await resolveConfigValue({
    companyId,
    configKey: "level_configuration",
    cycleId,
    departmentId,
  });

  if (!value || typeof value !== "object") {
    return DEFAULT_LEVEL_CONFIGURATION;
  }

  return {
    CEO: normalizePermission(
      (value as any).CEO,
      DEFAULT_LEVEL_CONFIGURATION.CEO,
    ),
    DIRECTOR: normalizePermission(
      (value as any).DIRECTOR,
      DEFAULT_LEVEL_CONFIGURATION.DIRECTOR,
    ),
    MANAGER_TEAM_LEADER: normalizePermission(
      (value as any).MANAGER_TEAM_LEADER,
      DEFAULT_LEVEL_CONFIGURATION.MANAGER_TEAM_LEADER,
    ),
    EMPLOYEE: normalizePermission(
      (value as any).EMPLOYEE,
      DEFAULT_LEVEL_CONFIGURATION.EMPLOYEE,
    ),
  };
}

export async function isCadenceAllowedForRole(params: {
  companyId: number;
  requestedCadence: PlanningCadenceType;
  roleCode?: string;
  cycleId?: number;
  departmentId?: number;
}): Promise<{ allowed: boolean; level: PlanningLevel }> {
  const { companyId, requestedCadence, roleCode, cycleId, departmentId } =
    params;
  const level = mapRoleToPlanningLevel(roleCode);
  const levelConfig = await getLevelConfiguration(
    companyId,
    cycleId,
    departmentId,
  );

  const cadencePermission = levelConfig[level];

  if (requestedCadence === "MONTHLY") {
    return { allowed: cadencePermission.allow_monthly, level };
  }
  if (requestedCadence === "WEEKLY") {
    return { allowed: cadencePermission.allow_weekly, level };
  }
  return { allowed: cadencePermission.allow_daily, level };
}

export async function isStrictSequenceEnabled(
  companyId: number,
  cycleId?: number,
  departmentId?: number,
): Promise<boolean> {
  const result = await resolveConfigValue({
    companyId,
    configKey: "strict_sequence",
    cycleId,
    departmentId,
  });
  return result ? (result as any).enabled === true : false;
}

export async function isParentPublishRequired(
  companyId: number,
  cycleId?: number,
  departmentId?: number,
): Promise<boolean> {
  const result = await resolveConfigValue({
    companyId,
    configKey: "parent_publish_required",
    cycleId,
    departmentId,
  });
  return result ? (result as any).enabled === true : true; // safer default
}

export async function isWeightValidationEnabled(
  companyId: number,
  cycleId?: number,
): Promise<boolean> {
  const result = await resolveConfigValue({
    companyId,
    configKey: "weight_validation",
    cycleId,
  });
  return result ? (result as any).enabled === true : true;
}

export async function isMonthlyPlanRequired(
  companyId: number,
  cycleId?: number,
  departmentId?: number,
): Promise<boolean> {
  const result = await resolveConfigValue({
    companyId,
    configKey: "monthly_plan_required",
    cycleId,
    departmentId,
  });
  return result ? (result as any).enabled === true : true;
}

export async function isAutoPublishOnApprovalEnabled(
  companyId: number,
  cycleId?: number,
  departmentId?: number,
): Promise<boolean> {
  const result = await resolveConfigValue({
    companyId,
    configKey: "auto_publish_on_approval",
    cycleId,
    departmentId,
  });
  return result ? (result as any).enabled === true : false;
}
