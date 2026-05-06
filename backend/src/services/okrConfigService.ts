import { prisma } from "src/app";
import { resolveConfigValue } from "src/services/okrConfigResolverService";

export type PlanningApproach = "TOP_DOWN" | "BOTTOM_UP";
export type PlanningCadenceConfig = "MONTHLY" | "WEEKLY" | "DAILY";
export type PlanningLevel =
  | "CEO"
  | "DIRECTOR"
  | "MANAGER_TEAM_LEADER"
  | "EMPLOYEE";

interface CadenceRuleSet {
  allow_monthly: boolean;
  allow_weekly: boolean;
  allow_daily: boolean;
}

interface PlanningCadenceRules {
  active_cadence: PlanningCadenceConfig;
  rules: {
    MONTHLY: CadenceRuleSet;
    WEEKLY: CadenceRuleSet;
    DAILY: CadenceRuleSet;
  };
}

export interface LevelConfiguration {
  CEO: CadenceRuleSet;
  DIRECTOR: CadenceRuleSet;
  MANAGER_TEAM_LEADER: CadenceRuleSet;
  EMPLOYEE: CadenceRuleSet;
}

export interface MetricConfiguration {
  allowed_metric_definition_ids: number[];
  allow_financial_metrics: boolean;
  allow_non_financial_metrics: boolean;
}

interface AllowedLateTimeConfiguration {
  annual_plan_minutes: number;
  quarterly_plan_minutes: number;
  monthly_plan_minutes: number;
  weekly_plan_minutes: number;
  daily_plan_minutes: number;
  progress_update_minutes: number;
}

interface ConfidenceLevelMapping {
  off_track_lte_percent: number;
  on_track_gte_percent: number;
  at_risk_lte_percent: number;
}

export interface AdditionalConfiguration {
  allowed_late_time: AllowedLateTimeConfiguration;
  confidence_level_mapping: ConfidenceLevelMapping;
  allowed_objectives: {
    min: number;
    max: number;
  };
  allowed_krs: {
    min: number;
    max: number;
  };
  auto_publish_on_approval: boolean;
}

export interface OkrConfigurationMenu {
  planning_approach: {
    options: PlanningApproach[];
    selected: PlanningApproach;
  };
  metric_configuration: MetricConfiguration;
  planning_cadence_rules: PlanningCadenceRules;
  level_configuration: LevelConfiguration;
  additional_configuration: AdditionalConfiguration;
}

const DEFAULT_MENU_CONFIGURATION: OkrConfigurationMenu = {
  planning_approach: {
    options: ["TOP_DOWN", "BOTTOM_UP"],
    selected: "TOP_DOWN",
  },
  metric_configuration: {
    allowed_metric_definition_ids: [],
    allow_financial_metrics: true,
    allow_non_financial_metrics: true,
  },
  planning_cadence_rules: {
    active_cadence: "DAILY",
    rules: {
      MONTHLY: { allow_monthly: true, allow_weekly: false, allow_daily: false },
      WEEKLY: { allow_monthly: true, allow_weekly: true, allow_daily: false },
      DAILY: { allow_monthly: true, allow_weekly: true, allow_daily: true },
    },
  },
  level_configuration: {
    CEO: { allow_monthly: true, allow_weekly: false, allow_daily: false },
    DIRECTOR: { allow_monthly: true, allow_weekly: false, allow_daily: false },
    MANAGER_TEAM_LEADER: {
      allow_monthly: true,
      allow_weekly: true,
      allow_daily: true,
    },
    EMPLOYEE: { allow_monthly: true, allow_weekly: true, allow_daily: true },
  },
  additional_configuration: {
    allowed_late_time: {
      annual_plan_minutes: 120,
      quarterly_plan_minutes: 90,
      monthly_plan_minutes: 60,
      weekly_plan_minutes: 30,
      daily_plan_minutes: 15,
      progress_update_minutes: 10,
    },
    confidence_level_mapping: {
      off_track_lte_percent: 50,
      on_track_gte_percent: 60,
      at_risk_lte_percent: 40,
    },
    allowed_objectives: {
      min: 2,
      max: 6,
    },
    allowed_krs: {
      min: 2,
      max: 6,
    },
    auto_publish_on_approval: true,
  },
};

const CONFIG_KEY_ALIAS: Record<string, string> = {
  "planning-approach": "planning_approach",
  planning_approach: "planning_approach",
  metrics: "metric_configuration",
  "metric-configuration": "metric_configuration",
  metric_configuration: "metric_configuration",
  "planning-cadence": "planning_cadence_rules",
  "planning-cadence-rules": "planning_cadence_rules",
  planning_cadence: "planning_cadence",
  planning_cadence_rules: "planning_cadence_rules",
  levels: "level_configuration",
  "level-configuration": "level_configuration",
  level_configuration: "level_configuration",
  additional: "additional_configuration",
  "additional-configuration": "additional_configuration",
  additional_configuration: "additional_configuration",
};

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeConfigKey(key: string): string {
  const normalizedInput = key.trim().toLowerCase();
  return (
    CONFIG_KEY_ALIAS[normalizedInput] || normalizedInput.replace(/-/g, "_")
  );
}

function inferValueType(value: unknown): string {
  if (typeof value === "boolean") return "BOOLEAN";
  if (typeof value === "number")
    return Number.isInteger(value) ? "INTEGER" : "NUMBER";
  if (typeof value === "string") return "STRING";
  if (Array.isArray(value)) return "ARRAY";
  return "OBJECT";
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  return fallback;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const candidate = Number(value);
  if (Number.isFinite(candidate) && candidate > 0) {
    return Math.floor(candidate);
  }
  return fallback;
}

function toPercentage(value: unknown, fallback: number): number {
  const candidate = Number(value);
  if (Number.isFinite(candidate) && candidate >= 0 && candidate <= 100) {
    return candidate;
  }
  return fallback;
}

function toCode(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function toTitleCase(input: string): string {
  return String(input || "")
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeStatusDefinitions(value: unknown) {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.statuses)
      ? value.statuses
      : [];

  const dedupe = new Set<string>();

  return list
    .map((item, index) => {
      if (!isRecord(item)) return null;

      const entityType = String(
        item.entity_type || item.entityType || "COMPANY_OBJECTIVE",
      )
        .trim()
        .toUpperCase();

      const displayNameRaw = String(
        item.display_name || item.display || item.name || "",
      ).trim();
      const statusCodeRaw = String(item.status_code || item.code || "").trim();

      const normalizedCode = toCode(statusCodeRaw || displayNameRaw);
      if (!normalizedCode) return null;

      const displayName = displayNameRaw
        ? toTitleCase(displayNameRaw)
        : toTitleCase(normalizedCode);

      const key = `${entityType}::${normalizedCode}`;
      if (dedupe.has(key)) return null;
      dedupe.add(key);

      return {
        id: item.id ? String(item.id) : undefined,
        entity_type: entityType,
        status_code: normalizedCode,
        display_name: displayName,
        is_initial: toBoolean(item.is_initial, false),
        is_terminal: toBoolean(item.is_terminal, false),
        sort_order: toPositiveInt(item.sort_order, index + 1),
        is_active: toBoolean(item.is_active, true),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function normalizeStatusTransitions(value: unknown) {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.transitions)
      ? value.transitions
      : [];

  const dedupe = new Set<string>();

  return list
    .map((item) => {
      if (!isRecord(item)) return null;

      const entityType = String(
        item.entity_type || item.entityType || "COMPANY_OBJECTIVE",
      )
        .trim()
        .toUpperCase();

      const fromStatusCode = toCode(
        String(item.from_status_code || item.from || ""),
      );
      const toStatusCode = toCode(String(item.to_status_code || item.to || ""));

      if (!fromStatusCode || !toStatusCode || fromStatusCode === toStatusCode) {
        return null;
      }

      const key = `${entityType}::${fromStatusCode}::${toStatusCode}`;
      if (dedupe.has(key)) return null;
      dedupe.add(key);

      return {
        id: item.id ? String(item.id) : undefined,
        entity_type: entityType,
        from_status_code: fromStatusCode,
        to_status_code: toStatusCode,
        requires_approval: toBoolean(item.requires_approval, false),
        required_role: String(item.required_role || "")
          .trim()
          .toUpperCase(),
        is_active: toBoolean(item.is_active, true),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function normalizePlanningApproach(value: unknown) {
  const defaultValue = DEFAULT_MENU_CONFIGURATION.planning_approach;

  if (!isRecord(value)) {
    return defaultValue;
  }

  const optionsRaw = Array.isArray(value.options)
    ? value.options
    : defaultValue.options;
  const options = optionsRaw
    .map((item) => String(item || "").toUpperCase())
    .filter(
      (item) => item === "TOP_DOWN" || item === "BOTTOM_UP",
    ) as PlanningApproach[];

  const normalizedOptions =
    options.length > 0 ? Array.from(new Set(options)) : defaultValue.options;
  const selectedCandidate = String(
    value.selected || defaultValue.selected,
  ).toUpperCase();
  const selected = (
    selectedCandidate === "TOP_DOWN" || selectedCandidate === "BOTTOM_UP"
      ? selectedCandidate
      : defaultValue.selected
  ) as PlanningApproach;

  if (!normalizedOptions.includes(selected)) {
    normalizedOptions.push(selected);
  }

  return {
    options: normalizedOptions,
    selected,
  };
}

function resolveCadence(
  value: unknown,
  fallback: PlanningCadenceConfig,
): PlanningCadenceConfig {
  const candidate = String(value || "").toUpperCase();
  if (
    candidate === "MONTHLY" ||
    candidate === "WEEKLY" ||
    candidate === "DAILY"
  ) {
    return candidate;
  }
  return fallback;
}

function buildCadenceRules(
  activeCadence: PlanningCadenceConfig,
): PlanningCadenceRules {
  const rules = DEFAULT_MENU_CONFIGURATION.planning_cadence_rules.rules;
  return {
    active_cadence: activeCadence,
    rules,
  };
}

function normalizePlanningCadenceRules(value: unknown): PlanningCadenceRules {
  if (!isRecord(value)) {
    if (typeof value === "string") {
      return buildCadenceRules(resolveCadence(value, "MONTHLY"));
    }
    return DEFAULT_MENU_CONFIGURATION.planning_cadence_rules;
  }

  const activeCadence = resolveCadence(
    value.active_cadence ?? value.cadence,
    DEFAULT_MENU_CONFIGURATION.planning_cadence_rules.active_cadence,
  );

  return buildCadenceRules(activeCadence);
}

function normalizeLevelConfiguration(value: unknown): LevelConfiguration {
  const defaults = DEFAULT_MENU_CONFIGURATION.level_configuration;

  if (!isRecord(value)) {
    return defaults;
  }

  const normalizeLevel = (
    levelValue: unknown,
    defaultLevel: CadenceRuleSet,
  ): CadenceRuleSet => {
    if (!isRecord(levelValue)) {
      return defaultLevel;
    }

    return {
      allow_monthly: toBoolean(
        levelValue.allow_monthly,
        defaultLevel.allow_monthly,
      ),
      allow_weekly: toBoolean(
        levelValue.allow_weekly,
        defaultLevel.allow_weekly,
      ),
      allow_daily: toBoolean(levelValue.allow_daily, defaultLevel.allow_daily),
    };
  };

  return {
    CEO: normalizeLevel(value.CEO, defaults.CEO),
    DIRECTOR: normalizeLevel(value.DIRECTOR, defaults.DIRECTOR),
    MANAGER_TEAM_LEADER: normalizeLevel(
      value.MANAGER_TEAM_LEADER,
      defaults.MANAGER_TEAM_LEADER,
    ),
    EMPLOYEE: normalizeLevel(value.EMPLOYEE, defaults.EMPLOYEE),
  };
}

function normalizeMetricConfiguration(value: unknown): MetricConfiguration {
  const defaults = DEFAULT_MENU_CONFIGURATION.metric_configuration;

  if (!isRecord(value)) {
    return defaults;
  }

  const allowedMetricDefinitionIds = Array.isArray(
    value.allowed_metric_definition_ids,
  )
    ? Array.from(
        new Set(
          value.allowed_metric_definition_ids
            .map((item: unknown) => Number(item))
            .filter((item: number) => Number.isInteger(item) && item > 0),
        ),
      )
    : defaults.allowed_metric_definition_ids;

  return {
    allowed_metric_definition_ids: allowedMetricDefinitionIds,
    allow_financial_metrics: toBoolean(
      value.allow_financial_metrics,
      defaults.allow_financial_metrics,
    ),
    allow_non_financial_metrics: toBoolean(
      value.allow_non_financial_metrics,
      defaults.allow_non_financial_metrics,
    ),
  };
}

function normalizeAdditionalConfiguration(
  value: unknown,
): AdditionalConfiguration {
  const defaults = DEFAULT_MENU_CONFIGURATION.additional_configuration;

  if (!isRecord(value)) {
    return defaults;
  }

  const lateRaw = isRecord(value.allowed_late_time)
    ? value.allowed_late_time
    : {};
  const late = {
    annual_plan_minutes: toPositiveInt(
      lateRaw.annual_plan_minutes,
      defaults.allowed_late_time.annual_plan_minutes,
    ),
    quarterly_plan_minutes: toPositiveInt(
      lateRaw.quarterly_plan_minutes,
      defaults.allowed_late_time.quarterly_plan_minutes,
    ),
    monthly_plan_minutes: toPositiveInt(
      lateRaw.monthly_plan_minutes,
      defaults.allowed_late_time.monthly_plan_minutes,
    ),
    weekly_plan_minutes: toPositiveInt(
      lateRaw.weekly_plan_minutes,
      defaults.allowed_late_time.weekly_plan_minutes,
    ),
    daily_plan_minutes: toPositiveInt(
      lateRaw.daily_plan_minutes,
      defaults.allowed_late_time.daily_plan_minutes,
    ),
    progress_update_minutes: toPositiveInt(
      lateRaw.progress_update_minutes,
      defaults.allowed_late_time.progress_update_minutes,
    ),
  };

  const confidenceRaw = isRecord(value.confidence_level_mapping)
    ? value.confidence_level_mapping
    : {};

  const confidence = {
    off_track_lte_percent: toPercentage(
      confidenceRaw.off_track_lte_percent,
      defaults.confidence_level_mapping.off_track_lte_percent,
    ),
    on_track_gte_percent: toPercentage(
      confidenceRaw.on_track_gte_percent,
      defaults.confidence_level_mapping.on_track_gte_percent,
    ),
    at_risk_lte_percent: toPercentage(
      confidenceRaw.at_risk_lte_percent,
      defaults.confidence_level_mapping.at_risk_lte_percent,
    ),
  };

  const objectivesRaw = isRecord(value.allowed_objectives)
    ? value.allowed_objectives
    : {};
  const krsRaw = isRecord(value.allowed_krs) ? value.allowed_krs : {};

  const allowedObjectives = {
    min: toPositiveInt(objectivesRaw.min, defaults.allowed_objectives.min),
    max: toPositiveInt(objectivesRaw.max, defaults.allowed_objectives.max),
  };

  const allowedKrs = {
    min: toPositiveInt(krsRaw.min, defaults.allowed_krs.min),
    max: toPositiveInt(krsRaw.max, defaults.allowed_krs.max),
  };

  if (allowedObjectives.min > allowedObjectives.max) {
    throw new Error(
      "allowed_objectives.min cannot be greater than allowed_objectives.max.",
    );
  }
  if (allowedKrs.min > allowedKrs.max) {
    throw new Error("allowed_krs.min cannot be greater than allowed_krs.max.");
  }

  return {
    allowed_late_time: late,
    confidence_level_mapping: confidence,
    allowed_objectives: allowedObjectives,
    allowed_krs: allowedKrs,
    auto_publish_on_approval: toBoolean(
      value.auto_publish_on_approval,
      defaults.auto_publish_on_approval,
    ),
  };
}

async function ensureGlobalProfile(companyId: number, actorId: string) {
  let profile = await prisma.okrConfigProfile.findFirst({
    where: {
      company_id: companyId,
      scope_type: "GLOBAL",
      is_active: true,
    },
    orderBy: { id: "asc" },
  });

  if (!profile) {
    profile = await prisma.okrConfigProfile.create({
      data: {
        company_id: companyId,
        name: "Default OKR Configuration",
        scope_type: "GLOBAL",
        description: "Global configuration profile for OKR module",
        is_active: true,
        created_by: actorId,
      },
    });
  }

  const existingAssignment = await prisma.okrConfigAssignment.findFirst({
    where: {
      company_id: companyId,
      config_profile_id: profile.id,
      cycle_id: null,
      department_id: null,
      role_code: null,
      is_active: true,
    },
    select: { id: true },
  });

  if (!existingAssignment) {
    await prisma.okrConfigAssignment.create({
      data: {
        company_id: companyId,
        config_profile_id: profile.id,
        priority: 0,
        is_active: true,
      },
    });
  }

  return profile;
}

async function createConfigValueByProfile(
  companyId: number,
  profileId: number,
  key: string,
  value: unknown,
) {
  return prisma.okrConfigValue.create({
    data: {
      company_id: companyId,
      config_profile_id: profileId,
      config_key: key,
      config_value_json: value as any,
      value_type: inferValueType(value),
    },
  });
}

async function upsertConfigValueByProfile(
  companyId: number,
  profileId: number,
  key: string,
  value: unknown,
) {
  return prisma.okrConfigValue.upsert({
    where: {
      config_profile_id_config_key: {
        config_profile_id: profileId,
        config_key: key,
      },
    },
    create: {
      company_id: companyId,
      config_profile_id: profileId,
      config_key: key,
      config_value_json: value as any,
      value_type: inferValueType(value),
    },
    update: {
      config_value_json: value as any,
      value_type: inferValueType(value),
    },
  });
}

async function applyDerivedSettings(
  companyId: number,
  profileId: number,
  key: string,
  value: unknown,
) {
  if (key === "planning_cadence_rules") {
    const normalized = normalizePlanningCadenceRules(value);
    const cadencePayload = { cadence: normalized.active_cadence };

    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "planning_cadence",
      cadencePayload,
    );
    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "enable_weekly_plans",
      normalized.active_cadence !== "MONTHLY",
    );
    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "enable_daily_plans",
      normalized.active_cadence === "DAILY",
    );
  }

  if (key === "additional_configuration") {
    const normalized = normalizeAdditionalConfiguration(value);

    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "min_company_objectives",
      normalized.allowed_objectives.min,
    );
    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "max_company_objectives",
      normalized.allowed_objectives.max,
    );
    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "min_krs_per_objective",
      normalized.allowed_krs.min,
    );
    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "max_krs_per_objective",
      normalized.allowed_krs.max,
    );
    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "allowed_late_time",
      normalized.allowed_late_time,
    );
    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "confidence_level_mapping",
      normalized.confidence_level_mapping,
    );
    await upsertConfigValueByProfile(
      companyId,
      profileId,
      "auto_publish_on_approval",
      { enabled: normalized.auto_publish_on_approval },
    );
  }
}

function normalizeByKey(key: string, value: unknown) {
  switch (key) {
    case "planning_approach":
      return normalizePlanningApproach(value);
    case "metric_configuration":
      return normalizeMetricConfiguration(value);
    case "planning_cadence":
      return { cadence: resolveCadence(value, "MONTHLY") };
    case "planning_cadence_rules":
      return normalizePlanningCadenceRules(value);
    case "level_configuration":
      return normalizeLevelConfiguration(value);
    case "additional_configuration":
      return normalizeAdditionalConfiguration(value);
    case "status_definitions":
      return normalizeStatusDefinitions(value);
    case "status_transitions":
      return normalizeStatusTransitions(value);
    case "min_company_objectives":
    case "max_company_objectives":
    case "min_krs_per_objective":
    case "max_krs_per_objective":
      return toPositiveInt(value, 2);
    default:
      return value;
  }
}

async function getValueOrDefault(companyId: number, key: string) {
  // Direct query bypasses the complex nested join in resolveConfigValue
  // which can silently return null when the profile/assignment exists.
  const row = await prisma.okrConfigValue.findFirst({
    where: {
      company_id: companyId,
      config_key: key,
      profile: { company_id: companyId, is_active: true },
    },
    orderBy: { id: "desc" },
  });
  if (row !== null && row !== undefined) {
    return row.config_value_json;
  }
  return null;
}

export async function getConfigurationMenu(
  companyId: number,
): Promise<OkrConfigurationMenu> {
  const planningApproachRaw = await getValueOrDefault(
    companyId,
    "planning_approach",
  );
  const metricConfigurationRaw = await getValueOrDefault(
    companyId,
    "metric_configuration",
  );
  const planningCadenceRulesRaw =
    (await getValueOrDefault(companyId, "planning_cadence_rules")) ||
    (await getValueOrDefault(companyId, "planning_cadence"));
  const levelConfigurationRaw = await getValueOrDefault(
    companyId,
    "level_configuration",
  );
  const additionalRaw = await getValueOrDefault(
    companyId,
    "additional_configuration",
  );

  const normalizedAdditional = normalizeAdditionalConfiguration(
    additionalRaw || DEFAULT_MENU_CONFIGURATION.additional_configuration,
  );

  const [minObjectives, maxObjectives, minKrs, maxKrs] = await Promise.all([
    getValueOrDefault(companyId, "min_company_objectives"),
    getValueOrDefault(companyId, "max_company_objectives"),
    getValueOrDefault(companyId, "min_krs_per_objective"),
    getValueOrDefault(companyId, "max_krs_per_objective"),
  ]);

  if (minObjectives !== null) {
    normalizedAdditional.allowed_objectives.min = toPositiveInt(
      minObjectives,
      normalizedAdditional.allowed_objectives.min,
    );
  }
  if (maxObjectives !== null) {
    normalizedAdditional.allowed_objectives.max = toPositiveInt(
      maxObjectives,
      normalizedAdditional.allowed_objectives.max,
    );
  }
  if (minKrs !== null) {
    normalizedAdditional.allowed_krs.min = toPositiveInt(
      minKrs,
      normalizedAdditional.allowed_krs.min,
    );
  }
  if (maxKrs !== null) {
    normalizedAdditional.allowed_krs.max = toPositiveInt(
      maxKrs,
      normalizedAdditional.allowed_krs.max,
    );
  }

  if (
    normalizedAdditional.allowed_objectives.min >
    normalizedAdditional.allowed_objectives.max
  ) {
    normalizedAdditional.allowed_objectives.max =
      normalizedAdditional.allowed_objectives.min;
  }
  if (
    normalizedAdditional.allowed_krs.min > normalizedAdditional.allowed_krs.max
  ) {
    normalizedAdditional.allowed_krs.max = normalizedAdditional.allowed_krs.min;
  }

  return {
    planning_approach: normalizePlanningApproach(
      planningApproachRaw || DEFAULT_MENU_CONFIGURATION.planning_approach,
    ),
    metric_configuration: normalizeMetricConfiguration(
      metricConfigurationRaw || DEFAULT_MENU_CONFIGURATION.metric_configuration,
    ),
    planning_cadence_rules: normalizePlanningCadenceRules(
      planningCadenceRulesRaw ||
        DEFAULT_MENU_CONFIGURATION.planning_cadence_rules,
    ),
    level_configuration: normalizeLevelConfiguration(
      levelConfigurationRaw || DEFAULT_MENU_CONFIGURATION.level_configuration,
    ),
    additional_configuration: normalizedAdditional,
  };
}

export async function listConfigurationValues(companyId: number) {
  const values = await prisma.okrConfigValue.findMany({
    where: {
      company_id: companyId,
      profile: {
        scope_type: "GLOBAL",
        is_active: true,
      },
    },
    orderBy: { config_key: "asc" },
    include: {
      profile: {
        select: {
          id: true,
          name: true,
          scope_type: true,
          is_active: true,
        },
      },
    },
  });

  const menu = await getConfigurationMenu(companyId);
  return { values, menu };
}

export async function getConfigurationByKey(
  companyId: number,
  keyInput: string,
) {
  const key = normalizeConfigKey(keyInput);
  const value = await getValueOrDefault(companyId, key);

  if (value === null || value === undefined) {
    switch (key) {
      case "planning_approach":
        return DEFAULT_MENU_CONFIGURATION.planning_approach;
      case "metric_configuration":
        return DEFAULT_MENU_CONFIGURATION.metric_configuration;
      case "planning_cadence_rules":
        return DEFAULT_MENU_CONFIGURATION.planning_cadence_rules;
      case "level_configuration":
        return DEFAULT_MENU_CONFIGURATION.level_configuration;
      case "additional_configuration":
        return DEFAULT_MENU_CONFIGURATION.additional_configuration;
      case "planning_cadence":
        return {
          cadence:
            DEFAULT_MENU_CONFIGURATION.planning_cadence_rules.active_cadence,
        };
      case "status_definitions":
      case "status_transitions":
        return [];
      default:
        return null;
    }
  }

  return normalizeByKey(key, value);
}

export async function createConfigurationByKey(
  companyId: number,
  actorId: string,
  keyInput: string,
  value: unknown,
) {
  const key = normalizeConfigKey(keyInput);
  const normalizedValue = normalizeByKey(key, value);
  const profile = await ensureGlobalProfile(companyId, actorId);

  const existing = await prisma.okrConfigValue.findUnique({
    where: {
      config_profile_id_config_key: {
        config_profile_id: profile.id,
        config_key: key,
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error(
      `Configuration key '${key}' already exists. Use PUT to update it.`,
    );
  }

  const created = await createConfigValueByProfile(
    companyId,
    profile.id,
    key,
    normalizedValue,
  );

  await applyDerivedSettings(companyId, profile.id, key, normalizedValue);

  return created;
}

export async function upsertConfigurationByKey(
  companyId: number,
  actorId: string,
  keyInput: string,
  value: unknown,
) {
  const key = normalizeConfigKey(keyInput);
  const normalizedValue = normalizeByKey(key, value);
  const profile = await ensureGlobalProfile(companyId, actorId);

  const upserted = await upsertConfigValueByProfile(
    companyId,
    profile.id,
    key,
    normalizedValue,
  );

  await applyDerivedSettings(companyId, profile.id, key, normalizedValue);

  return upserted;
}

export async function deleteConfigurationByKey(
  companyId: number,
  actorId: string,
  keyInput: string,
) {
  const key = normalizeConfigKey(keyInput);
  const profile = await ensureGlobalProfile(companyId, actorId);

  const existing = await prisma.okrConfigValue.findUnique({
    where: {
      config_profile_id_config_key: {
        config_profile_id: profile.id,
        config_key: key,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error(`Configuration key '${key}' not found.`);
  }

  await prisma.okrConfigValue.delete({ where: { id: existing.id } });

  return { deleted: true, key };
}

export async function upsertConfigurationMenu(
  companyId: number,
  actorId: string,
  payload: Partial<OkrConfigurationMenu>,
) {
  if (!isRecord(payload)) {
    throw new Error("Configuration payload must be an object.");
  }

  const profile = await ensureGlobalProfile(companyId, actorId);
  const current = await getConfigurationMenu(companyId);

  const nextMenu: OkrConfigurationMenu = {
    planning_approach: payload.planning_approach
      ? normalizePlanningApproach(payload.planning_approach)
      : current.planning_approach,
    metric_configuration: payload.metric_configuration
      ? normalizeMetricConfiguration(payload.metric_configuration)
      : current.metric_configuration,
    planning_cadence_rules: payload.planning_cadence_rules
      ? normalizePlanningCadenceRules(payload.planning_cadence_rules)
      : current.planning_cadence_rules,
    level_configuration: payload.level_configuration
      ? normalizeLevelConfiguration(payload.level_configuration)
      : current.level_configuration,
    additional_configuration: payload.additional_configuration
      ? normalizeAdditionalConfiguration(payload.additional_configuration)
      : current.additional_configuration,
  };

  await upsertConfigValueByProfile(
    companyId,
    profile.id,
    "planning_approach",
    nextMenu.planning_approach,
  );
  await upsertConfigValueByProfile(
    companyId,
    profile.id,
    "metric_configuration",
    nextMenu.metric_configuration,
  );
  await upsertConfigValueByProfile(
    companyId,
    profile.id,
    "planning_cadence_rules",
    nextMenu.planning_cadence_rules,
  );
  await upsertConfigValueByProfile(
    companyId,
    profile.id,
    "level_configuration",
    nextMenu.level_configuration,
  );
  await upsertConfigValueByProfile(
    companyId,
    profile.id,
    "additional_configuration",
    nextMenu.additional_configuration,
  );

  await applyDerivedSettings(
    companyId,
    profile.id,
    "planning_cadence_rules",
    nextMenu.planning_cadence_rules,
  );
  await applyDerivedSettings(
    companyId,
    profile.id,
    "additional_configuration",
    nextMenu.additional_configuration,
  );

  return nextMenu;
}
