import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany();
  console.log("companies", companies);
  console.log(`Found ${companies.length} companies to seed OKR config for.`);

  for (const company of companies) {
    const companyId = company.id;
    console.log(
      `Seeding OKR Config for Company: ${company.name} (ID: ${companyId})`,
    );

    // 1. Create OKR Config Profiles
    const globalProfile = await prisma.okrConfigProfile.upsert({
      where: {
        company_id_name: {
          company_id: companyId,
          name: "Global Default Profile",
        },
      },
      update: {},
      create: {
        company_id: companyId,
        name: "Global Default Profile",
        scope_type: "GLOBAL",
        is_active: true,
        created_by: "system",
      },
    });

    // 2. Set Config Values
    const configs = [
      {
        key: "planning_approach",
        value: { options: ["TOP_DOWN", "BOTTOM_UP"], selected: "TOP_DOWN" },
        profileId: globalProfile.id,
      },
      {
        key: "planning_cadence_rules",
        value: {
          active_cadence: "MONTHLY",
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
        profileId: globalProfile.id,
      },
      {
        key: "level_configuration",
        value: {
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
          EMPLOYEE: {
            allow_monthly: true,
            allow_weekly: true,
            allow_daily: true,
          },
        },
        profileId: globalProfile.id,
      },
      {
        key: "additional_configuration",
        value: {
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
        profileId: globalProfile.id,
      },
      { key: "min_company_objectives", value: 2, profileId: globalProfile.id },
      { key: "max_company_objectives", value: 6, profileId: globalProfile.id },
      { key: "min_krs_per_objective", value: 2, profileId: globalProfile.id },
      { key: "max_krs_per_objective", value: 6, profileId: globalProfile.id },
      {
        key: "planning_cadence",
        value: { cadence: "MONTHLY" },
        profileId: globalProfile.id,
      },
      {
        key: "strict_sequence",
        value: { enabled: true },
        profileId: globalProfile.id,
      },
      {
        key: "parent_publish_required",
        value: { enabled: true },
        profileId: globalProfile.id,
      },
      {
        key: "weight_validation",
        value: { enabled: true },
        profileId: globalProfile.id,
      },
      {
        key: "monthly_plan_required",
        value: { enabled: true },
        profileId: globalProfile.id,
      },
      { key: "enable_weekly_plans", value: true, profileId: globalProfile.id },
      { key: "enable_daily_plans", value: false, profileId: globalProfile.id },
    ];

    for (const config of configs) {
      await prisma.okrConfigValue.upsert({
        where: {
          config_profile_id_config_key: {
            config_profile_id: config.profileId,
            config_key: config.key,
          },
        },
        update: {},
        create: {
          company_id: companyId,
          config_profile_id: config.profileId,
          config_key: config.key,
          config_value_json: config.value,
          value_type: "OBJECT",
        },
      });
    }

    // 3. Status Definitions & Transitions for both Company and Department
    const entityTypes: any[] = ["COMPANY_OBJECTIVE", "DEPARTMENT_OBJECTIVE"];
    const states = [
      { code: "draft", name: "Draft", initial: true },
      { code: "pending_approval", name: "Pending Approval" },
      { code: "approved", name: "Approved" },
      { code: "rejected", name: "Rejected" },
      { code: "published", name: "Published", terminal: true },
    ];

    for (const entityType of entityTypes) {
      for (const state of states) {
        await prisma.okrStatusDefinition.upsert({
          where: {
            company_id_entity_type_status_code: {
              company_id: companyId,
              entity_type: entityType,
              status_code: state.code,
            },
          },
          update: {},
          create: {
            company_id: companyId,
            entity_type: entityType,
            status_code: state.code,
            display_name: state.name,
            is_initial: state.initial || false,
            is_terminal: state.terminal || false,
          },
        });
      }

      const transitions = [
        { from: "draft", to: "pending_approval", approval: false },
        {
          from: "pending_approval",
          to: "published",
          approval: true,
          role: "Admin",
        },
        {
          from: "pending_approval",
          to: "rejected",
          approval: true,
          role: "Admin",
        },
        { from: "draft", to: "published", approval: false },
      ];

      for (const trans of transitions) {
        await prisma.okrStatusTransition.upsert({
          where: {
            company_id_entity_type_from_status_code_to_status_code: {
              company_id: companyId,
              entity_type: entityType,
              from_status_code: trans.from,
              to_status_code: trans.to,
            },
          },
          update: {},
          create: {
            company_id: companyId,
            entity_type: entityType,
            from_status_code: trans.from,
            to_status_code: trans.to,
            requires_approval: trans.approval,
            required_role: trans.role || null,
          },
        });
      }
    }
  }

  console.log("OKR Config Seeded for all companies.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
