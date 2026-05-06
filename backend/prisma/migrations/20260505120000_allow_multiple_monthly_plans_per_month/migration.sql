-- Allow multiple monthly plans for the same KR in the same month.
-- Previously only one plan per (employee_kr_id, month_number) was allowed;
-- now the constraint is lifted so users can decompose a KR across multiple
-- plan entries within the same month.

DROP INDEX IF EXISTS "okr_monthly_plans_employee_kr_id_month_number_key";
