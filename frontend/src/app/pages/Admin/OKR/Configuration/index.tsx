import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../../components/DefaultLayout/AdminLayout";
import PageHeader from "../../../../components/common/PageHeader";
import ModalLayout from "../components/ModalLayout";
import ApprovalFooter from "../components/ApprovalFooter";
import { okrFeatureFlags } from "../okrFeatureFlags";
import makeCall from "../../../../API";
import apiRoutes from "../../../../API/apiRoutes";
import ToastService from "../../../../../utils/ToastService";
import {
  MdAdd,
  MdDelete,
  MdEdit,
  MdSwapHoriz,
  MdSettings,
} from "react-icons/md";
import RefreshButton from "../../../../components/common/RefreshButton";
import FormAutocomplete from "../../../../components/Core/ui/FormAutocomplete";
import ConfirmationModal from "../../../../components/common/ConfirmationModal";
import Button from "../../../../components/Core/ui/Button";

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />
);

const ConfigurationSkeleton = () => (
  <div className="space-y-8">
    <div className="rounded-3xl bg-white p-8 shadow-sm space-y-6">
      <Skeleton className="h-8 w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
    <div className="rounded-3xl bg-white p-8 shadow-sm space-y-4">
      <Skeleton className="h-6 w-1/5" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  </div>
);

type Tab = "general" | "statuses" | "categories" | "metrics" | "profiles" | "feature_flags";


type PlanningApproach = "TOP_DOWN" | "BOTTOM_UP";
type PlanningCadence = "MONTHLY" | "WEEKLY" | "DAILY";
type LevelRole = "CEO" | "DIRECTOR" | "MANAGER_TEAM_LEADER" | "EMPLOYEE";
type ScopeType = "GLOBAL" | "ORGANIZATION" | "DEPARTMENT" | "ROLE" | "QUARTER";

type OkrMetricCategory =
  | "NUMERIC"
  | "PERCENTAGE"
  | "CURRENCY"
  | "MILESTONE"
  | "RATING"
  | "CUSTOM";

type OkrEntityType =
  | "COMPANY_OBJECTIVE"
  | "COMPANY_KR"
  | "DEPARTMENT_OBJECTIVE"
  | "DEPARTMENT_KR"
  | "EMPLOYEE_OBJECTIVE"
  | "EMPLOYEE_KR"
  | "WEEKLY_PLAN"
  | "SUBTASK"
  | "DAILY_PLAN"
  | "PROGRESS_UPDATE"
  | "CYCLE"
  | "ARCHIVE"
  | "EXPORT";

interface CadenceRuleSet {
  allow_monthly: boolean;
  allow_weekly: boolean;
  allow_daily: boolean;
}

interface OkrConfigurationMenu {
  planning_approach: {
    options: PlanningApproach[];
    selected: PlanningApproach;
  };
  metric_configuration: {
    allowed_metric_definition_ids: number[];
    allow_financial_metrics: boolean;
    allow_non_financial_metrics: boolean;
  };
  planning_cadence_rules: {
    active_cadence: PlanningCadence;
    rules: Record<PlanningCadence, CadenceRuleSet>;
  };
  level_configuration: Record<LevelRole, CadenceRuleSet>;
  additional_configuration: {
    allowed_late_time: {
      annual_plan_minutes: number;
      quarterly_plan_minutes: number;
      monthly_plan_minutes: number;
      weekly_plan_minutes: number;
      daily_plan_minutes: number;
      progress_update_minutes: number;
    };
    confidence_level_mapping: {
      off_track_lte_percent: number;
      on_track_gte_percent: number;
      at_risk_lte_percent: number;
    };
    allowed_objectives: {
      min: number;
      max: number;
    };
    allowed_krs: {
      min: number;
      max: number;
    };
    auto_publish_on_approval?: boolean;
  };
}

interface ConfigValueRecord {
  config_key: string;
}

interface MetricDefinition {
  id: number;
  code: string;
  name: string;
  category: OkrMetricCategory;
  category_code: string;
  category_label: string;
  unit_of_measure: string | null;
  is_financial: boolean;
  requires_target_value: boolean;
  allows_binary_completion: boolean;
  supports_value_rollup: boolean;
  value_based_progress: boolean;
  is_active: boolean;
}

interface MetricCategoryOption {
  id: number;
  code: string;
  name: string;
  behavior_type: OkrMetricCategory;
  description?: string | null;
  is_active: boolean;
}

interface StatusDefinition {
  id: string;
  entity_type: OkrEntityType;
  status_code: string;
  display_name: string;
  is_initial: boolean;
  is_terminal: boolean;
  sort_order: number;
  is_active: boolean;
}

interface StatusTransition {
  id: string;
  entity_type: OkrEntityType;
  from_status_code: string;
  to_status_code: string;
  requires_approval: boolean;
  required_role: string;
  is_active: boolean;
}

interface ProfileDraft {
  id: string;
  name: string;
  scope_type: ScopeType;
  description: string;
  assignment: string;
  access_level: string;
  sync_frequency: string;
  is_active: boolean;
}

interface FeatureFlagDraft {
  id: string;
  feature_name: string;
  scope_type: ScopeType;
  description: string;
  target_audience: string;
  impact_radius: string;
  is_enabled: boolean;
}

interface MetricCreateForm {
  id?: number;
  code: string;
  name: string;
  category_code: string;
  unit_of_measure: string;
  is_financial: boolean;
  requires_target_value: boolean;
  allows_binary_completion: boolean;
  value_based_progress: boolean;
}

interface MetricCategoryDraft {
  id?: number;
  name: string;
  code: string;
  behavior_type: OkrMetricCategory;
  description: string;
}

const ENTITY_TYPES: OkrEntityType[] = [
  "COMPANY_OBJECTIVE",
  "COMPANY_KR",
  "DEPARTMENT_OBJECTIVE",
  "DEPARTMENT_KR",
  "EMPLOYEE_OBJECTIVE",
  "EMPLOYEE_KR",
  "WEEKLY_PLAN",
  "SUBTASK",
  "DAILY_PLAN",
  "PROGRESS_UPDATE",
  "CYCLE",
  "ARCHIVE",
  "EXPORT",
];

const METRIC_BEHAVIOR_TYPES: OkrMetricCategory[] = [
  "NUMERIC",
  "PERCENTAGE",
  "CURRENCY",
  "MILESTONE",
  "RATING",
  "CUSTOM",
];

const SCOPE_OPTIONS: ScopeType[] = [
  "GLOBAL",
  "ORGANIZATION",
  "DEPARTMENT",
  "ROLE",
  "QUARTER",
];

const EMPTY_METRIC_FORM: MetricCreateForm = {
  code: "",
  name: "",
  category_code: "NUMERIC",
  unit_of_measure: "",
  is_financial: false,
  requires_target_value: true,
  allows_binary_completion: false,
  value_based_progress: false,
};

const EMPTY_METRIC_CATEGORY_DRAFT: MetricCategoryDraft = {
  name: "",
  code: "",
  behavior_type: "CUSTOM",
  description: "",
};

const CONFIG_KEYS = {
  menu: "okr_configuration_menu",
  statuses: "okr_status_definitions",
  transitions: "okr_status_transitions",
  profiles: "okr_profile_definitions",
  featureFlags: "okr_feature_flags",
} as const;

const ROLE_OPTIONS = [
  "",
  "CEO",
  "Admin",
  "HR",
  "Manager",
  "Employee",
  "Super Admin",
];

function createDefaultMenu(): OkrConfigurationMenu {
  return {
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
        MONTHLY: {
          allow_monthly: true,
          allow_weekly: false,
          allow_daily: false,
        },
        WEEKLY: {
          allow_monthly: true,
          allow_weekly: true,
          allow_daily: false,
        },
        DAILY: {
          allow_monthly: true,
          allow_weekly: true,
          allow_daily: true,
        },
      },
    },
    level_configuration: {
      CEO: { allow_monthly: true, allow_weekly: true, allow_daily: true },
      DIRECTOR: {
        allow_monthly: true,
        allow_weekly: true,
        allow_daily: true,
      },
      MANAGER_TEAM_LEADER: {
        allow_monthly: true,
        allow_weekly: true,
        allow_daily: true,
      },
      EMPLOYEE: {
        allow_monthly: true,
        allow_weekly: true,
        allow_daily: true,
      },
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function asPositiveInt(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric);
  }
  return fallback;
}

function asPercent(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 100) {
    return numeric;
  }
  return fallback;
}

function normalizeCadence(
  value: unknown,
  fallback: PlanningCadence,
): PlanningCadence {
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

function createClientId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 9)}`;
}

function titleize(input: string): string {
  return input
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function toCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

function toPascalWords(input: string): string {
  return titleize(String(input || "").replace(/[_-]+/g, " "));
}

function extractPayload<T>(response: unknown): T {
  if (!isRecord(response)) return response as T;
  const data = response.data;
  if (isRecord(data) && "data" in data) {
    return data.data as T;
  }
  return data as T;
}

function extractMessage(error: unknown, fallback: string): string {
  if (!isRecord(error)) return fallback;

  const message = error.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  const responseData = error.data;
  if (isRecord(responseData)) {
    const nested = responseData.message;
    if (typeof nested === "string" && nested.trim()) {
      return nested;
    }
  }

  return fallback;
}

function isNotFoundError(error: unknown): boolean {
  const message = extractMessage(error, "").toLowerCase();
  return message.includes("not found");
}

function normalizeMenu(raw: unknown): OkrConfigurationMenu {
  const defaults = createDefaultMenu();
  if (!isRecord(raw)) return defaults;

  const planningRaw = isRecord(raw.planning_approach)
    ? raw.planning_approach
    : defaults.planning_approach;

  const approachOptions = Array.isArray(planningRaw.options)
    ? planningRaw.options
      .map((item) => String(item || "").toUpperCase())
      .filter(
        (item): item is PlanningApproach =>
          item === "TOP_DOWN" || item === "BOTTOM_UP",
      )
    : defaults.planning_approach.options;

  const selectedCandidate = String(
    planningRaw.selected || defaults.planning_approach.selected,
  ).toUpperCase();
  const selected =
    selectedCandidate === "TOP_DOWN" || selectedCandidate === "BOTTOM_UP"
      ? selectedCandidate
      : defaults.planning_approach.selected;

  const metricRaw = isRecord(raw.metric_configuration)
    ? raw.metric_configuration
    : defaults.metric_configuration;

  const cadenceRaw = isRecord(raw.planning_cadence_rules)
    ? raw.planning_cadence_rules
    : defaults.planning_cadence_rules;
  const activeCadence = normalizeCadence(
    cadenceRaw.active_cadence,
    defaults.planning_cadence_rules.active_cadence,
  );

  const levelRaw = isRecord(raw.level_configuration)
    ? raw.level_configuration
    : defaults.level_configuration;

  const additionalRaw = isRecord(raw.additional_configuration)
    ? raw.additional_configuration
    : defaults.additional_configuration;

  const allowedLateTimeRaw = isRecord(additionalRaw.allowed_late_time)
    ? additionalRaw.allowed_late_time
    : defaults.additional_configuration.allowed_late_time;
  const confidenceRaw = isRecord(additionalRaw.confidence_level_mapping)
    ? additionalRaw.confidence_level_mapping
    : defaults.additional_configuration.confidence_level_mapping;
  const objectivesRaw = isRecord(additionalRaw.allowed_objectives)
    ? additionalRaw.allowed_objectives
    : defaults.additional_configuration.allowed_objectives;
  const krsRaw = isRecord(additionalRaw.allowed_krs)
    ? additionalRaw.allowed_krs
    : defaults.additional_configuration.allowed_krs;

  return {
    planning_approach: {
      options: approachOptions.length
        ? Array.from(new Set(approachOptions))
        : defaults.planning_approach.options,
      selected,
    },
    metric_configuration: {
      allowed_metric_definition_ids: Array.isArray(
        metricRaw.allowed_metric_definition_ids,
      )
        ? Array.from(
          new Set(
            metricRaw.allowed_metric_definition_ids
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0),
          ),
        )
        : defaults.metric_configuration.allowed_metric_definition_ids,
      allow_financial_metrics: asBoolean(
        metricRaw.allow_financial_metrics,
        defaults.metric_configuration.allow_financial_metrics,
      ),
      allow_non_financial_metrics: asBoolean(
        metricRaw.allow_non_financial_metrics,
        defaults.metric_configuration.allow_non_financial_metrics,
      ),
    },
    planning_cadence_rules: {
      active_cadence: activeCadence,
      rules: defaults.planning_cadence_rules.rules,
    },
    level_configuration: {
      CEO: {
        allow_monthly: asBoolean(
          isRecord(levelRaw.CEO) ? levelRaw.CEO.allow_monthly : undefined,
          defaults.level_configuration.CEO.allow_monthly,
        ),
        allow_weekly: asBoolean(
          isRecord(levelRaw.CEO) ? levelRaw.CEO.allow_weekly : undefined,
          defaults.level_configuration.CEO.allow_weekly,
        ),
        allow_daily: asBoolean(
          isRecord(levelRaw.CEO) ? levelRaw.CEO.allow_daily : undefined,
          defaults.level_configuration.CEO.allow_daily,
        ),
      },
      DIRECTOR: {
        allow_monthly: asBoolean(
          isRecord(levelRaw.DIRECTOR)
            ? levelRaw.DIRECTOR.allow_monthly
            : undefined,
          defaults.level_configuration.DIRECTOR.allow_monthly,
        ),
        allow_weekly: asBoolean(
          isRecord(levelRaw.DIRECTOR)
            ? levelRaw.DIRECTOR.allow_weekly
            : undefined,
          defaults.level_configuration.DIRECTOR.allow_weekly,
        ),
        allow_daily: asBoolean(
          isRecord(levelRaw.DIRECTOR)
            ? levelRaw.DIRECTOR.allow_daily
            : undefined,
          defaults.level_configuration.DIRECTOR.allow_daily,
        ),
      },
      MANAGER_TEAM_LEADER: {
        allow_monthly: asBoolean(
          isRecord(levelRaw.MANAGER_TEAM_LEADER)
            ? levelRaw.MANAGER_TEAM_LEADER.allow_monthly
            : undefined,
          defaults.level_configuration.MANAGER_TEAM_LEADER.allow_monthly,
        ),
        allow_weekly: asBoolean(
          isRecord(levelRaw.MANAGER_TEAM_LEADER)
            ? levelRaw.MANAGER_TEAM_LEADER.allow_weekly
            : undefined,
          defaults.level_configuration.MANAGER_TEAM_LEADER.allow_weekly,
        ),
        allow_daily: asBoolean(
          isRecord(levelRaw.MANAGER_TEAM_LEADER)
            ? levelRaw.MANAGER_TEAM_LEADER.allow_daily
            : undefined,
          defaults.level_configuration.MANAGER_TEAM_LEADER.allow_daily,
        ),
      },
      EMPLOYEE: {
        allow_monthly: asBoolean(
          isRecord(levelRaw.EMPLOYEE)
            ? levelRaw.EMPLOYEE.allow_monthly
            : undefined,
          defaults.level_configuration.EMPLOYEE.allow_monthly,
        ),
        allow_weekly: asBoolean(
          isRecord(levelRaw.EMPLOYEE)
            ? levelRaw.EMPLOYEE.allow_weekly
            : undefined,
          defaults.level_configuration.EMPLOYEE.allow_weekly,
        ),
        allow_daily: asBoolean(
          isRecord(levelRaw.EMPLOYEE)
            ? levelRaw.EMPLOYEE.allow_daily
            : undefined,
          defaults.level_configuration.EMPLOYEE.allow_daily,
        ),
      },
    },
    additional_configuration: {
      allowed_late_time: {
        annual_plan_minutes: asPositiveInt(
          allowedLateTimeRaw.annual_plan_minutes,
          defaults.additional_configuration.allowed_late_time
            .annual_plan_minutes,
        ),
        quarterly_plan_minutes: asPositiveInt(
          allowedLateTimeRaw.quarterly_plan_minutes,
          defaults.additional_configuration.allowed_late_time
            .quarterly_plan_minutes,
        ),
        monthly_plan_minutes: asPositiveInt(
          allowedLateTimeRaw.monthly_plan_minutes,
          defaults.additional_configuration.allowed_late_time
            .monthly_plan_minutes,
        ),
        weekly_plan_minutes: asPositiveInt(
          allowedLateTimeRaw.weekly_plan_minutes,
          defaults.additional_configuration.allowed_late_time
            .weekly_plan_minutes,
        ),
        daily_plan_minutes: asPositiveInt(
          allowedLateTimeRaw.daily_plan_minutes,
          defaults.additional_configuration.allowed_late_time
            .daily_plan_minutes,
        ),
        progress_update_minutes: asPositiveInt(
          allowedLateTimeRaw.progress_update_minutes,
          defaults.additional_configuration.allowed_late_time
            .progress_update_minutes,
        ),
      },
      confidence_level_mapping: {
        off_track_lte_percent: asPercent(
          confidenceRaw.off_track_lte_percent,
          defaults.additional_configuration.confidence_level_mapping
            .off_track_lte_percent,
        ),
        on_track_gte_percent: asPercent(
          confidenceRaw.on_track_gte_percent,
          defaults.additional_configuration.confidence_level_mapping
            .on_track_gte_percent,
        ),
        at_risk_lte_percent: asPercent(
          confidenceRaw.at_risk_lte_percent,
          defaults.additional_configuration.confidence_level_mapping
            .at_risk_lte_percent,
        ),
      },
      allowed_objectives: {
        min: asPositiveInt(
          objectivesRaw.min,
          defaults.additional_configuration.allowed_objectives.min,
        ),
        max: asPositiveInt(
          objectivesRaw.max,
          defaults.additional_configuration.allowed_objectives.max,
        ),
      },
      allowed_krs: {
        min: asPositiveInt(
          krsRaw.min,
          defaults.additional_configuration.allowed_krs.min,
        ),
        max: asPositiveInt(
          krsRaw.max,
          defaults.additional_configuration.allowed_krs.max,
        ),
      },
      auto_publish_on_approval: asBoolean(
        additionalRaw.auto_publish_on_approval,
        false,
      ),
    },
  };
}

function normalizeMetricList(raw: unknown): MetricDefinition[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => {
      if (!isRecord(item)) return null;
      const categoryCandidate = String(item.category || "CUSTOM").toUpperCase();
      const category = METRIC_BEHAVIOR_TYPES.includes(
        categoryCandidate as OkrMetricCategory,
      )
        ? (categoryCandidate as OkrMetricCategory)
        : "CUSTOM";

      const categoryLabel = String(
        item.category_label || item.categoryLabel || titleize(category),
      ).trim();
      const categoryCode = toCode(
        String(item.category_code || item.categoryCode || categoryLabel),
      );

      return {
        id: Number(item.id || 0),
        code: String(item.code || ""),
        name: String(item.name || ""),
        category,
        category_code: categoryCode || category,
        category_label: categoryLabel,
        unit_of_measure:
          item.unit_of_measure === null || item.unit_of_measure === undefined
            ? null
            : String(item.unit_of_measure),
        is_financial: asBoolean(item.is_financial, false),
        requires_target_value: asBoolean(item.requires_target_value, true),
        allows_binary_completion: asBoolean(
          item.allows_binary_completion,
          false,
        ),
        supports_value_rollup: asBoolean(item.supports_value_rollup, true),
        value_based_progress: asBoolean(item.value_based_progress, false),
        is_active: asBoolean(item.is_active, true),
      };
    })
    .filter((item): item is MetricDefinition => item !== null && item.id > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeStatuses(raw: unknown): StatusDefinition[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.statuses)
      ? raw.statuses
      : [];

  return list
    .map((item, index) => {
      if (!isRecord(item)) return null;

      const entity = String(
        item.entity_type || item.entityType || "COMPANY_OBJECTIVE",
      ).toUpperCase();
      const entityType = ENTITY_TYPES.includes(entity as OkrEntityType)
        ? (entity as OkrEntityType)
        : "COMPANY_OBJECTIVE";

      const code = toCode(String(item.status_code || item.code || ""));
      const displayName = String(
        item.display_name || item.display || toPascalWords(code || "status"),
      ).trim();

      return {
        id: String(item.id || createClientId()),
        entity_type: entityType,
        status_code: code,
        display_name: displayName,
        is_initial: asBoolean(item.is_initial, false),
        is_terminal: asBoolean(item.is_terminal, false),
        sort_order: asPositiveInt(item.sort_order, index + 1),
        is_active: asBoolean(item.is_active, true),
      };
    })
    .filter(
      (item): item is StatusDefinition =>
        item !== null && Boolean(item.status_code),
    );
}

function normalizeTransitions(raw: unknown): StatusTransition[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.transitions)
      ? raw.transitions
      : [];

  return list
    .map((item) => {
      if (!isRecord(item)) return null;

      const entity = String(
        item.entity_type || item.entityType || "COMPANY_OBJECTIVE",
      ).toUpperCase();
      const entityType = ENTITY_TYPES.includes(entity as OkrEntityType)
        ? (entity as OkrEntityType)
        : "COMPANY_OBJECTIVE";

      const from = toCode(String(item.from_status_code || item.from || ""));
      const to = toCode(String(item.to_status_code || item.to || ""));
      if (!from || !to) return null;

      return {
        id: String(item.id || createClientId()),
        entity_type: entityType,
        from_status_code: from,
        to_status_code: to,
        requires_approval: asBoolean(item.requires_approval, false),
        required_role: String(item.required_role || "").toUpperCase(),
        is_active: asBoolean(item.is_active, true),
      };
    })
    .filter((item): item is StatusTransition => item !== null);
}

function normalizeProfiles(raw: unknown): ProfileDraft[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.profiles)
      ? raw.profiles
      : [];

  return list
    .map((item) => {
      if (!isRecord(item)) return null;
      const scopeValue = String(item.scope_type || "GLOBAL").toUpperCase();
      const scope = SCOPE_OPTIONS.includes(scopeValue as ScopeType)
        ? (scopeValue as ScopeType)
        : "GLOBAL";

      return {
        id: String(item.id || createClientId()),
        name: String(item.name || "").trim(),
        scope_type: scope,
        description: String(item.description || "").trim(),
        assignment: String(item.assignment || "").trim(),
        access_level: String(item.access_level || "").trim(),
        sync_frequency: String(item.sync_frequency || "").trim(),
        is_active: asBoolean(item.is_active, true),
      };
    })
    .filter(
      (item): item is ProfileDraft => item !== null && Boolean(item.name),
    );
}

function normalizeFeatureFlags(raw: unknown): FeatureFlagDraft[] {
  const list = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.flags)
      ? raw.flags
      : [];

  return list
    .map((item) => {
      if (!isRecord(item)) return null;
      const scopeValue = String(item.scope_type || "GLOBAL").toUpperCase();
      const scope = SCOPE_OPTIONS.includes(scopeValue as ScopeType)
        ? (scopeValue as ScopeType)
        : "GLOBAL";

      return {
        id: String(item.id || createClientId()),
        feature_name: String(item.feature_name || item.name || "").trim(),
        scope_type: scope,
        description: String(item.description || "").trim(),
        target_audience: String(item.target_audience || "").trim(),
        impact_radius: String(item.impact_radius || "").trim(),
        is_enabled: asBoolean(item.is_enabled, false),
      };
    })
    .filter(
      (item): item is FeatureFlagDraft =>
        item !== null && Boolean(item.feature_name),
    );
}

function isCollectionEmpty(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

const TABS: { id: Tab; label: string; isPreview?: boolean }[] = [
  { id: "general", label: "General" },
  { id: "categories", label: "Metric Categories" },
  { id: "metrics", label: "Metrics" },
  { id: "statuses", label: "Statuses", isPreview: true },
  // { id: "profiles", label: "Profiles", isPreview: true },
  // { id: "feature_flags", label: "Feature Flags", isPreview: true },
];

export default function Configuration() {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [tab, setTab] = useState<Tab>("general");

  const [menuDraft, setMenuDraft] =
    useState<OkrConfigurationMenu>(createDefaultMenu());
  const [originalMenu, setOriginalMenu] =
    useState<OkrConfigurationMenu>(createDefaultMenu());
  const [existingConfigKeys, setExistingConfigKeys] = useState<string[]>([]);

  const isMenuDirty = useMemo(
    () => JSON.stringify(menuDraft) !== JSON.stringify(originalMenu),
    [menuDraft, originalMenu],
  );

  const [refreshingTab, setRefreshingTab] = useState(false);

  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [metricCategories, setMetricCategories] = useState<
    MetricCategoryOption[]
  >([]);
  const [metricModalOpen, setMetricModalOpen] = useState(false);
  const [metricForm, setMetricForm] =
    useState<MetricCreateForm>(EMPTY_METRIC_FORM);
  const [metricCategoryDraft, setMetricCategoryDraft] =
    useState<MetricCategoryDraft>(EMPTY_METRIC_CATEGORY_DRAFT);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );
  const [savingMetric, setSavingMetric] = useState(false);
  const [editingMetricId, setEditingMetricId] = useState<number | null>(null);
  const [deletingMetricId, setDeletingMetricId] = useState<number | null>(null);
  const [metricToDelete, setMetricToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [savingCategoryId, setSavingCategoryId] = useState<number | null>(null);

  const [statuses, setStatuses] = useState<StatusDefinition[]>([]);
  const [transitions, setTransitions] = useState<StatusTransition[]>([]);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusDraft, setStatusDraft] = useState<StatusDefinition>({
    id: "",
    entity_type: "COMPANY_OBJECTIVE",
    status_code: "",
    display_name: "",
    is_initial: false,
    is_terminal: false,
    sort_order: 1,
    is_active: true,
  });

  const [showTransitionsEditor, setShowTransitionsEditor] = useState(false);
  const [newTransition, setNewTransition] = useState<StatusTransition>({
    id: "",
    entity_type: "COMPANY_OBJECTIVE",
    from_status_code: "",
    to_status_code: "",
    requires_approval: false,
    required_role: "",
    is_active: true,
  });

  const [profiles, setProfiles] = useState<ProfileDraft[]>([]);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    id: "",
    name: "",
    scope_type: "GLOBAL",
    description: "",
    assignment: "",
    access_level: "",
    sync_frequency: "",
    is_active: true,
  });

  const [featureFlags, setFeatureFlags] = useState<FeatureFlagDraft[]>([]);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [flagDraft, setFlagDraft] = useState<FeatureFlagDraft>({
    id: "",
    feature_name: "",
    scope_type: "GLOBAL",
    description: "",
    target_audience: "",
    impact_radius: "",
    is_enabled: false,
  });

  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingStatuses, setSavingStatuses] = useState(false);
  const [savingMetricRules, setSavingMetricRules] = useState(false);

  const [savingProfiles, setSavingProfiles] = useState(false);
  const [savingFlags, setSavingFlags] = useState(false);

  const configKeySet = useMemo(
    () => new Set(existingConfigKeys),
    [existingConfigKeys],
  );

  const statusCodesForTransition = useMemo(() => {
    const pool = statuses
      .filter((item) => item.entity_type === newTransition.entity_type)
      .map((item) => item.status_code)
      .filter(Boolean);
    return Array.from(new Set(pool));
  }, [newTransition.entity_type, statuses]);

  const fetchSummary = useCallback(async () => {
    const response = await makeCall({
      method: "GET",
      route: apiRoutes.okr.configurations,
      isSecureRoute: true,
    });

    const payload = extractPayload<{
      values?: ConfigValueRecord[];
      menu?: unknown;
    }>(response);
    const values = Array.isArray(payload?.values) ? payload.values : [];
    const keys = values
      .map((row) => String(row.config_key || "").trim())
      .filter(Boolean);

    setExistingConfigKeys(keys);

    if (payload?.menu) {
      const normalized = normalizeMenu(payload.menu);
      setMenuDraft(normalized);
      setOriginalMenu(normalized);
    }
  }, []);

  const fetchMenu = useCallback(async () => {
    const response = await makeCall({
      method: "GET",
      route: apiRoutes.okr.configurationMenu,
      isSecureRoute: true,
    });

    const menu = extractPayload<unknown>(response);
    const normalized = normalizeMenu(menu);
    setMenuDraft(normalized);
    setOriginalMenu(normalized);
  }, []);

  const fetchByKey = useCallback(
    async (key: string): Promise<unknown | null> => {
      try {
        const response = await makeCall({
          method: "GET",
          route: apiRoutes.okr.configurationByKey(key),
          isSecureRoute: true,
        });
        return extractPayload<unknown>(response);
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },
    [],
  );

  const saveConfigKey = useCallback(
    async (key: string, value: unknown, deleteWhenEmpty = false) => {
      if (deleteWhenEmpty && isCollectionEmpty(value)) {
        if (!configKeySet.has(key)) return;
        await makeCall({
          method: "DELETE",
          route: apiRoutes.okr.configurationByKey(key),
          isSecureRoute: true,
        });
        setExistingConfigKeys((prev) => prev.filter((item) => item !== key));
        return;
      }

      const method = configKeySet.has(key) ? "PUT" : "POST";
      await makeCall({
        method,
        route: apiRoutes.okr.configurationByKey(key),
        body: { value },
        isSecureRoute: true,
      });

      if (!configKeySet.has(key)) {
        setExistingConfigKeys((prev) => Array.from(new Set([...prev, key])));
      }
    },
    [configKeySet],
  );

  const loadMetricCategories = useCallback(async () => {
    const response = await makeCall({
      method: "GET",
      route: apiRoutes.okr.metricCategories,
      isSecureRoute: true,
    });

    const payload = extractPayload<unknown>(response);
    const list = Array.isArray(payload) ? payload : [];

    const normalized = list
      .map((item) => {
        if (!isRecord(item)) return null;
        const behaviorCandidate = String(
          item.behavior_type || item.behaviorType || "CUSTOM",
        ).toUpperCase();
        const behavior = METRIC_BEHAVIOR_TYPES.includes(
          behaviorCandidate as OkrMetricCategory,
        )
          ? (behaviorCandidate as OkrMetricCategory)
          : "CUSTOM";

        return {
          id: Number(item.id || 0),
          code: toCode(String(item.code || "")),
          name: String(item.name || "").trim(),
          behavior_type: behavior,
          description:
            item.description === null || item.description === undefined
              ? null
              : String(item.description),
          is_active: asBoolean(item.is_active, true),
        } as MetricCategoryOption;
      })
      .filter(
        (item): item is MetricCategoryOption =>
          item !== null && item.id > 0 && Boolean(item.name),
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    setMetricCategories(normalized);
  }, []);

  const loadMetrics = useCallback(async () => {
    const response = await makeCall({
      method: "GET",
      route: apiRoutes.okr.metrics,
      isSecureRoute: true,
    });
    const payload = extractPayload<unknown>(response);
    setMetrics(normalizeMetricList(payload));
  }, []);

  const loadMetricWorkspace = useCallback(async () => {
    await Promise.all([loadMetrics(), loadMetricCategories()]);
  }, [loadMetrics, loadMetricCategories]);

  const openCreateMetricModal = () => {
    setEditingMetricId(null);
    setMetricForm(EMPTY_METRIC_FORM);
    setMetricModalOpen(true);
  };

  const openEditMetricModal = (metric: MetricDefinition) => {
    setEditingMetricId(metric.id);
    setMetricForm({
      id: metric.id,
      code: metric.code,
      name: metric.name,
      category_code:
        metric.category_code ||
        toCode(metric.category_label || metric.category),
      unit_of_measure: metric.unit_of_measure || "",
      is_financial: metric.is_financial,
      requires_target_value: metric.requires_target_value,
      allows_binary_completion: metric.allows_binary_completion,
      value_based_progress: metric.value_based_progress || false,
    });
    setMetricModalOpen(true);
  };

  const submitMetricModal = async () => {
    if (!metricForm.name.trim()) {
      ToastService.error("Metric name is required.");
      return;
    }

    if (!metricForm.category_code.trim()) {
      ToastService.error("Category is required.");
      return;
    }

    setSavingMetric(true);
    try {
      const route = editingMetricId
        ? apiRoutes.okr.metricById(editingMetricId)
        : apiRoutes.okr.metrics;
      const method = editingMetricId ? "PUT" : "POST";

      await makeCall({
        method,
        route,
        isSecureRoute: true,
        body: {
          code: metricForm.code.trim() || undefined,
          name: metricForm.name.trim(),
          category_code: toCode(metricForm.category_code),
          unit_of_measure: metricForm.unit_of_measure.trim() || undefined,
          isFinancial: metricForm.is_financial,
          requiresTargetValue: metricForm.requires_target_value,
          allowsBinaryCompletion: metricForm.allows_binary_completion,
          valueBasedProgress: metricForm.value_based_progress,
        },
      });

      setMetricModalOpen(false);
      setMetricForm(EMPTY_METRIC_FORM);
      setEditingMetricId(null);
      await loadMetricWorkspace();
      ToastService.success(
        editingMetricId
          ? "Metric updated successfully."
          : "Metric created successfully.",
      );
    } catch (error) {
      ToastService.error(
        extractMessage(
          error,
          editingMetricId
            ? "Failed to update metric."
            : "Failed to create metric.",
        ),
      );
    } finally {
      setSavingMetric(false);
    }
  };

  const removeMetric = async (metricId: number) => {
    setDeletingMetricId(metricId);
    try {
      await makeCall({
        method: "DELETE",
        route: apiRoutes.okr.metricById(metricId),
        isSecureRoute: true,
      });

      await loadMetricWorkspace();
      ToastService.success("Metric deleted.");
    } catch (error) {
      ToastService.error(extractMessage(error, "Failed to delete metric."));
    } finally {
      setDeletingMetricId(null);
    }
  };

  useEffect(() => {
    if (!metricCategoryDraft.name.trim()) {
      return;
    }

    const matched = metricCategories.find(
      (category) =>
        category.name.toLowerCase() === metricCategoryDraft.name.toLowerCase(),
    );

    if (matched) {
      setMetricCategoryDraft((prev) => ({
        ...prev,
        id: matched.id,
        code: matched.code,
        behavior_type: matched.behavior_type,
        description: String(matched.description || ""),
      }));
    }
  }, [metricCategories, metricCategoryDraft.name]);

  // const createMetricCategory = async (value: string) => {
  const createMetricCategory = async (value: string, description: string = "") => {
    const name = value.trim();
    if (!name) throw new Error("Category name is required.");

    const response = await makeCall({
      method: "POST",
      route: apiRoutes.okr.metricCategories,
      isSecureRoute: true,
      body: {
        name,
        code: toCode(name),
        behavior_type: "CUSTOM",
        description: description || "",
      },
    });

    const created = extractPayload<any>(response);
    const normalized = {
      id: Number(created?.id || 0),
      code: toCode(String(created?.code || name)),
      name: String(created?.name || name),
      behavior_type: String(
        created?.behavior_type || "CUSTOM",
      ).toUpperCase() as OkrMetricCategory,
      description:
        created?.description === null || created?.description === undefined
          ? null
          : String(created.description),
      is_active: asBoolean(created?.is_active, true),
    } as MetricCategoryOption;

    await loadMetricCategories();
    setEditingCategoryId(null);
    setMetricCategoryDraft(EMPTY_METRIC_CATEGORY_DRAFT);
    ToastService.success("Category created.");

    return normalized;
  };

  const saveMetricCategory = async (
    categoryId: number,
    payload: {
      name: string;
      code: string;
      behavior_type: OkrMetricCategory;
      description?: string;
    },
  ) => {
    setSavingCategoryId(categoryId);
    try {
      await makeCall({
        method: "PUT",
        route: apiRoutes.okr.metricCategoryById(categoryId),
        isSecureRoute: true,
        body: {
          name: payload.name.trim(),
          code: toCode(payload.code || payload.name),
          behavior_type: payload.behavior_type,
          description: payload.description || "",
        },
      });

      await loadMetricWorkspace();
      ToastService.success("Category updated.");
    } catch (error) {
      ToastService.error(extractMessage(error, "Failed to update category."));
    } finally {
      setSavingCategoryId(null);
    }
  };

  const handleApplyCategoryDraft = async () => {
    const name = metricCategoryDraft.name.trim();
    if (!name) {
      ToastService.error("Category name is required.");
      return;
    }

    const code = toCode(metricCategoryDraft.code || name);
    const behavior = metricCategoryDraft.behavior_type;
    const description = metricCategoryDraft.description.trim();

    if (editingCategoryId) {
      const oldCode = metricCategories.find(
        (c) => c.id === editingCategoryId,
      )?.code;

      await saveMetricCategory(editingCategoryId, {
        name,
        code,
        behavior_type: behavior,
        description,
      });

      if (metricModalOpen && metricForm.category_code === oldCode) {
        setMetricForm((prev) => ({ ...prev, category_code: code }));
      }

      setEditingCategoryId(null);
      setMetricCategoryDraft(EMPTY_METRIC_CATEGORY_DRAFT);
      return;
    }

    const created = await createMetricCategory(name, description);
    if (metricModalOpen && created) {
      setMetricForm((prev) => ({ ...prev, category_code: created.code }));
    }
  };

  const deleteMetricCategory = async (categoryId: number) => {
    try {
      await makeCall({
        method: "DELETE",
        route: apiRoutes.okr.metricCategoryById(categoryId),
        isSecureRoute: true,
      });

      await loadMetricWorkspace();
      setMetricCategoryDraft((prev) => {
        if (prev.id === categoryId) {
          setEditingCategoryId(null);
          return EMPTY_METRIC_CATEGORY_DRAFT;
        }
        return prev;
      });
      ToastService.success("Category deleted.");
    } catch (error) {
      ToastService.error(extractMessage(error, "Failed to delete category."));
    }
  };

  const loadStatusesAndTransitions = useCallback(async () => {
    const [statusRaw, transitionRaw] = (await Promise.all([
      fetchByKey(CONFIG_KEYS.statuses),
      fetchByKey(CONFIG_KEYS.transitions),
    ])) as [unknown, unknown];

    const fetchedStatuses = normalizeStatuses(statusRaw);
    const fetchedTransitions = normalizeTransitions(transitionRaw);
    setStatuses(fetchedStatuses);
    setTransitions(fetchedTransitions);
  }, [fetchByKey]);

  const loadProfiles = useCallback(async () => {
    const raw = await fetchByKey(CONFIG_KEYS.profiles);
    const fetchedProfiles = normalizeProfiles(raw);
    setProfiles(fetchedProfiles);
  }, [fetchByKey]);

  const loadFeatureFlags = useCallback(async () => {
    const raw = await fetchByKey(CONFIG_KEYS.featureFlags);
    const fetchedFlags = normalizeFeatureFlags(raw);
    setFeatureFlags(fetchedFlags);
  }, [fetchByKey]);

  const refreshCurrentTab = useCallback(async () => {
    setRefreshingTab(true);
    try {
      if (tab === "general") {
        await Promise.all([fetchSummary(), fetchMenu()]);
      } else if (tab === "statuses") {
        await loadStatusesAndTransitions();
      } else if (tab === "metrics") {
        await Promise.all([loadMetricWorkspace(), fetchMenu()]);
      } else if (tab === "profiles") {
        await loadProfiles();
      } else {
        await loadFeatureFlags();
      }
      ToastService.success("Tab reloaded.");
    } catch (error) {
      ToastService.error(extractMessage(error, "Unable to reload tab data."));
    } finally {
      setRefreshingTab(false);
    }
  }, [
    fetchMenu,
    fetchSummary,
    loadFeatureFlags,
    loadMetricWorkspace,
    loadProfiles,
    loadStatusesAndTransitions,
    tab,
  ]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoadingInitial(true);
      try {
        await Promise.all([
          fetchSummary(),
          fetchMenu(),
          loadMetricWorkspace(),
          loadStatusesAndTransitions(),
          loadProfiles(),
          loadFeatureFlags(),
        ]);
      } catch (error) {
        if (!cancelled) {
          ToastService.error(
            extractMessage(
              error,
              "Failed to initialize OKR configuration page.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [
    fetchMenu,
    fetchSummary,
    loadFeatureFlags,
    loadMetricWorkspace,
    loadProfiles,
    loadStatusesAndTransitions,
  ]);

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await makeCall({
        method: "PUT",
        route: apiRoutes.okr.configurationMenu,
        body: menuDraft,
        isSecureRoute: true,
      });

      await Promise.all([fetchSummary(), fetchMenu()]);
      ToastService.success("General configuration saved.");
    } catch (error) {
      ToastService.error(
        extractMessage(error, "Failed to save general configuration."),
      );
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveStatuses = async () => {
    setSavingStatuses(true);
    try {
      await Promise.all([
        saveConfigKey(CONFIG_KEYS.statuses, statuses, true),
        saveConfigKey(CONFIG_KEYS.transitions, transitions, true),
      ]);
      await fetchSummary();
      ToastService.success("Statuses and transitions saved.");
    } catch (error) {
      ToastService.error(
        extractMessage(error, "Failed to save status configuration."),
      );
    } finally {
      setSavingStatuses(false);
    }
  };

  const handleSaveProfiles = async () => {
    setSavingProfiles(true);
    try {
      await saveConfigKey(CONFIG_KEYS.profiles, profiles, true);
      await fetchSummary();
      ToastService.success("Profiles saved.");
    } catch (error) {
      ToastService.error(extractMessage(error, "Failed to save profiles."));
    } finally {
      setSavingProfiles(false);
    }
  };

  const handleSaveFeatureFlags = async () => {
    setSavingFlags(true);
    try {
      await saveConfigKey(CONFIG_KEYS.featureFlags, featureFlags, true);
      await fetchSummary();
      ToastService.success("Feature flags saved.");
    } catch (error) {
      ToastService.error(
        extractMessage(error, "Failed to save feature flags."),
      );
    } finally {
      setSavingFlags(false);
    }
  };

  const handleSaveMetricRules = async () => {
    setSavingMetricRules(true);
    try {
      await makeCall({
        method: "PUT",
        route: apiRoutes.okr.configurationMenu,
        body: {
          metric_configuration: menuDraft.metric_configuration,
        },
        isSecureRoute: true,
      });
      await Promise.all([fetchSummary(), fetchMenu()]);
      ToastService.success("Metric configuration saved.");
    } catch (error) {
      ToastService.error(
        extractMessage(error, "Failed to save metric configuration."),
      );
    } finally {
      setSavingMetricRules(false);
    }
  };

  const openCreateStatusModal = () => {
    setStatusDraft({
      id: "",
      entity_type: "COMPANY_OBJECTIVE",
      status_code: "",
      display_name: "",
      is_initial: false,
      is_terminal: false,
      sort_order: statuses.length + 1,
      is_active: true,
    });
    setStatusModalOpen(true);
  };

  const openEditStatusModal = (row: StatusDefinition) => {
    setStatusDraft({ ...row });
    setStatusModalOpen(true);
  };

  const submitStatusModal = () => {
    const normalizedCode = toCode(statusDraft.display_name);
    const displayName = statusDraft.display_name.trim();

    if (!normalizedCode || !displayName) {
      ToastService.error("Status name is required.");
      return;
    }

    const currentId = statusDraft.id || createClientId();

    const nextRecord: StatusDefinition = {
      ...statusDraft,
      id: currentId,
      status_code: normalizedCode,
      display_name: toPascalWords(displayName),
      sort_order: statusDraft.sort_order > 0 ? statusDraft.sort_order : 1,
    };

    setStatuses((prev) => {
      let next = prev.filter((item) => item.id !== currentId);

      if (nextRecord.is_initial) {
        next = next.map((item) =>
          item.entity_type === nextRecord.entity_type
            ? { ...item, is_initial: false }
            : item,
        );
      }

      next.push(nextRecord);
      return next.sort((a, b) => a.sort_order - b.sort_order);
    });
    setStatusModalOpen(false);
  };

  const removeStatus = (row: StatusDefinition) => {
    setStatuses((prev) => prev.filter((item) => item.id !== row.id));
    setTransitions((prev) =>
      prev.filter(
        (transition) =>
          !(
            transition.entity_type === row.entity_type &&
            (transition.from_status_code === row.status_code ||
              transition.to_status_code === row.status_code)
          ),
      ),
    );
  };

  const addTransition = () => {
    const fromCode = toCode(newTransition.from_status_code);
    const toCodeValue = toCode(newTransition.to_status_code);

    if (!fromCode || !toCodeValue) {
      ToastService.error("Transition requires both from and to statuses.");
      return;
    }

    if (fromCode === toCodeValue) {
      ToastService.error("From and to statuses must be different.");
      return;
    }

    const duplicate = transitions.some(
      (item) =>
        item.entity_type === newTransition.entity_type &&
        item.from_status_code === fromCode &&
        item.to_status_code === toCodeValue,
    );

    if (duplicate) {
      ToastService.error("Transition already exists.");
      return;
    }

    setTransitions((prev) => [
      ...prev,
      {
        ...newTransition,
        id: createClientId(),
        from_status_code: fromCode,
        to_status_code: toCodeValue,
        required_role: newTransition.required_role.trim().toUpperCase(),
      },
    ]);

    setNewTransition((prev) => ({
      ...prev,
      from_status_code: "",
      to_status_code: "",
      required_role: "",
      requires_approval: false,
    }));
  };

  const openCreateProfileModal = () => {
    setProfileDraft({
      id: "",
      name: "",
      scope_type: "GLOBAL",
      description: "",
      assignment: "",
      access_level: "",
      sync_frequency: "",
      is_active: true,
    });
    setProfileModalOpen(true);
  };

  const submitProfileModal = () => {
    if (!profileDraft.name.trim()) {
      ToastService.error("Profile name is required.");
      return;
    }

    const id = profileDraft.id || createClientId();
    const payload: ProfileDraft = {
      ...profileDraft,
      id,
      name: profileDraft.name.trim(),
      description: profileDraft.description.trim(),
      assignment: profileDraft.assignment.trim(),
      access_level: profileDraft.access_level.trim(),
      sync_frequency: profileDraft.sync_frequency.trim(),
    };

    setProfiles((prev) => {
      const next = prev.filter((item) => item.id !== id);
      next.push(payload);
      return next;
    });
    setProfileModalOpen(false);
  };

  const openCreateFlagModal = () => {
    setFlagDraft({
      id: "",
      feature_name: "",
      scope_type: "GLOBAL",
      description: "",
      target_audience: "",
      impact_radius: "",
      is_enabled: false,
    });
    setFlagModalOpen(true);
  };

  const submitFlagModal = () => {
    if (!flagDraft.feature_name.trim()) {
      ToastService.error("Feature flag name is required.");
      return;
    }

    const id = flagDraft.id || createClientId();
    const payload: FeatureFlagDraft = {
      ...flagDraft,
      id,
      feature_name: flagDraft.feature_name.trim(),
      description: flagDraft.description.trim(),
      target_audience: flagDraft.target_audience.trim(),
      impact_radius: flagDraft.impact_radius.trim(),
    };

    setFeatureFlags((prev) => {
      const next = prev.filter((item) => item.id !== id);
      next.push(payload);
      return next;
    });
    setFlagModalOpen(false);
  };

  const renderGeneralTab = () => (
    <div className="max-w-5xl">
      <section className="rounded-3xl bg-white p-6 md:p-8 shadow-sm space-y-6 border border-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              Planning Approach
            </span>
            <select
              value={menuDraft.planning_approach.selected}
              onChange={(event) => {
                const selected = event.target.value as PlanningApproach;
                setMenuDraft((prev) => ({
                  ...prev,
                  planning_approach: {
                    ...prev.planning_approach,
                    selected,
                    options: Array.from(
                      new Set([...prev.planning_approach.options, selected]),
                    ),
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {menuDraft.planning_approach.options.map((option) => (
                <option key={option} value={option}>
                  {titleize(option)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              Planning Cadence
            </span>
            <select
              value={menuDraft.planning_cadence_rules.active_cadence}
              onChange={(event) => {
                const cadence = event.target.value as PlanningCadence;
                setMenuDraft((prev) => ({
                  ...prev,
                  planning_cadence_rules: {
                    ...prev.planning_cadence_rules,
                    active_cadence: cadence,
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="MONTHLY">Monthly</option>
              <option value="WEEKLY">Weekly</option>
              <option value="DAILY">Daily</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              Min Objectives
            </span>
            <input
              type="number"
              min={1}
              value={menuDraft.additional_configuration.allowed_objectives.min}
              onChange={(event) => {
                const value = asPositiveInt(
                  event.target.value,
                  menuDraft.additional_configuration.allowed_objectives.min,
                );
                setMenuDraft((prev) => ({
                  ...prev,
                  additional_configuration: {
                    ...prev.additional_configuration,
                    allowed_objectives: {
                      ...prev.additional_configuration.allowed_objectives,
                      min: value,
                    },
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              Max Objectives
            </span>
            <input
              type="number"
              min={1}
              value={menuDraft.additional_configuration.allowed_objectives.max}
              onChange={(event) => {
                const value = asPositiveInt(
                  event.target.value,
                  menuDraft.additional_configuration.allowed_objectives.max,
                );
                setMenuDraft((prev) => ({
                  ...prev,
                  additional_configuration: {
                    ...prev.additional_configuration,
                    allowed_objectives: {
                      ...prev.additional_configuration.allowed_objectives,
                      max: value,
                    },
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              Min Key Results
            </span>
            <input
              type="number"
              min={1}
              value={menuDraft.additional_configuration.allowed_krs.min}
              onChange={(event) => {
                const value = asPositiveInt(
                  event.target.value,
                  menuDraft.additional_configuration.allowed_krs.min,
                );
                setMenuDraft((prev) => ({
                  ...prev,
                  additional_configuration: {
                    ...prev.additional_configuration,
                    allowed_krs: {
                      ...prev.additional_configuration.allowed_krs,
                      min: value,
                    },
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              Max Key Results
            </span>
            <input
              type="number"
              min={1}
              value={menuDraft.additional_configuration.allowed_krs.max}
              onChange={(event) => {
                const value = asPositiveInt(
                  event.target.value,
                  menuDraft.additional_configuration.allowed_krs.max,
                );
                setMenuDraft((prev) => ({
                  ...prev,
                  additional_configuration: {
                    ...prev.additional_configuration,
                    allowed_krs: {
                      ...prev.additional_configuration.allowed_krs,
                      max: value,
                    },
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              Off-Track {"<="}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={
                menuDraft.additional_configuration.confidence_level_mapping
                  .off_track_lte_percent
              }
              onChange={(event) => {
                const value = asPercent(
                  event.target.value,
                  menuDraft.additional_configuration.confidence_level_mapping
                    .off_track_lte_percent,
                );
                setMenuDraft((prev) => ({
                  ...prev,
                  additional_configuration: {
                    ...prev.additional_configuration,
                    confidence_level_mapping: {
                      ...prev.additional_configuration.confidence_level_mapping,
                      off_track_lte_percent: value,
                    },
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              At-Risk {"<="}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={
                menuDraft.additional_configuration.confidence_level_mapping
                  .at_risk_lte_percent
              }
              onChange={(event) => {
                const value = asPercent(
                  event.target.value,
                  menuDraft.additional_configuration.confidence_level_mapping
                    .at_risk_lte_percent,
                );
                setMenuDraft((prev) => ({
                  ...prev,
                  additional_configuration: {
                    ...prev.additional_configuration,
                    confidence_level_mapping: {
                      ...prev.additional_configuration.confidence_level_mapping,
                      at_risk_lte_percent: value,
                    },
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">
              On-Track {">="}
            </span>
            <input
              type="number"
              min={0}
              max={100}
              value={
                menuDraft.additional_configuration.confidence_level_mapping
                  .on_track_gte_percent
              }
              onChange={(event) => {
                const value = asPercent(
                  event.target.value,
                  menuDraft.additional_configuration.confidence_level_mapping
                    .on_track_gte_percent,
                );
                setMenuDraft((prev) => ({
                  ...prev,
                  additional_configuration: {
                    ...prev.additional_configuration,
                    confidence_level_mapping: {
                      ...prev.additional_configuration.confidence_level_mapping,
                      on_track_gte_percent: value,
                    },
                  },
                }));
              }}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium">
            Auto-Publish on Approval
            <input
              type="checkbox"
              checked={
                menuDraft.additional_configuration.auto_publish_on_approval
              }
              onChange={(event) =>
                setMenuDraft((prev) => ({
                  ...prev,
                  additional_configuration: {
                    ...prev.additional_configuration,
                    auto_publish_on_approval: event.target.checked,
                  },
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium">
            Allow Financial Metrics
            <input
              type="checkbox"
              checked={menuDraft.metric_configuration.allow_financial_metrics}
              onChange={(event) =>
                setMenuDraft((prev) => ({
                  ...prev,
                  metric_configuration: {
                    ...prev.metric_configuration,
                    allow_financial_metrics: event.target.checked,
                  },
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>

          <label className="flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium">
            Allow Non-Financial Metrics
            <input
              type="checkbox"
              checked={
                menuDraft.metric_configuration.allow_non_financial_metrics
              }
              onChange={(event) =>
                setMenuDraft((prev) => ({
                  ...prev,
                  metric_configuration: {
                    ...prev.metric_configuration,
                    allow_non_financial_metrics: event.target.checked,
                  },
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3 capitalize">
            Level Cadence Permissions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-2 pr-4">Role</th>
                  <th className="pb-2 pr-4">Monthly</th>
                  <th className="pb-2 pr-4">Weekly</th>
                  <th className="pb-2">Daily</th>
                </tr>
              </thead>
              <tbody>
                {(
                  Object.keys(menuDraft.level_configuration) as LevelRole[]
                ).map((role) => (
                  <tr key={role} className="border-t border-slate-200/80">
                    <td className="py-3 pr-4 font-medium text-gray-800">
                      {titleize(role)}
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={
                          menuDraft.level_configuration[role].allow_monthly
                        }
                        onChange={(event) =>
                          setMenuDraft((prev) => ({
                            ...prev,
                            level_configuration: {
                              ...prev.level_configuration,
                              [role]: {
                                ...prev.level_configuration[role],
                                allow_monthly: event.target.checked,
                              },
                            },
                          }))
                        }
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <input
                        type="checkbox"
                        checked={
                          menuDraft.level_configuration[role].allow_weekly
                        }
                        onChange={(event) =>
                          setMenuDraft((prev) => ({
                            ...prev,
                            level_configuration: {
                              ...prev.level_configuration,
                              [role]: {
                                ...prev.level_configuration[role],
                                allow_weekly: event.target.checked,
                              },
                            },
                          }))
                        }
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={
                          menuDraft.level_configuration[role].allow_daily
                        }
                        onChange={(event) =>
                          setMenuDraft((prev) => ({
                            ...prev,
                            level_configuration: {
                              ...prev.level_configuration,
                              [role]: {
                                ...prev.level_configuration[role],
                                allow_daily: event.target.checked,
                              },
                            },
                          }))
                        }
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={() => setMenuDraft(originalMenu)}
            disabled={savingGeneral || !isMenuDirty}
          >
            Undo
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveGeneral}
            disabled={savingGeneral || !isMenuDirty}
            loading={savingGeneral}
          >
            Apply Configuration
          </Button>
        </div>
      </section>
    </div>
  );

  const renderStatusesTab = () => (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 capitalize flex items-center gap-2">
            Workflow Statuses
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
              Preview
            </span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Define the lifecycle of OKRs (Draft, Review, Approved, etc.) to
            control workflow and visibility across the organization.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateStatusModal} icon={MdAdd}>
          Add Status
        </Button>
      </div>

      <div className="rounded-3xl bg-white p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTransitionsEditor((prev) => !prev)}
              icon={MdSwapHoriz}
            >
              {showTransitionsEditor ? "Hide Transitions" : "Edit Transitions"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl bg-slate-50">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-semibold">Used For</th>
                <th className="px-4 py-3 font-semibold">Status Name</th>
                <th className="px-4 py-3 font-semibold">Starting Step</th>
                <th className="px-4 py-3 font-semibold">Final Step</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {statuses.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-gray-500"
                    colSpan={5}
                  >
                    No statuses yet. Add your first workflow step to get
                    started.
                  </td>
                </tr>
              ) : (
                statuses.map((row) => (
                  <tr key={row.id} className="border-t border-slate-200/80">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {titleize(row.entity_type)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary">
                        {row.display_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.is_initial ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.is_terminal ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditStatusModal(row)}
                          className="p-1.5 h-auto text-gray-600 hover:bg-slate-200"
                          icon={MdEdit}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStatus(row)}
                          className="p-1.5 h-auto text-gray-600 hover:bg-red-100 hover:text-red-600"
                          icon={MdDelete}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showTransitionsEditor && (
          <div className="rounded-2xl bg-slate-50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900 capitalize">
                How Items Move Between Steps
              </h3>
              <span className="text-xs text-gray-500">
                {transitions.length} rule(s)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
              <select
                value={newTransition.entity_type}
                onChange={(event) =>
                  setNewTransition((prev) => ({
                    ...prev,
                    entity_type: event.target.value as OkrEntityType,
                    from_status_code: "",
                    to_status_code: "",
                  }))
                }
                className="rounded-xl bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ENTITY_TYPES.map((entity) => (
                  <option key={entity} value={entity}>
                    {titleize(entity)}
                  </option>
                ))}
              </select>
              <select
                value={newTransition.from_status_code}
                onChange={(event) =>
                  setNewTransition((prev) => ({
                    ...prev,
                    from_status_code: event.target.value,
                  }))
                }
                className="rounded-xl bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">From</option>
                {statusCodesForTransition.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <select
                value={newTransition.to_status_code}
                onChange={(event) =>
                  setNewTransition((prev) => ({
                    ...prev,
                    to_status_code: event.target.value,
                  }))
                }
                className="rounded-xl bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">To</option>
                {statusCodesForTransition.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <select
                value={newTransition.required_role}
                onChange={(event) =>
                  setNewTransition((prev) => ({
                    ...prev,
                    required_role: event.target.value,
                  }))
                }
                className="rounded-xl bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {ROLE_OPTIONS.map((role: string) => (
                  <option key={role || "any-role"} value={role}>
                    {role || "Any role"}
                  </option>
                ))}
              </select>
              <label className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                Approval
                <input
                  type="checkbox"
                  checked={newTransition.requires_approval}
                  onChange={(event) =>
                    setNewTransition((prev) => ({
                      ...prev,
                      requires_approval: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-primary"
                />
              </label>
              <Button variant="primary" size="sm" onClick={addTransition}>
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {transitions.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No transition rules configured.
                </p>
              ) : (
                transitions.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-white px-3 py-2 flex items-center justify-between"
                  >
                    <div className="text-sm text-gray-800">
                      <span className="font-medium">
                        {titleize(item.entity_type)}
                      </span>
                      <span className="mx-2 text-gray-400">|</span>
                      <span>{item.from_status_code}</span>
                      <span className="mx-2 text-gray-400">→</span>
                      <span>{item.to_status_code}</span>
                      {item.required_role && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-gray-600">
                          {item.required_role}
                        </span>
                      )}
                      {item.requires_approval && (
                        <span className="ml-2 rounded-full bg-primary-light px-2 py-0.5 text-xs text-primary">
                          Approval Required
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setTransitions((prev) =>
                          prev.filter(
                            (transition) => transition.id !== item.id,
                          ),
                        )
                      }
                      className="p-1.5 h-auto text-gray-600 hover:bg-red-100 hover:text-red-600"
                      icon={MdDelete}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={loadStatusesAndTransitions}>
            Undo
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveStatuses}
            disabled={savingStatuses}
            loading={savingStatuses}
          >
            Save Status Flow
          </Button>
        </div>
      </div>
    </section>
  );

  const renderMetricsTab = () => (
    <section className="rounded-3xl bg-white p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 capitalize">
            Metric Definitions
          </h2>
          <p className="text-sm text-gray-600">
            Define the measurement types teams can pick while creating goals.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={openCreateMetricModal}
            icon={MdAdd}
          >
            Add Metric Type
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-slate-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Financial</th>
              <th className="px-4 py-3 font-semibold">Milestone</th>
              <th className="px-4 py-3 font-semibold">Value-Based</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {metrics.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                  No Metrics Defined Yet
                </td>
              </tr>
            ) : (
              metrics.map((row) => (
                <tr key={row.id} className="border-t border-slate-200/80">
                  <td className="px-4 py-3 text-gray-800 font-semibold">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.category_label || titleize(row.category)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.is_financial ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.allows_binary_completion ? "Enabled" : "Disabled"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.value_based_progress ? "Direct Value" : "Score Aggregated"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditMetricModal(row)}
                        className="p-1.5 h-auto text-gray-600 hover:bg-slate-200"
                        aria-label={`Edit ${row.name}`}
                        disabled={savingMetric || deletingMetricId === row.id}
                        icon={MdEdit}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeMetric(row.id)}
                        className="p-1.5 h-auto text-gray-600 hover:bg-red-100 hover:text-red-600"
                        aria-label={`Delete ${row.name}`}
                        disabled={deletingMetricId === row.id}
                        icon={MdDelete}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 capitalize">
            Metric Availability Settings
          </h3>
          <p className="text-sm text-gray-600">
            Choose which metric types are available across your workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
            Allow Financial Metrics
            <input
              type="checkbox"
              checked={menuDraft.metric_configuration.allow_financial_metrics}
              onChange={(event) =>
                setMenuDraft((prev) => ({
                  ...prev,
                  metric_configuration: {
                    ...prev.metric_configuration,
                    allow_financial_metrics: event.target.checked,
                  },
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
            Allow Non-Financial Metrics
            <input
              type="checkbox"
              checked={
                menuDraft.metric_configuration.allow_non_financial_metrics
              }
              onChange={(event) =>
                setMenuDraft((prev) => ({
                  ...prev,
                  metric_configuration: {
                    ...prev.metric_configuration,
                    allow_non_financial_metrics: event.target.checked,
                  },
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSaveMetricRules}
            disabled={savingMetricRules}
            loading={savingMetricRules}
          >
            Save Metric Rules
          </Button>
        </div>
      </div>
    </section>
  );
  const renderCategoriesTab = () => (
    <section className="rounded-3xl bg-white p-6 md:p-8 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 capitalize">
            Metric Categoriess
          </h2>
          <p className="text-sm text-gray-600">
            Group metrics into categories to help teams easily find the right measurement tools.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setMetricCategoryDraft(EMPTY_METRIC_CATEGORY_DRAFT);
              setEditingCategoryId(null);
              setCategoryModalOpen(true);
            }}
            icon={MdAdd}
          >
            Add Category
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-slate-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {metricCategories.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={4}>
                  No Metric Categories Defined Yet
                </td>
              </tr>
            ) : (
              metricCategories.map((row) => (
                <tr key={row.id} className="border-t border-slate-200/80">
                  <td className="px-4 py-3 text-gray-800 font-semibold">{row.name}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-sm truncate">
                    {row.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingCategoryId(row.id);
                          setMetricCategoryDraft({
                            id: row.id,
                            name: row.name,
                            code: row.code,
                            behavior_type: row.behavior_type,
                            description: row.description || "",
                          });
                          setCategoryModalOpen(true);
                        }}
                        className="p-1.5 h-auto text-gray-600 hover:bg-slate-200"
                        aria-label={`Edit ${row.name}`}
                        icon={MdEdit}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCategoryToDelete({ id: row.id, name: row.name })}
                        className="p-1.5 h-auto text-gray-600 hover:bg-red-100 hover:text-red-600"
                        aria-label={`Delete ${row.name}`}
                        icon={MdDelete}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );



  const renderProfilesTab = () => (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Cycle Profiles
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              Preview
            </span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Configure cycle templates with specific deadlines, mandatory
            approval layers, and submission behaviors.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateProfileModal} icon={MdAdd}>
          Create Profile
        </Button>
      </div>

      <div className="rounded-3xl bg-white p-6 md:p-8 shadow-sm">
        {profiles.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-sm text-gray-500">
            No profiles yet. Create one to guide how teams set and track goals.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {profiles.map((profile) => (
              <article
                key={profile.id}
                className="rounded-2xl bg-slate-50 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 capitalize">
                      {profile.name}
                    </h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      {titleize(profile.scope_type)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setProfileDraft(profile);
                        setProfileModalOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-gray-600 hover:bg-white h-auto"
                      aria-label={`Edit ${profile.name}`}
                      icon={MdEdit}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setProfiles((prev) =>
                          prev.filter((item) => item.id !== profile.id),
                        )
                      }
                      className="rounded-lg p-1.5 text-gray-600 hover:bg-red-100 hover:text-red-600 h-auto"
                      aria-label={`Delete ${profile.name}`}
                      icon={MdDelete}
                    />
                  </div>
                </div>
                {profile.description && (
                  <p className="text-sm text-gray-600">{profile.description}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600">
                  <p>
                    <span className="font-semibold text-gray-700">
                      Assignment:
                    </span>{" "}
                    {profile.assignment || "N/A"}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">Access:</span>{" "}
                    {profile.access_level || "N/A"}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">Sync:</span>{" "}
                    {profile.sync_frequency || "N/A"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6">
          <Button variant="secondary" onClick={loadProfiles}>
            Restore Saved Values
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveProfiles}
            disabled={savingProfiles}
            loading={savingProfiles}
          >
            Save Profiles
          </Button>
        </div>
      </div>
    </section>
  );

  const renderFeatureFlagsTab = () => (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            Feature Flags
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              Preview
            </span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Toggle experimental OKR features on or off for specific scopes to
            control feature rollouts.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateFlagModal} icon={MdAdd}>
          New Flag
        </Button>
      </div>

      <div className="rounded-3xl bg-white p-6 md:p-8 shadow-sm">
        {featureFlags.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-sm text-gray-500">
            No feature flags yet. Add one to control feature rollout.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {featureFlags.map((flag) => (
              <article
                key={flag.id}
                className="rounded-2xl bg-slate-50 p-4 space-y-3 border-l-4 border-primary/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 capitalize">
                      {flag.feature_name}
                    </h3>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      {titleize(flag.scope_type)}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    Enabled
                    <input
                      type="checkbox"
                      checked={flag.is_enabled}
                      onChange={(event) =>
                        setFeatureFlags((prev) =>
                          prev.map((item) =>
                            item.id === flag.id
                              ? { ...item, is_enabled: event.target.checked }
                              : item,
                          ),
                        )
                      }
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                </div>

                {flag.description && (
                  <p className="text-sm text-gray-600">{flag.description}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
                  <p>
                    <span className="font-semibold text-gray-700">Target:</span>{" "}
                    {flag.target_audience || "N/A"}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">Impact:</span>{" "}
                    {flag.impact_radius || "N/A"}
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setFeatureFlags((prev) =>
                        prev.filter((item) => item.id !== flag.id),
                      )
                    }
                    className="rounded-lg p-1.5 text-gray-600 hover:bg-red-100 hover:text-red-600 h-auto"
                    aria-label={`Delete ${flag.feature_name}`}
                    icon={MdDelete}
                  />
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6">
          <Button variant="secondary" onClick={loadFeatureFlags}>
            Restore Saved Values
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveFeatureFlags}
            disabled={savingFlags}
            loading={savingFlags}
          >
            Save Feature Flags
          </Button>
        </div>
      </div>
    </section>
  );

  const renderActiveTab = () => {
    if (tab === "general") return renderGeneralTab();
    if (tab === "categories") return renderCategoriesTab();
    if (tab === "statuses") return renderStatusesTab();
    if (tab === "metrics") return renderMetricsTab();
    if (tab === "profiles") return renderProfilesTab();
    return renderFeatureFlagsTab();
  };

  if (!okrFeatureFlags.configuration) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-slate-50 p-8 text-center text-gray-500 text-sm">
          Configuration disabled (feature flag).
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-linear-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 pt-2 space-y-6">
          <PageHeader>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl ring-1 ring-white/20 shadow-inner">
                    <MdSettings className="text-3xl text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-white capitalize">
                      OKR Configuration
                    </h1>
                    <p className="text-white/80 text-sm mt-1">
                      Set up planning rules, status flow, and metric options for
                      your teams.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <RefreshButton
                    onClick={refreshCurrentTab}
                    loading={refreshingTab}
                  />
                </div>
              </div>
            </div>
          </PageHeader>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
            {TABS.map((t) => (
              <Button
                key={t.id}
                variant="ghost"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all h-auto ${tab === t.id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                {t.label}
                {t.isPreview && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${tab === t.id ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"}`}
                  >
                    Preview
                  </span>
                )}
              </Button>
            ))}
          </div>

          {loadingInitial ? <ConfigurationSkeleton /> : renderActiveTab()}
        </div>
      </div>

      <ModalLayout
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={statusDraft.id ? "Edit Status" : "Add New Status"}
        maxWidthClass="max-w-2xl"
        footer={
          <ApprovalFooter
            onCancel={() => setStatusModalOpen(false)}
            onConfirm={submitStatusModal}
            confirmText="Save Status"
          />
        }
      >
        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-gray-700">
            Applies To
          </span>
          <select
            value={statusDraft.entity_type}
            onChange={(event) =>
              setStatusDraft((prev) => ({
                ...prev,
                entity_type: event.target.value as OkrEntityType,
              }))
            }
            className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {ENTITY_TYPES.map((entity) => (
              <option key={entity} value={entity}>
                {titleize(entity)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Status Name
            </span>
            <input
              value={statusDraft.display_name}
              onChange={(event) =>
                setStatusDraft((prev) => ({
                  ...prev,
                  display_name: event.target.value,
                }))
              }
              placeholder="e.g. Draft"
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
            Initial Status
            <input
              type="checkbox"
              checked={statusDraft.is_initial}
              onChange={(event) =>
                setStatusDraft((prev) => ({
                  ...prev,
                  is_initial: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
            Terminal Status
            <input
              type="checkbox"
              checked={statusDraft.is_terminal}
              onChange={(event) =>
                setStatusDraft((prev) => ({
                  ...prev,
                  is_terminal: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
            Active
            <input
              type="checkbox"
              checked={statusDraft.is_active}
              onChange={(event) =>
                setStatusDraft((prev) => ({
                  ...prev,
                  is_active: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      </ModalLayout>

      <ModalLayout
        isOpen={metricModalOpen}
        onClose={() => {
          setMetricModalOpen(false);
          setMetricForm(EMPTY_METRIC_FORM);
        }}
        title={editingMetricId ? "Edit Metric Type" : "Add Metric Type"}
        maxWidthClass="max-w-4xl"
        fullHeight
        footer={
          <ApprovalFooter
            onCancel={() => {
              setMetricModalOpen(false);
              setMetricForm(EMPTY_METRIC_FORM);
              setEditingMetricId(null);
            }}
            onConfirm={submitMetricModal}
            confirmText={
              savingMetric
                ? editingMetricId
                  ? "Updating..."
                  : "Creating..."
                : editingMetricId
                  ? "Update Metric"
                  : "Create Metric"
            }
            confirmDisabled={savingMetric}
          />
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="space-y-2 block">
              <span className="text-sm font-semibold text-gray-700">
                Metric Name
              </span>
              <input
                value={metricForm.name}
                onChange={(event) =>
                  setMetricForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Net Recurring Revenue"
                className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Category
            </span>
            <select
              value={metricForm.category_code}
              onChange={(event) =>
                setMetricForm((prev) => ({
                  ...prev,
                  category_code: event.target.value,
                }))
              }
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="" disabled>
                Select a category
              </option>
              {metricCategories.map((category) => (
                <option key={category.code} value={category.code}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Unit of Measure
            </span>
            <input
              value={metricForm.unit_of_measure}
              onChange={(event) =>
                setMetricForm((prev) => ({
                  ...prev,
                  unit_of_measure: event.target.value,
                }))
              }
              placeholder="e.g. ETB, %, Leads"
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
              Financial Metric
              <input
                type="checkbox"
                checked={metricForm.is_financial}
                onChange={(event) =>
                  setMetricForm((prev) => ({
                    ...prev,
                    is_financial: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
              Requires Target Value
              <input
                type="checkbox"
                checked={metricForm.requires_target_value}
                onChange={(event) =>
                  setMetricForm((prev) => ({
                    ...prev,
                    requires_target_value: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
              Allows Milestone Completion
              <input
                type="checkbox"
                checked={metricForm.allows_binary_completion}
                onChange={(event) =>
                  setMetricForm((prev) => ({
                    ...prev,
                    allows_binary_completion: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
              Value Based Progress
              <input
                type="checkbox"
                checked={metricForm.value_based_progress}
                onChange={(event) =>
                  setMetricForm((prev) => ({
                    ...prev,
                    value_based_progress: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-primary"
              />
            </label>
          </div>

          {metricForm.value_based_progress && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <p className="text-[11px] leading-relaxed text-amber-700 font-medium">
                <span className="font-bold block mb-0.5">Value-Based Calculation Enabled:</span>
                This metric will calculate progress purely as <code className="bg-amber-100/50 px-1 rounded">Current / Target</code>.
                It will bypass the standard weighted score aggregation for all associated plans and hierarchies.
              </p>
            </div>
          )}
        </div>
      </ModalLayout>

      <ModalLayout
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={profileDraft.id ? "Edit Profile" : "Create Profile"}
        maxWidthClass="max-w-2xl"
        footer={
          <ApprovalFooter
            onCancel={() => setProfileModalOpen(false)}
            onConfirm={submitProfileModal}
            confirmText="Save Profile"
          />
        }
      >
        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-gray-700">Name</span>
          <input
            value={profileDraft.name}
            onChange={(event) =>
              setProfileDraft((prev) => ({ ...prev, name: event.target.value }))
            }
            placeholder="e.g. Executive Strategic Core"
            className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Scope Type
            </span>
            <select
              value={profileDraft.scope_type}
              onChange={(event) =>
                setProfileDraft((prev) => ({
                  ...prev,
                  scope_type: event.target.value as ScopeType,
                }))
              }
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SCOPE_OPTIONS.map((scope) => (
                <option key={scope} value={scope}>
                  {titleize(scope)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Assignment
            </span>
            <input
              value={profileDraft.assignment}
              onChange={(event) =>
                setProfileDraft((prev) => ({
                  ...prev,
                  assignment: event.target.value,
                }))
              }
              placeholder="e.g. Global HQ"
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Access Level
            </span>
            <input
              value={profileDraft.access_level}
              onChange={(event) =>
                setProfileDraft((prev) => ({
                  ...prev,
                  access_level: event.target.value,
                }))
              }
              placeholder="e.g. Admin-Full"
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Sync Frequency
            </span>
            <input
              value={profileDraft.sync_frequency}
              onChange={(event) =>
                setProfileDraft((prev) => ({
                  ...prev,
                  sync_frequency: event.target.value,
                }))
              }
              placeholder="e.g. Real-time"
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-gray-700">
            Description
          </span>
          <textarea
            value={profileDraft.description}
            onChange={(event) =>
              setProfileDraft((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            rows={3}
            className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
          Active
          <input
            type="checkbox"
            checked={profileDraft.is_active}
            onChange={(event) =>
              setProfileDraft((prev) => ({
                ...prev,
                is_active: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-primary"
          />
        </label>
      </ModalLayout>

      <ModalLayout
        isOpen={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        title={flagDraft.id ? "Edit Feature Flag" : "Create Feature Flag"}
        maxWidthClass="max-w-2xl"
        footer={
          <ApprovalFooter
            onCancel={() => setFlagModalOpen(false)}
            onConfirm={submitFlagModal}
            confirmText="Save Flag"
          />
        }
      >
        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-gray-700">
            Feature Name
          </span>
          <input
            value={flagDraft.feature_name}
            onChange={(event) =>
              setFlagDraft((prev) => ({
                ...prev,
                feature_name: event.target.value,
              }))
            }
            placeholder="e.g. weekly_planning"
            className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Scope Type
            </span>
            <select
              value={flagDraft.scope_type}
              onChange={(event) =>
                setFlagDraft((prev) => ({
                  ...prev,
                  scope_type: event.target.value as ScopeType,
                }))
              }
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {SCOPE_OPTIONS.map((scope) => (
                <option key={scope} value={scope}>
                  {titleize(scope)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Impact Radius
            </span>
            <input
              value={flagDraft.impact_radius}
              onChange={(event) =>
                setFlagDraft((prev) => ({
                  ...prev,
                  impact_radius: event.target.value,
                }))
              }
              placeholder="e.g. Global Production"
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-gray-700">
            Target Audience
          </span>
          <input
            value={flagDraft.target_audience}
            onChange={(event) =>
              setFlagDraft((prev) => ({
                ...prev,
                target_audience: event.target.value,
              }))
            }
            placeholder="e.g. All Enterprise Users"
            className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="space-y-2 block">
          <span className="text-sm font-semibold text-gray-700">
            Description
          </span>
          <textarea
            value={flagDraft.description}
            onChange={(event) =>
              setFlagDraft((prev) => ({
                ...prev,
                description: event.target.value,
              }))
            }
            rows={3}
            className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium">
          Enabled
          <input
            type="checkbox"
            checked={flagDraft.is_enabled}
            onChange={(event) =>
              setFlagDraft((prev) => ({
                ...prev,
                is_enabled: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-primary"
          />
        </label>
      </ModalLayout>

      {/* Category Management Modal */}
      <ModalLayout
        isOpen={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategoryId(null);
          setMetricCategoryDraft(EMPTY_METRIC_CATEGORY_DRAFT);
        }}
        title={
          editingCategoryId ? "Edit Metric Category" : "Add Metric Category"
        }
        maxWidthClass="max-w-xl"
        footer={
          <ApprovalFooter
            onCancel={() => {
              setCategoryModalOpen(false);
              setEditingCategoryId(null);
              setMetricCategoryDraft(EMPTY_METRIC_CATEGORY_DRAFT);
            }}
            onConfirm={async () => {
              await handleApplyCategoryDraft();
              setCategoryModalOpen(false);
            }}
            confirmText={savingCategoryId ? "Updating..." : "Update Category"}
            confirmDisabled={Boolean(savingCategoryId)}
          />
        }
      >
        <div className="space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">Name</span>
            <input
              value={metricCategoryDraft.name}
              onChange={(event) =>
                setMetricCategoryDraft((prev) => ({
                  ...prev,
                  name: event.target.value,
                  code: toCode(event.target.value),
                }))
              }
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          {/* <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Behavior Type
            </span>
            <select
              value={metricCategoryDraft.behavior_type}
              onChange={(event) =>
                setMetricCategoryDraft((prev) => ({
                  ...prev,
                  behavior_type: event.target.value as OkrMetricCategory,
                }))
              }
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {METRIC_BEHAVIOR_TYPES.map((behavior) => (
                <option key={behavior} value={behavior}>
                  {titleize(behavior)}
                </option>
              ))}
            </select>
          </label> */}
          <label className="space-y-2 block">
            <span className="text-sm font-semibold text-gray-700">
              Description
            </span>
            <textarea
              value={metricCategoryDraft.description}
              onChange={(event) =>
                setMetricCategoryDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={2}
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>
      </ModalLayout>

      <ConfirmationModal
        isOpen={Boolean(categoryToDelete)}
        title="Delete Metric Category"
        message={`Are you sure you want to delete the metric category "${categoryToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Category"
        cancelText="Cancel"
        onConfirm={async () => {
          if (categoryToDelete) {
            await deleteMetricCategory(categoryToDelete.id);
            setCategoryToDelete(null);
          }
        }}
        onClose={() => setCategoryToDelete(null)}
        type="danger"
      />

      <ConfirmationModal
        isOpen={Boolean(metricToDelete)}
        title="Delete Metric"
        message={`Are you sure you want to delete the metric "${metricToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete Metric"
        cancelText="Cancel"
        onConfirm={async () => {
          if (metricToDelete) {
            await removeMetric(metricToDelete.id);
            setMetricToDelete(null);
          }
        }}
        onClose={() => setMetricToDelete(null)}
        type="danger"
      />
    </AdminLayout>
  );
}
