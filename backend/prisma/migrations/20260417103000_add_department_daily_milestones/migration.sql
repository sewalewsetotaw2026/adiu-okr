-- Add department daily milestones for department-level daily planning

CREATE TABLE "department_daily_milestone" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "department_weekly_plan_id" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(1000),
  "metric_definition_id" INTEGER,
  "target_value" DECIMAL(18,4),
  "current_value" DECIMAL(18,4),
  "progress_percent" DECIMAL(7,2),
  "final_score" DECIMAL(7,2),
  "final_value" DECIMAL(18,4),
  "confidence_level" "OkrConfidenceLevel",
  "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
  "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true,
  "status_code" VARCHAR(50) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_by" VARCHAR(20) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "department_daily_milestone_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "department_daily_milestone"
  ADD CONSTRAINT "department_daily_milestone_department_weekly_plan_id_fkey"
  FOREIGN KEY ("department_weekly_plan_id") REFERENCES "department_weekly_plan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_daily_milestone"
  ADD CONSTRAINT "department_daily_milestone_metric_definition_id_fkey"
  FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "department_daily_milestone_company_id_idx"
  ON "department_daily_milestone"("company_id");

CREATE INDEX "department_daily_milestone_department_weekly_plan_id_idx"
  ON "department_daily_milestone"("department_weekly_plan_id");

CREATE INDEX "department_daily_milestone_metric_definition_id_idx"
  ON "department_daily_milestone"("metric_definition_id");

CREATE INDEX "department_daily_milestone_company_id_status_code_idx"
  ON "department_daily_milestone"("company_id", "status_code");
