/*
  Warnings:

  - You are about to drop the column `final_score` on the `company_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_score` on the `company_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_value` on the `company_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `final_score` on the `company_objective` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_score` on the `company_objective` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_value` on the `company_objective` table. All the data in the column will be lost.
  - You are about to drop the column `final_score` on the `daily_plan` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_score` on the `daily_plan` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_value` on the `daily_plan` table. All the data in the column will be lost.
  - You are about to drop the column `final_score` on the `employee_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_score` on the `employee_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_value` on the `employee_key_result` table. All the data in the column will be lost.
  - You are about to drop the column `final_score` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_score` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_value` on the `employee_month_plan` table. All the data in the column will be lost.
  - You are about to drop the column `final_score` on the `employee_objective` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_score` on the `employee_objective` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_value` on the `employee_objective` table. All the data in the column will be lost.
  - You are about to drop the column `final_score` on the `subtask` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_score` on the `subtask` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_value` on the `subtask` table. All the data in the column will be lost.
  - You are about to drop the column `final_score` on the `weekly_plan` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_score` on the `weekly_plan` table. All the data in the column will be lost.
  - You are about to drop the column `indirect_value` on the `weekly_plan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "company_key_result" DROP COLUMN "final_score",
DROP COLUMN "indirect_score",
DROP COLUMN "indirect_value",
ADD COLUMN     "is_direct" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "normalized_weight" DECIMAL(7,4);

-- AlterTable
ALTER TABLE "company_objective" DROP COLUMN "final_score",
DROP COLUMN "indirect_score",
DROP COLUMN "indirect_value";

-- AlterTable
ALTER TABLE "daily_plan" DROP COLUMN "final_score",
DROP COLUMN "indirect_score",
DROP COLUMN "indirect_value",
ADD COLUMN     "is_direct" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "employee_key_result" DROP COLUMN "final_score",
DROP COLUMN "indirect_score",
DROP COLUMN "indirect_value",
ADD COLUMN     "is_direct" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "normalized_weight" DECIMAL(7,4);

-- AlterTable
ALTER TABLE "employee_month_plan" DROP COLUMN "final_score",
DROP COLUMN "indirect_score",
DROP COLUMN "indirect_value";

-- AlterTable
ALTER TABLE "employee_month_plan_item" ADD COLUMN     "is_direct" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "employee_objective" DROP COLUMN "final_score",
DROP COLUMN "indirect_score",
DROP COLUMN "indirect_value";

-- AlterTable
ALTER TABLE "subtask" DROP COLUMN "final_score",
DROP COLUMN "indirect_score",
DROP COLUMN "indirect_value",
ADD COLUMN     "is_direct" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "weekly_plan" DROP COLUMN "final_score",
DROP COLUMN "indirect_score",
DROP COLUMN "indirect_value",
ADD COLUMN     "is_direct" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "weekly_task" ADD COLUMN     "is_direct" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "progress_percent" DECIMAL(7,2);
