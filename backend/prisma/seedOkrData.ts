import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const COMPANY_ID = 2; // Kacha company

const ENTITY_TYPES = [
  "CYCLE",
  "COMPANY_OBJECTIVE",
  "COMPANY_KR",
  "WEEKLY_PLAN",
] as const;

type EntityType = (typeof ENTITY_TYPES)[number];

interface StatusDef {
  status_code: string;
  display_name: string;
  is_initial: boolean;
  is_terminal: boolean;
  sort_order: number;
}

const STATUS_DEFINITIONS: StatusDef[] = [
  {
    status_code: "draft",
    display_name: "Draft",
    is_initial: true,
    is_terminal: false,
    sort_order: 1,
  },
  {
    status_code: "submitted",
    display_name: "Submitted",
    is_initial: false,
    is_terminal: false,
    sort_order: 2,
  },
  {
    status_code: "approved",
    display_name: "Approved",
    is_initial: false,
    is_terminal: false,
    sort_order: 3,
  },
  {
    status_code: "published",
    display_name: "Published",
    is_initial: false,
    is_terminal: false,
    sort_order: 4,
  },
  {
    status_code: "in_progress",
    display_name: "In Progress",
    is_initial: false,
    is_terminal: false,
    sort_order: 5,
  },
  {
    status_code: "blocked",
    display_name: "Blocked",
    is_initial: false,
    is_terminal: false,
    sort_order: 6,
  },
  {
    status_code: "completed",
    display_name: "Completed",
    is_initial: false,
    is_terminal: true,
    sort_order: 7,
  },
  {
    status_code: "archived",
    display_name: "Archived",
    is_initial: false,
    is_terminal: true,
    sort_order: 8,
  },
];

interface Transition {
  from: string;
  to: string;
  requires_approval: boolean;
  required_role?: string;
}

const BASE_TRANSITIONS: Transition[] = [
  { from: "draft", to: "submitted", requires_approval: false },
  {
    from: "submitted",
    to: "approved",
    requires_approval: true,
    required_role: "HR",
  },
  { from: "submitted", to: "draft", requires_approval: false },
  { from: "approved", to: "published", requires_approval: false },
  { from: "approved", to: "draft", requires_approval: false },
  { from: "published", to: "in_progress", requires_approval: false },
  { from: "in_progress", to: "blocked", requires_approval: false },
  { from: "blocked", to: "in_progress", requires_approval: false },
  { from: "in_progress", to: "completed", requires_approval: false },
  { from: "completed", to: "archived", requires_approval: false },
];

interface MetricDef {
  code: string;
  name: string;
  category:
    | "CURRENCY"
    | "PERCENTAGE"
    | "BINARY"
    | "MILESTONE"
    | "NUMERIC"
    | "RATING";
  unit_of_measure: string | null;
  is_financial: boolean;
  requires_target_value: boolean;
  allows_binary_completion: boolean;
}

const METRIC_DEFINITIONS: MetricDef[] = [
  {
    code: "ETB_CURRENCY",
    name: "Ethiopian Birr (Currency)",
    category: "CURRENCY",
    unit_of_measure: "ETB",
    is_financial: true,
    requires_target_value: true,
    allows_binary_completion: false,
  },
  {
    code: "PERCENTAGE",
    name: "Percentage",
    category: "PERCENTAGE",
    unit_of_measure: "%",
    is_financial: false,
    requires_target_value: true,
    allows_binary_completion: false,
  },
  {
    code: "BINARY",
    name: "Binary (Yes/No)",
    category: "BINARY",
    unit_of_measure: null,
    is_financial: false,
    requires_target_value: false,
    allows_binary_completion: true,
  },
  {
    code: "MILESTONE",
    name: "Milestone",
    category: "MILESTONE",
    unit_of_measure: null,
    is_financial: false,
    requires_target_value: false,
    allows_binary_completion: false,
  },
  {
    code: "NUMERIC",
    name: "Numeric Count",
    category: "NUMERIC",
    unit_of_measure: null,
    is_financial: false,
    requires_target_value: true,
    allows_binary_completion: false,
  },
  {
    code: "RATING",
    name: "Rating Scale",
    category: "RATING",
    unit_of_measure: null,
    is_financial: false,
    requires_target_value: true,
    allows_binary_completion: false,
  },
];

interface ConfigValue {
  config_key: string;
  config_value_json: any;
  value_type: string;
}

const SEEDED_STATUS_DEFINITIONS = [
  {
    entity_type: "COMPANY_OBJECTIVE",
    status_code: "DRAFT",
    display_name: "Draft",
    is_initial: true,
    is_terminal: false,
    sort_order: 1,
    is_active: true,
  },
  {
    entity_type: "COMPANY_OBJECTIVE",
    status_code: "IN_PROGRESS",
    display_name: "In Progress",
    is_initial: false,
    is_terminal: false,
    sort_order: 2,
    is_active: true,
  },
  {
    entity_type: "COMPANY_OBJECTIVE",
    status_code: "COMPLETED",
    display_name: "Completed",
    is_initial: false,
    is_terminal: true,
    sort_order: 3,
    is_active: true,
  },
];

const SEEDED_STATUS_TRANSITIONS = [
  {
    entity_type: "COMPANY_OBJECTIVE",
    from_status_code: "DRAFT",
    to_status_code: "IN_PROGRESS",
    requires_approval: false,
    required_role: "",
    is_active: true,
  },
  {
    entity_type: "COMPANY_OBJECTIVE",
    from_status_code: "IN_PROGRESS",
    to_status_code: "COMPLETED",
    requires_approval: true,
    required_role: "MANAGER",
    is_active: true,
  },
];

const SEEDED_PROFILE_DEFINITIONS = [
  {
    name: "Executive planning",
    scope_type: "ORGANIZATION",
    description:
      "Use this profile for leadership goal setting and company-level reviews.",
    assignment: "Leadership team",
    access_level: "Can create and approve goals",
    sync_frequency: "Monthly",
    is_active: true,
  },
  {
    name: "Team execution",
    scope_type: "DEPARTMENT",
    description:
      "Use this profile for department and squad execution planning.",
    assignment: "Department managers",
    access_level: "Can update and track progress",
    sync_frequency: "Weekly",
    is_active: true,
  },
];

const SEEDED_FEATURE_FLAGS = [
  {
    feature_name: "Weekly planning",
    scope_type: "GLOBAL",
    description: "Lets teams break down goals into weekly work plans.",
    target_audience: "All teams",
    impact_radius: "Company-wide",
    is_enabled: true,
  },
  {
    feature_name: "Progress reminders",
    scope_type: "ROLE",
    description: "Sends reminders so owners update progress regularly.",
    target_audience: "Goal owners",
    impact_radius: "Managers and contributors",
    is_enabled: true,
  },
];

const CONFIG_VALUES: ConfigValue[] = [
  {
    config_key: "max_company_objectives",
    config_value_json: 6,
    value_type: "integer",
  },
  {
    config_key: "min_company_objectives",
    config_value_json: 2,
    value_type: "integer",
  },
  {
    config_key: "max_krs_per_objective",
    config_value_json: 6,
    value_type: "integer",
  },
  {
    config_key: "min_krs_per_objective",
    config_value_json: 2,
    value_type: "integer",
  },
  {
    config_key: "require_weight_sum_100",
    config_value_json: true,
    value_type: "boolean",
  },
  {
    config_key: "allow_self_assignment",
    config_value_json: false,
    value_type: "boolean",
  },
  {
    config_key: "planning_approach",
    config_value_json: {
      options: ["TOP_DOWN", "BOTTOM_UP"],
      selected: "TOP_DOWN",
    },
    value_type: "object",
  },
  {
    config_key: "planning_cadence_rules",
    config_value_json: {
      active_cadence: "MONTHLY",
      rules: {
        MONTHLY: {
          allow_monthly: true,
          allow_weekly: false,
          allow_daily: false,
        },
        WEEKLY: { allow_monthly: true, allow_weekly: true, allow_daily: false },
        DAILY: { allow_monthly: true, allow_weekly: true, allow_daily: true },
      },
    },
    value_type: "object",
  },
  {
    config_key: "planning_cadence",
    config_value_json: { cadence: "MONTHLY" },
    value_type: "object",
  },
  {
    config_key: "level_configuration",
    config_value_json: {
      CEO: { allow_monthly: true, allow_weekly: false, allow_daily: false },
      DIRECTOR: {
        allow_monthly: true,
        allow_weekly: false,
        allow_daily: false,
      },
      MANAGER_TEAM_LEADER: {
        allow_monthly: true,
        allow_weekly: true,
        allow_daily: true,
      },
      EMPLOYEE: { allow_monthly: true, allow_weekly: true, allow_daily: true },
    },
    value_type: "object",
  },
  {
    config_key: "additional_configuration",
    config_value_json: {
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
      allowed_objectives: { min: 2, max: 6 },
      allowed_krs: { min: 2, max: 6 },
    },
    value_type: "object",
  },
  {
    config_key: "allowed_late_time",
    config_value_json: {
      annual_plan_minutes: 120,
      quarterly_plan_minutes: 90,
      monthly_plan_minutes: 60,
      weekly_plan_minutes: 30,
      daily_plan_minutes: 15,
      progress_update_minutes: 10,
    },
    value_type: "object",
  },
  {
    config_key: "confidence_level_mapping",
    config_value_json: {
      off_track_lte_percent: 50,
      on_track_gte_percent: 60,
      at_risk_lte_percent: 40,
    },
    value_type: "object",
  },
  {
    config_key: "require_approval_for_publish",
    config_value_json: true,
    value_type: "boolean",
  },
  {
    config_key: "max_months_per_quarter",
    config_value_json: 3,
    value_type: "integer",
  },
  {
    config_key: "enable_weekly_plans",
    config_value_json: true,
    value_type: "boolean",
  },
  {
    config_key: "enable_daily_plans",
    config_value_json: false,
    value_type: "boolean",
  },
  {
    config_key: "status_definitions",
    config_value_json: SEEDED_STATUS_DEFINITIONS,
    value_type: "array",
  },
  {
    config_key: "status_transitions",
    config_value_json: SEEDED_STATUS_TRANSITIONS,
    value_type: "array",
  },
  {
    config_key: "profile_definitions",
    config_value_json: SEEDED_PROFILE_DEFINITIONS,
    value_type: "array",
  },
  {
    config_key: "feature_flags",
    config_value_json: SEEDED_FEATURE_FLAGS,
    value_type: "array",
  },
];

async function seedOkrData() {
  console.log("=== Seeding OKR Master Data ===");
  console.log(`Company ID: ${COMPANY_ID}\n`);

  // 1. Status Definitions
  console.log("--- Seeding Status Definitions ---");
  let statusCount = 0;
  for (const entityType of ENTITY_TYPES) {
    for (const status of STATUS_DEFINITIONS) {
      await prisma.okrStatusDefinition.upsert({
        where: {
          company_id_entity_type_status_code: {
            company_id: COMPANY_ID,
            entity_type: entityType,
            status_code: status.status_code,
          },
        },
        update: {
          display_name: status.display_name,
          is_initial: status.is_initial,
          is_terminal: status.is_terminal,
          sort_order: status.sort_order,
        },
        create: {
          company_id: COMPANY_ID,
          entity_type: entityType,
          status_code: status.status_code,
          display_name: status.display_name,
          is_initial: status.is_initial,
          is_terminal: status.is_terminal,
          sort_order: status.sort_order,
        },
      });
      statusCount++;
    }
  }
  console.log(
    `  ✅ Created ${statusCount} status definitions across ${ENTITY_TYPES.length} entity types`,
  );

  // 2. Status Transitions
  console.log("\n--- Seeding Status Transitions ---");
  let transitionCount = 0;
  for (const entityType of ENTITY_TYPES) {
    for (const t of BASE_TRANSITIONS) {
      await prisma.okrStatusTransition.upsert({
        where: {
          company_id_entity_type_from_status_code_to_status_code: {
            company_id: COMPANY_ID,
            entity_type: entityType,
            from_status_code: t.from,
            to_status_code: t.to,
          },
        },
        update: {
          requires_approval: t.requires_approval,
          required_role: t.required_role || null,
        },
        create: {
          company_id: COMPANY_ID,
          entity_type: entityType,
          from_status_code: t.from,
          to_status_code: t.to,
          requires_approval: t.requires_approval,
          required_role: t.required_role || null,
        },
      });
      transitionCount++;
    }
  }
  console.log(`  ✅ Created ${transitionCount} status transitions`);

  // 3. Metric Definitions
  console.log("\n--- Seeding Metric Definitions ---");
  for (const metric of METRIC_DEFINITIONS) {
    await prisma.okrMetricDefinition.upsert({
      where: {
        company_id_code: {
          company_id: COMPANY_ID,
          code: metric.code,
        },
      },
      update: {
        name: metric.name,
        category: metric.category,
        unit_of_measure: metric.unit_of_measure,
        is_financial: metric.is_financial,
        requires_target_value: metric.requires_target_value,
        allows_binary_completion: metric.allows_binary_completion,
      },
      create: {
        company_id: COMPANY_ID,
        code: metric.code,
        name: metric.name,
        category: metric.category,
        unit_of_measure: metric.unit_of_measure,
        is_financial: metric.is_financial,
        requires_target_value: metric.requires_target_value,
        allows_binary_completion: metric.allows_binary_completion,
      },
    });
    console.log(`  ✅ ${metric.code} — ${metric.name}`);
  }

  // 4. Base Config Profile
  console.log("\n--- Seeding Base Config Profile ---");
  const profile = await prisma.okrConfigProfile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      company_id: COMPANY_ID,
      name: "Default OKR Configuration",
      scope_type: "GLOBAL",
      description:
        "Base configuration for OKR module. Applied globally unless overridden.",
      created_by: "system",
    },
  });

  for (const cv of CONFIG_VALUES) {
    await prisma.okrConfigValue.upsert({
      where: {
        config_profile_id_config_key: {
          config_profile_id: profile.id,
          config_key: cv.config_key,
        },
      },
      update: {
        config_value_json: cv.config_value_json,
        value_type: cv.value_type,
      },
      create: {
        company_id: COMPANY_ID,
        config_profile_id: profile.id,
        config_key: cv.config_key,
        config_value_json: cv.config_value_json,
        value_type: cv.value_type,
      },
    });
  }
  console.log(
    `  ✅ Created config profile with ${CONFIG_VALUES.length} values`,
  );

  // 5. Config Assignment (global)
  await prisma.okrConfigAssignment.upsert({
    where: { id: 1 },
    update: {},
    create: {
      company_id: COMPANY_ID,
      config_profile_id: profile.id,
      priority: 0,
      is_active: true,
    },
  });
  console.log("  ✅ Created global config assignment");

  console.log("\n🎉 OKR master data seeding complete!");
}

seedOkrData()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
