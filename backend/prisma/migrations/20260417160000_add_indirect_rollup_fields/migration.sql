-- Add indirect rollup fields so parent nodes can expose non-contributing child progress/value.

ALTER TABLE "employee_key_result"
  ADD COLUMN "indirect_score" DECIMAL(7,2),
  ADD COLUMN "indirect_value" DECIMAL(18,4);

ALTER TABLE "employee_objective"
  ADD COLUMN "indirect_score" DECIMAL(7,2),
  ADD COLUMN "indirect_value" DECIMAL(18,4);

ALTER TABLE "department_key_result"
  ADD COLUMN "indirect_score" DECIMAL(7,2),
  ADD COLUMN "indirect_value" DECIMAL(18,4);

ALTER TABLE "department_objective"
  ADD COLUMN "indirect_score" DECIMAL(7,2),
  ADD COLUMN "indirect_value" DECIMAL(18,4);

ALTER TABLE "company_key_result"
  ADD COLUMN "indirect_score" DECIMAL(7,2),
  ADD COLUMN "indirect_value" DECIMAL(18,4);

ALTER TABLE "company_objective"
  ADD COLUMN "indirect_score" DECIMAL(7,2),
  ADD COLUMN "indirect_value" DECIMAL(18,4);
