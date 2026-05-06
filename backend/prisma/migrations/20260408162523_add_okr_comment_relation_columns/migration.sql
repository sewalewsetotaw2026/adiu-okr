/*
  Warnings:

  - A unique constraint covering the columns `[company_id,name]` on the table `okr_config_profile` will be added. If there are existing duplicate values, this will fail.
  - Made the column `metric_definition_id` on table `company_key_result` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metric_definition_id` on table `department_key_result` required. This step will fail if there are existing NULL values in that column.
  - Made the column `metric_definition_id` on table `employee_key_result` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "company_key_result" DROP CONSTRAINT "company_key_result_metric_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "department_key_result" DROP CONSTRAINT "department_key_result_metric_definition_id_fkey";

-- DropForeignKey
ALTER TABLE "employee_key_result" DROP CONSTRAINT "employee_key_result_metric_definition_id_fkey";

-- AlterTable
ALTER TABLE "company_key_result" ALTER COLUMN "metric_definition_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "department_key_result" ALTER COLUMN "metric_definition_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "employee_key_result" ALTER COLUMN "metric_definition_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "okr_config_profile_company_id_name_key" ON "okr_config_profile"("company_id", "name");

-- AddForeignKey
ALTER TABLE "company_key_result" ADD CONSTRAINT "company_key_result_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_objective" ADD CONSTRAINT "department_objective_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_key_result" ADD CONSTRAINT "department_key_result_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_key_result" ADD CONSTRAINT "employee_key_result_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
