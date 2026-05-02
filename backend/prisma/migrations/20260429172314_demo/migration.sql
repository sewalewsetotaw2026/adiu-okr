/*
  Warnings:

  - The values [DEPARTMENT_OBJECTIVE,DEPARTMENT_KR,DEPARTMENT_MONTH_PLAN,DEPARTMENT_WEEKLY_PLAN,MILESTONE] on the enum `OkrEntityType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `final_value` on the `company_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `owner_department_id` on the `company_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `final_value` on the `company_objective` table. All the data in the column will be lost.
  - You are about to drop the column `final_value` on the `employee_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `confidence_level` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `contributes_to_parent_score` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `contributes_to_parent_value` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `employee_kr_id` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `final_value` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `metric_definition_id` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `final_value` on the `employee_objective` table. All the data in the column will be lost.
  - You are about to drop the column `departmentKeyResultId` on the `okr_comment` table. All the data in the column will be lost.
  - You are about to drop the column `departmentObjectiveId` on the `okr_comment` table. All the data in the column will be lost.
  - You are about to drop the column `final_value` on the `subtask` table. All the data in the column will be lost.
  - You are about to drop the column `final_value` on the `weekly_plan` table. All the data in the column will be lost.
  - You are about to drop the `department_daily_milestone` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `department_key_result` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `department_month_plan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `department_objective` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `department_weekly_plan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `milestone` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[employee_id]` on the table `app_user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[month_number,employee_objective_id]` on the table `employee_month_plan` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[company_kr_id,employee_kr_id,user_id]` on the table `kr_contributor` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `employee_objective_id` to the `employee_month_plan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `employee_month_plan` table without a default value. This is not possible if the table is not empty.
  - Made the column `employee_month_plan_id` on table `weekly_plan` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "OkrSubmissionType" AS ENUM ('OBJECTIVE_PLANNING', 'MONTHLY_PLAN', 'WEEKLY_PLAN');

-- AlterEnum
BEGIN;
CREATE TYPE "OkrEntityType_new" AS ENUM ('CYCLE', 'COMPANY_OBJECTIVE', 'COMPANY_KR', 'KR_CONTRIBUTOR', 'EMPLOYEE_OBJECTIVE', 'EMPLOYEE_KR', 'EMPLOYEE_MONTH_PLAN', 'EMPLOYEE_MONTH_PLAN_ITEM', 'MANAGER_MONTH_PLAN', 'MANAGER_MONTH_PLAN_ITEM', 'MANAGER_WEEKLY_PLAN', 'WEEKLY_PLAN', 'SUBTASK', 'DAILY_PLAN', 'PROGRESS_UPDATE', 'ARCHIVE', 'EXPORT', 'SUBMISSION');
ALTER TABLE "okr_status_definition" ALTER COLUMN "entity_type" TYPE "OkrEntityType_new" USING ("entity_type"::text::"OkrEntityType_new");
ALTER TABLE "okr_status_transition" ALTER COLUMN "entity_type" TYPE "OkrEntityType_new" USING ("entity_type"::text::"OkrEntityType_new");
ALTER TABLE "okr_config_snapshot" ALTER COLUMN "entity_type" TYPE "OkrEntityType_new" USING ("entity_type"::text::"OkrEntityType_new");
ALTER TABLE "okr_approval_log" ALTER COLUMN "entity_type" TYPE "OkrEntityType_new" USING ("entity_type"::text::"OkrEntityType_new");
ALTER TABLE "okr_activity_log" ALTER COLUMN "entity_type" TYPE "OkrEntityType_new" USING ("entity_type"::text::"OkrEntityType_new");
ALTER TABLE "okr_audit_log" ALTER COLUMN "entity_type" TYPE "OkrEntityType_new" USING ("entity_type"::text::"OkrEntityType_new");
ALTER TABLE "okr_score_snapshot" ALTER COLUMN "entity_type" TYPE "OkrEntityType_new" USING ("entity_type"::text::"OkrEntityType_new");
ALTER TABLE "okr_comment" ALTER COLUMN "entity_type" TYPE "OkrEntityType_new" USING ("entity_type"::text::"OkrEntityType_new");
ALTER TYPE "OkrEntityType" RENAME TO "OkrEntityType_old";
ALTER TYPE "OkrEntityType_new" RENAME TO "OkrEntityType";
DROP TYPE "OkrEntityType_old";
COMMIT;

-- AlterEnum
ALTER TYPE "OkrPlanningCadence" ADD VALUE 'DAILY';

-- DropForeignKey
ALTER TABLE "company_key_result" DROP CONSTRAINT "company_key_result_owner_department_id_fkey";

-- DropForeignKey
ALTER TABLE "department_daily_milestone" DROP CONSTRAINT "department_daily_milestone_department_weekly_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "department_daily_milestone" DROP CONSTRAINT "department_daily_milestone_metric_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "department_key_result" DROP CONSTRAINT "department_key_result_department_objective_id_fkey";

-- DropForeignKey
ALTER TABLE "department_key_result" DROP CONSTRAINT "department_key_result_metric_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "department_month_plan" DROP CONSTRAINT "department_month_plan_department_kr_id_fkey";

-- DropForeignKey
ALTER TABLE "department_month_plan" DROP CONSTRAINT "department_month_plan_metric_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "department_objective" DROP CONSTRAINT "department_objective_company_kr_id_fkey";

-- DropForeignKey
ALTER TABLE "department_objective" DROP CONSTRAINT "department_objective_cycle_id_fkey";

-- DropForeignKey
ALTER TABLE "department_objective" DROP CONSTRAINT "department_objective_department_id_fkey";

-- DropForeignKey
ALTER TABLE "department_weekly_plan" DROP CONSTRAINT "department_weekly_plan_department_kr_id_fkey";

-- DropForeignKey
ALTER TABLE "department_weekly_plan" DROP CONSTRAINT "department_weekly_plan_metric_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_month_plan" DROP CONSTRAINT "employee_month_plan_employee_kr_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_month_plan" DROP CONSTRAINT "employee_month_plan_metric_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_objective" DROP CONSTRAINT "employee_objective_chosen_parent_kr_id_fkey";

-- DropForeignKey
ALTER TABLE "kr_contributor" DROP CONSTRAINT "kr_contributor_department_kr_id_fkey";

-- DropForeignKey
ALTER TABLE "milestone" DROP CONSTRAINT "milestone_metric_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "milestone" DROP CONSTRAINT "milestone_weekly_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "okr_comment" DROP CONSTRAINT "okr_comment_departmentKeyResultId_fkey";

-- DropForeignKey
ALTER TABLE "okr_comment" DROP CONSTRAINT "okr_comment_departmentObjectiveId_fkey";

-- DropForeignKey
ALTER TABLE "weekly_plan" DROP CONSTRAINT "weekly_plan_employee_month_plan_id_fkey";

-- DropIndex
DROP INDEX "employee_month_plan_company_id_month_number_status_code_idx";

-- DropIndex
DROP INDEX "employee_month_plan_employee_kr_id_idx";

-- DropIndex
DROP INDEX "employee_month_plan_employee_kr_id_month_number_key";

-- DropIndex
DROP INDEX "employee_month_plan_metric_definition_id_idx";

-- DropIndex
DROP INDEX "kr_contributor_department_kr_id_idx";

-- DropIndex
DROP INDEX "kr_contributor_department_kr_id_user_id_key";

-- DropIndex
DROP INDEX "weekly_plan_employee_kr_id_week_number_key";

-- AlterTable
ALTER TABLE "company_key_result" DROP COLUMN "final_value",
DROP COLUMN "owner_department_id",
ADD COLUMN     "current_value" DECIMAL(18,4),
ADD COLUMN     "progress_percent" DECIMAL(7,2),
ADD COLUMN     "submission_id" INTEGER;

-- AlterTable
ALTER TABLE "company_objective" DROP COLUMN "final_value",
ADD COLUMN     "current_value" DECIMAL(18,4),
ADD COLUMN     "progress_percent" DECIMAL(7,2),
ADD COLUMN     "submission_id" INTEGER,
ADD COLUMN     "target_value" DECIMAL(18,4);

-- AlterTable
ALTER TABLE "department" ADD COLUMN     "head_user_id" INTEGER;

-- AlterTable
ALTER TABLE "employee_cost_sharing" ADD COLUMN     "remaining_cost" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "employee_key_result" DROP COLUMN "final_value",
ADD COLUMN     "current_value" DECIMAL(18,4),
ADD COLUMN     "progress_percent" DECIMAL(7,2),
ADD COLUMN     "submission_id" INTEGER;

-- AlterTable
ALTER TABLE "employee_month_plan" DROP COLUMN "confidence_level",
DROP COLUMN "contributes_to_parent_score",
DROP COLUMN "contributes_to_parent_value",
DROP COLUMN "employee_kr_id",
DROP COLUMN "final_value",
DROP COLUMN "metric_definition_id",
ADD COLUMN     "employee_objective_id" INTEGER NOT NULL,
ADD COLUMN     "indirect_score" DECIMAL(7,2),
ADD COLUMN     "indirect_value" DECIMAL(18,4),
ADD COLUMN     "is_manager_plan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "progress_percent" DECIMAL(7,2),
ADD COLUMN     "submission_id" INTEGER,
ADD COLUMN     "title" VARCHAR(200) NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "employee_objective" DROP COLUMN "final_value",
ADD COLUMN     "chosen_parent_employee_kr_id" INTEGER,
ADD COLUMN     "current_value" DECIMAL(18,4),
ADD COLUMN     "department_id" INTEGER,
ADD COLUMN     "progress_percent" DECIMAL(7,2),
ADD COLUMN     "submission_id" INTEGER,
ADD COLUMN     "target_value" DECIMAL(18,4),
ALTER COLUMN "chosen_parent_kr_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "kr_contributor" ADD COLUMN     "company_kr_id" INTEGER,
ADD COLUMN     "employee_kr_id" INTEGER,
ALTER COLUMN "department_kr_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "okr_comment" DROP COLUMN "departmentKeyResultId",
DROP COLUMN "departmentObjectiveId";

-- AlterTable
ALTER TABLE "progress_update" ADD COLUMN     "completion_day" "OkrWeekDay",
ADD COLUMN     "daily_plan_id" INTEGER;

-- AlterTable
ALTER TABLE "subtask" DROP COLUMN "final_value",
ADD COLUMN     "indirect_score" DECIMAL(7,2),
ADD COLUMN     "indirect_value" DECIMAL(18,4),
ADD COLUMN     "weight_percent" DECIMAL(7,2);

-- AlterTable
ALTER TABLE "weekly_plan" DROP COLUMN "final_value",
ADD COLUMN     "approved_by" VARCHAR(20),
ADD COLUMN     "employee_month_plan_item_id" INTEGER,
ADD COLUMN     "indirect_score" DECIMAL(7,2),
ADD COLUMN     "indirect_value" DECIMAL(18,4),
ADD COLUMN     "parent_weekly_plan_id" INTEGER,
ADD COLUMN     "parent_weekly_task_id" INTEGER,
ADD COLUMN     "progress_percent" DECIMAL(7,2),
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "published_by" VARCHAR(20),
ADD COLUMN     "submission_id" INTEGER,
ADD COLUMN     "title" VARCHAR(200),
ADD COLUMN     "weight_percent" DECIMAL(7,2),
ALTER COLUMN "employee_month_plan_id" SET NOT NULL;

-- DropTable
DROP TABLE "department_daily_milestone";

-- DropTable
DROP TABLE "department_key_result";

-- DropTable
DROP TABLE "department_month_plan";

-- DropTable
DROP TABLE "department_objective";

-- DropTable
DROP TABLE "department_weekly_plan";

-- DropTable
DROP TABLE "milestone";

-- CreateTable
CREATE TABLE "okr_submission" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "submitter_id" VARCHAR(20) NOT NULL,
    "reviewer_id" VARCHAR(20),
    "department_id" INTEGER,
    "status" VARCHAR(50) NOT NULL,
    "type" "OkrSubmissionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_month_plan_item" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_month_plan_id" INTEGER NOT NULL,
    "employee_kr_id" INTEGER NOT NULL,
    "metric_definition_id" INTEGER,
    "parent_employee_month_plan_item_id" INTEGER,
    "title" VARCHAR(200) NOT NULL DEFAULT 'Untitled',
    "target_value" DECIMAL(18,4) NOT NULL,
    "current_value" DECIMAL(18,4),
    "note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_month_plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_task" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "weekly_plan_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "status_code" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_plan" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "weekly_task_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "weekly_task_ref" VARCHAR(200),
    "completion_day" "OkrWeekDay",
    "description" VARCHAR(1000),
    "metric_definition_id" INTEGER,
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "weight_percent" DECIMAL(7,2),
    "progress_percent" DECIMAL(7,2),
    "final_score" DECIMAL(7,2),
    "confidence_level" "OkrConfidenceLevel",
    "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
    "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true,
    "approved_by" VARCHAR(20),
    "published_by" VARCHAR(20),
    "published_at" TIMESTAMP(3),
    "indirect_score" DECIMAL(7,2),
    "indirect_value" DECIMAL(18,4),
    "status_code" VARCHAR(50) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_by" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "okr_submission_company_id_idx" ON "okr_submission"("company_id");

-- CreateIndex
CREATE INDEX "okr_submission_cycle_id_idx" ON "okr_submission"("cycle_id");

-- CreateIndex
CREATE INDEX "okr_submission_submitter_id_idx" ON "okr_submission"("submitter_id");

-- CreateIndex
CREATE INDEX "okr_submission_status_idx" ON "okr_submission"("status");

-- CreateIndex
CREATE INDEX "employee_month_plan_item_company_id_idx" ON "employee_month_plan_item"("company_id");

-- CreateIndex
CREATE INDEX "employee_month_plan_item_employee_month_plan_id_idx" ON "employee_month_plan_item"("employee_month_plan_id");

-- CreateIndex
CREATE INDEX "employee_month_plan_item_employee_kr_id_idx" ON "employee_month_plan_item"("employee_kr_id");

-- CreateIndex
CREATE INDEX "employee_month_plan_item_metric_definition_id_idx" ON "employee_month_plan_item"("metric_definition_id");

-- CreateIndex
CREATE INDEX "employee_month_plan_item_parent_employee_month_plan_item_id_idx" ON "employee_month_plan_item"("parent_employee_month_plan_item_id");

-- CreateIndex
CREATE INDEX "weekly_task_company_id_idx" ON "weekly_task"("company_id");

-- CreateIndex
CREATE INDEX "weekly_task_weekly_plan_id_idx" ON "weekly_task"("weekly_plan_id");

-- CreateIndex
CREATE INDEX "daily_plan_company_id_idx" ON "daily_plan"("company_id");

-- CreateIndex
CREATE INDEX "daily_plan_weekly_task_id_idx" ON "daily_plan"("weekly_task_id");

-- CreateIndex
CREATE INDEX "daily_plan_metric_definition_id_idx" ON "daily_plan"("metric_definition_id");

-- CreateIndex
CREATE INDEX "daily_plan_company_id_status_code_idx" ON "daily_plan"("company_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_employee_id_key" ON "app_user"("employee_id");

-- CreateIndex
CREATE INDEX "company_key_result_submission_id_idx" ON "company_key_result"("submission_id");

-- CreateIndex
CREATE INDEX "company_objective_submission_id_idx" ON "company_objective"("submission_id");

-- CreateIndex
CREATE INDEX "employee_key_result_submission_id_idx" ON "employee_key_result"("submission_id");

-- CreateIndex
CREATE INDEX "employee_month_plan_month_number_idx" ON "employee_month_plan"("month_number");

-- CreateIndex
CREATE INDEX "employee_month_plan_employee_objective_id_idx" ON "employee_month_plan"("employee_objective_id");

-- CreateIndex
CREATE INDEX "employee_month_plan_submission_id_idx" ON "employee_month_plan"("submission_id");

-- CreateIndex
CREATE INDEX "employee_month_plan_company_id_status_code_idx" ON "employee_month_plan"("company_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_month_plan_month_number_employee_objective_id_key" ON "employee_month_plan"("month_number", "employee_objective_id");

-- CreateIndex
CREATE INDEX "employee_objective_submission_id_idx" ON "employee_objective"("submission_id");

-- CreateIndex
CREATE INDEX "kr_contributor_company_kr_id_idx" ON "kr_contributor"("company_kr_id");

-- CreateIndex
CREATE INDEX "kr_contributor_employee_kr_id_idx" ON "kr_contributor"("employee_kr_id");

-- CreateIndex
CREATE UNIQUE INDEX "kr_contributor_company_kr_id_employee_kr_id_user_id_key" ON "kr_contributor"("company_kr_id", "employee_kr_id", "user_id");

-- CreateIndex
CREATE INDEX "weekly_plan_employee_kr_id_employee_month_plan_id_week_numb_idx" ON "weekly_plan"("employee_kr_id", "employee_month_plan_id", "week_number");

-- CreateIndex
CREATE INDEX "weekly_plan_employee_month_plan_item_id_idx" ON "weekly_plan"("employee_month_plan_item_id");

-- CreateIndex
CREATE INDEX "weekly_plan_submission_id_idx" ON "weekly_plan"("submission_id");

-- CreateIndex
CREATE INDEX "weekly_plan_parent_weekly_plan_id_idx" ON "weekly_plan"("parent_weekly_plan_id");

-- CreateIndex
CREATE INDEX "weekly_plan_parent_weekly_task_id_idx" ON "weekly_plan"("parent_weekly_task_id");

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_head_user_id_fkey" FOREIGN KEY ("head_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_objective" ADD CONSTRAINT "company_objective_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_key_result" ADD CONSTRAINT "company_key_result_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kr_contributor" ADD CONSTRAINT "kr_contributor_company_kr_id_fkey" FOREIGN KEY ("company_kr_id") REFERENCES "company_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kr_contributor" ADD CONSTRAINT "kr_contributor_department_kr_id_fkey" FOREIGN KEY ("department_kr_id") REFERENCES "employee_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kr_contributor" ADD CONSTRAINT "kr_contributor_employee_kr_id_fkey" FOREIGN KEY ("employee_kr_id") REFERENCES "employee_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kr_contributor" ADD CONSTRAINT "kr_contributor_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_objective" ADD CONSTRAINT "employee_objective_chosen_parent_employee_kr_id_fkey" FOREIGN KEY ("chosen_parent_employee_kr_id") REFERENCES "employee_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_objective" ADD CONSTRAINT "employee_objective_chosen_parent_kr_id_fkey" FOREIGN KEY ("chosen_parent_kr_id") REFERENCES "company_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_objective" ADD CONSTRAINT "employee_objective_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_objective" ADD CONSTRAINT "employee_objective_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_key_result" ADD CONSTRAINT "employee_key_result_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_month_plan" ADD CONSTRAINT "employee_month_plan_employee_objective_id_fkey" FOREIGN KEY ("employee_objective_id") REFERENCES "employee_objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_month_plan" ADD CONSTRAINT "employee_month_plan_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_month_plan_item" ADD CONSTRAINT "employee_month_plan_item_employee_kr_id_fkey" FOREIGN KEY ("employee_kr_id") REFERENCES "employee_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_month_plan_item" ADD CONSTRAINT "employee_month_plan_item_employee_month_plan_id_fkey" FOREIGN KEY ("employee_month_plan_id") REFERENCES "employee_month_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_month_plan_item" ADD CONSTRAINT "employee_month_plan_item_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_month_plan_item" ADD CONSTRAINT "employee_month_plan_item_parent_employee_month_plan_item_i_fkey" FOREIGN KEY ("parent_employee_month_plan_item_id") REFERENCES "employee_month_plan_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_employee_month_plan_id_fkey" FOREIGN KEY ("employee_month_plan_id") REFERENCES "employee_month_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_employee_month_plan_item_id_fkey" FOREIGN KEY ("employee_month_plan_item_id") REFERENCES "employee_month_plan_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_parent_weekly_plan_id_fkey" FOREIGN KEY ("parent_weekly_plan_id") REFERENCES "weekly_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_parent_weekly_task_id_fkey" FOREIGN KEY ("parent_weekly_task_id") REFERENCES "weekly_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_task" ADD CONSTRAINT "weekly_task_weekly_plan_id_fkey" FOREIGN KEY ("weekly_plan_id") REFERENCES "weekly_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan" ADD CONSTRAINT "daily_plan_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan" ADD CONSTRAINT "daily_plan_weekly_task_id_fkey" FOREIGN KEY ("weekly_task_id") REFERENCES "weekly_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_update" ADD CONSTRAINT "progress_update_daily_plan_id_fkey" FOREIGN KEY ("daily_plan_id") REFERENCES "daily_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
