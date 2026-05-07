-- =====================================================================
-- OKR PLANNING OVERHAUL — destructive migration
-- Drops legacy monthly/weekly/daily tables and the month_plan_item
-- bridge table; recreates them with the corrected parent relationships,
-- measurement fields, plan status lifecycle and weight tracking.
-- =====================================================================

-- 1. Drop legacy tables (CASCADE clears FKs from dependent tables).
DROP TABLE IF EXISTS "daily_plan" CASCADE;
DROP TABLE IF EXISTS "employee_month_plan_item" CASCADE;
DROP TABLE IF EXISTS "weekly_plan" CASCADE;
DROP TABLE IF EXISTS "employee_month_plan" CASCADE;

-- 2. Create new enums (drop first if leftover from a partial run).
DO $$ BEGIN
    CREATE TYPE "OkrPlanStatus" AS ENUM (
        'DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','PUBLISHED','REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OkrPlanAdoptionMode" AS ENUM ('DIRECT','DECOMPOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OkrDailyTaskStatus" AS ENUM (
        'PENDING','IN_PROGRESS','COMPLETED','SKIPPED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OkrWeightAllocationParent" AS ENUM ('KEY_RESULT','MONTHLY_PLAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "OkrWeightAllocationChild" AS ENUM ('MONTHLY_PLAN','WEEKLY_PLAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. okr_monthly_plans — child of EmployeeKeyResult.
CREATE TABLE "okr_monthly_plans" (
    "id"              SERIAL PRIMARY KEY,
    "company_id"      INTEGER NOT NULL,
    "cycle_id"        INTEGER NOT NULL,
    "employee_kr_id"  INTEGER NOT NULL,
    "owner_id"        VARCHAR(20) NOT NULL,
    "month_number"    INTEGER NOT NULL,
    "title"           VARCHAR(200) NOT NULL,
    "description"     VARCHAR(2000),
    "adoption_mode"   "OkrPlanAdoptionMode" NOT NULL DEFAULT 'DECOMPOSED',
    "weight_pct"      DECIMAL(7,2) NOT NULL DEFAULT 0,
    "start_value"     DECIMAL(18,4),
    "target_value"    DECIMAL(18,4),
    "current_value"   DECIMAL(18,4),
    "progress_pct"    DECIMAL(7,2),
    "contribute_to_score" BOOLEAN NOT NULL DEFAULT TRUE,
    "contribute_to_value" BOOLEAN NOT NULL DEFAULT TRUE,
    "plan_status"     "OkrPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at"    TIMESTAMP(3),
    "approved_at"     TIMESTAMP(3),
    "published_at"    TIMESTAMP(3),
    "reviewer_id"     VARCHAR(20),
    "rejection_note"  VARCHAR(2000),
    "submission_id"   INTEGER,
    "created_by"      VARCHAR(20) NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_monthly_plans_employee_kr_id_fkey"
        FOREIGN KEY ("employee_kr_id") REFERENCES "employee_key_result"("id") ON DELETE CASCADE,
    CONSTRAINT "okr_monthly_plans_submission_id_fkey"
        FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "okr_monthly_plans_employee_kr_id_month_number_key"
    ON "okr_monthly_plans"("employee_kr_id","month_number");
CREATE INDEX "okr_monthly_plans_company_id_idx"        ON "okr_monthly_plans"("company_id");
CREATE INDEX "okr_monthly_plans_cycle_id_idx"          ON "okr_monthly_plans"("cycle_id");
CREATE INDEX "okr_monthly_plans_owner_id_idx"          ON "okr_monthly_plans"("owner_id");
CREATE INDEX "okr_monthly_plans_month_number_idx"      ON "okr_monthly_plans"("month_number");
CREATE INDEX "okr_monthly_plans_employee_kr_id_idx"    ON "okr_monthly_plans"("employee_kr_id");
CREATE INDEX "okr_monthly_plans_submission_id_idx"     ON "okr_monthly_plans"("submission_id");
CREATE INDEX "okr_monthly_plans_company_id_plan_status_idx"
    ON "okr_monthly_plans"("company_id","plan_status");

-- 4. okr_weekly_plans — child of EmployeeMonthPlan.
CREATE TABLE "okr_weekly_plans" (
    "id"                     SERIAL PRIMARY KEY,
    "company_id"             INTEGER NOT NULL,
    "employee_month_plan_id" INTEGER NOT NULL,
    "owner_id"               VARCHAR(20) NOT NULL,
    "week_number"            INTEGER NOT NULL,
    "title"                  VARCHAR(200) NOT NULL,
    "metric_definition_id"   INTEGER,
    "adoption_mode"          "OkrPlanAdoptionMode" NOT NULL DEFAULT 'DECOMPOSED',
    "weight_pct"             DECIMAL(7,2) NOT NULL DEFAULT 0,
    "start_value"            DECIMAL(18,4),
    "target_value"           DECIMAL(18,4),
    "current_value"          DECIMAL(18,4),
    "progress_pct"           DECIMAL(7,2),
    "contribute_to_score"    BOOLEAN NOT NULL DEFAULT TRUE,
    "contribute_to_value"    BOOLEAN NOT NULL DEFAULT TRUE,
    "plan_status"            "OkrPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at"           TIMESTAMP(3),
    "approved_at"            TIMESTAMP(3),
    "published_at"           TIMESTAMP(3),
    "reviewer_id"            VARCHAR(20),
    "rejection_note"         VARCHAR(2000),
    "confidence_level"       "OkrConfidenceLevel",
    "blockers"               VARCHAR(2000),
    "submission_id"          INTEGER,
    "created_by"             VARCHAR(20) NOT NULL,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_weekly_plans_employee_month_plan_id_fkey"
        FOREIGN KEY ("employee_month_plan_id") REFERENCES "okr_monthly_plans"("id") ON DELETE CASCADE,
    CONSTRAINT "okr_weekly_plans_metric_definition_id_fkey"
        FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE SET NULL,
    CONSTRAINT "okr_weekly_plans_submission_id_fkey"
        FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "okr_weekly_plans_employee_month_plan_id_week_number_key"
    ON "okr_weekly_plans"("employee_month_plan_id","week_number");
CREATE INDEX "okr_weekly_plans_company_id_idx"             ON "okr_weekly_plans"("company_id");
CREATE INDEX "okr_weekly_plans_owner_id_idx"               ON "okr_weekly_plans"("owner_id");
CREATE INDEX "okr_weekly_plans_employee_month_plan_id_idx" ON "okr_weekly_plans"("employee_month_plan_id");
CREATE INDEX "okr_weekly_plans_metric_definition_id_idx"   ON "okr_weekly_plans"("metric_definition_id");
CREATE INDEX "okr_weekly_plans_submission_id_idx"          ON "okr_weekly_plans"("submission_id");
CREATE INDEX "okr_weekly_plans_company_id_week_number_plan_status_idx"
    ON "okr_weekly_plans"("company_id","week_number","plan_status");

-- 5. okr_daily_plans — child of WeeklyPlan. NOTE: no weekly_task_ref.
CREATE TABLE "okr_daily_plans" (
    "id"                     SERIAL PRIMARY KEY,
    "company_id"             INTEGER NOT NULL,
    "weekly_plan_id"         INTEGER NOT NULL,
    "owner_id"               VARCHAR(20) NOT NULL,
    "completion_day"         "OkrWeekDay" NOT NULL,
    "title"                  VARCHAR(200) NOT NULL,
    "description"            VARCHAR(1000),
    "metric_definition_id"   INTEGER,
    "start_value"            DECIMAL(18,4),
    "target_value"           DECIMAL(18,4),
    "current_value"          DECIMAL(18,4),
    "progress_pct"           DECIMAL(7,2),
    "status"                 "OkrDailyTaskStatus" NOT NULL DEFAULT 'PENDING',
    "contribute_to_score"    BOOLEAN NOT NULL DEFAULT TRUE,
    "contribute_to_value"    BOOLEAN NOT NULL DEFAULT TRUE,
    "notes"                  VARCHAR(2000),
    "confidence_level"       "OkrConfidenceLevel",
    "completed_at"           TIMESTAMP(3),
    "created_by"             VARCHAR(20) NOT NULL,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_daily_plans_weekly_plan_id_fkey"
        FOREIGN KEY ("weekly_plan_id") REFERENCES "okr_weekly_plans"("id") ON DELETE CASCADE,
    CONSTRAINT "okr_daily_plans_metric_definition_id_fkey"
        FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE SET NULL
);

CREATE INDEX "okr_daily_plans_company_id_idx"           ON "okr_daily_plans"("company_id");
CREATE INDEX "okr_daily_plans_owner_id_idx"             ON "okr_daily_plans"("owner_id");
CREATE INDEX "okr_daily_plans_weekly_plan_id_idx"       ON "okr_daily_plans"("weekly_plan_id");
CREATE INDEX "okr_daily_plans_metric_definition_id_idx" ON "okr_daily_plans"("metric_definition_id");
CREATE INDEX "okr_daily_plans_company_id_status_idx"    ON "okr_daily_plans"("company_id","status");

-- 6. okr_weight_allocations — single source of truth for decomposition weight.
CREATE TABLE "okr_weight_allocations" (
    "id"          SERIAL PRIMARY KEY,
    "company_id"  INTEGER NOT NULL,
    "parent_id"   INTEGER NOT NULL,
    "parent_type" "OkrWeightAllocationParent" NOT NULL,
    "child_id"    INTEGER NOT NULL,
    "child_type"  "OkrWeightAllocationChild" NOT NULL,
    "weight_pct"  DECIMAL(7,2) NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "okr_weight_allocations_uniq"
    ON "okr_weight_allocations"("parent_type","parent_id","child_type","child_id");
CREATE INDEX "okr_weight_allocations_parent_idx"
    ON "okr_weight_allocations"("parent_type","parent_id");
CREATE INDEX "okr_weight_allocations_child_idx"
    ON "okr_weight_allocations"("child_type","child_id");
CREATE INDEX "okr_weight_allocations_company_id_idx"
    ON "okr_weight_allocations"("company_id");
