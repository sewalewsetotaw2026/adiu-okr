-- Add measurable metric fields to department and employee planning/execution layers

-- Department month plans
ALTER TABLE "department_month_plan"
  ADD COLUMN "metric_definition_id" INTEGER,
  ADD COLUMN "target_value" DECIMAL(18,4),
  ADD COLUMN "current_value" DECIMAL(18,4),
  ADD COLUMN "final_score" DECIMAL(7,2),
  ADD COLUMN "final_value" DECIMAL(18,4),
  ADD COLUMN "confidence_level" "OkrConfidenceLevel",
  ADD COLUMN "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "department_month_plan"
  ADD CONSTRAINT "department_month_plan_metric_definition_id_fkey"
  FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "department_month_plan_metric_definition_id_idx"
  ON "department_month_plan"("metric_definition_id");

-- Department weekly plans
ALTER TABLE "department_weekly_plan"
  ADD COLUMN "metric_definition_id" INTEGER,
  ADD COLUMN "target_value" DECIMAL(18,4),
  ADD COLUMN "current_value" DECIMAL(18,4),
  ADD COLUMN "final_score" DECIMAL(7,2),
  ADD COLUMN "final_value" DECIMAL(18,4),
  ADD COLUMN "confidence_level" "OkrConfidenceLevel",
  ADD COLUMN "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "department_weekly_plan"
  ADD CONSTRAINT "department_weekly_plan_metric_definition_id_fkey"
  FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "department_weekly_plan_metric_definition_id_idx"
  ON "department_weekly_plan"("metric_definition_id");

-- Employee month plans
ALTER TABLE "employee_month_plan"
  ADD COLUMN "metric_definition_id" INTEGER,
  ADD COLUMN "target_value" DECIMAL(18,4),
  ADD COLUMN "current_value" DECIMAL(18,4),
  ADD COLUMN "final_score" DECIMAL(7,2),
  ADD COLUMN "final_value" DECIMAL(18,4),
  ADD COLUMN "confidence_level" "OkrConfidenceLevel",
  ADD COLUMN "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "employee_month_plan"
  ADD CONSTRAINT "employee_month_plan_metric_definition_id_fkey"
  FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "employee_month_plan_metric_definition_id_idx"
  ON "employee_month_plan"("metric_definition_id");

-- Weekly plans
ALTER TABLE "weekly_plan"
  ADD COLUMN "metric_definition_id" INTEGER,
  ADD COLUMN "target_value" DECIMAL(18,4),
  ADD COLUMN "current_value" DECIMAL(18,4),
  ADD COLUMN "final_score" DECIMAL(7,2),
  ADD COLUMN "final_value" DECIMAL(18,4),
  ADD COLUMN "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "weekly_plan"
  ADD CONSTRAINT "weekly_plan_metric_definition_id_fkey"
  FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "weekly_plan_metric_definition_id_idx"
  ON "weekly_plan"("metric_definition_id");

-- Subtasks
ALTER TABLE "subtask"
  ADD COLUMN "metric_definition_id" INTEGER,
  ADD COLUMN "target_value" DECIMAL(18,4),
  ADD COLUMN "current_value" DECIMAL(18,4),
  ADD COLUMN "progress_percent" DECIMAL(7,2),
  ADD COLUMN "final_score" DECIMAL(7,2),
  ADD COLUMN "final_value" DECIMAL(18,4),
  ADD COLUMN "confidence_level" "OkrConfidenceLevel",
  ADD COLUMN "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "subtask"
  ADD CONSTRAINT "subtask_metric_definition_id_fkey"
  FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "subtask_metric_definition_id_idx"
  ON "subtask"("metric_definition_id");

-- Milestones
ALTER TABLE "milestone"
  ADD COLUMN "metric_definition_id" INTEGER,
  ADD COLUMN "target_value" DECIMAL(18,4),
  ADD COLUMN "current_value" DECIMAL(18,4),
  ADD COLUMN "progress_percent" DECIMAL(7,2),
  ADD COLUMN "final_score" DECIMAL(7,2),
  ADD COLUMN "final_value" DECIMAL(18,4),
  ADD COLUMN "confidence_level" "OkrConfidenceLevel",
  ADD COLUMN "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "milestone"
  ADD CONSTRAINT "milestone_metric_definition_id_fkey"
  FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "milestone_metric_definition_id_idx"
  ON "milestone"("metric_definition_id");
