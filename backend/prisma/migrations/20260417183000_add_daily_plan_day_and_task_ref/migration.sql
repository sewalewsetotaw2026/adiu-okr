-- Add completion day and weekly task reference to daily plan entities.

CREATE TYPE "OkrWeekDay" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

ALTER TABLE "milestone"
  ADD COLUMN "weekly_task_ref" VARCHAR(200),
  ADD COLUMN "completion_day" "OkrWeekDay";

ALTER TABLE "department_daily_milestone"
  ADD COLUMN "weekly_task_ref" VARCHAR(200),
  ADD COLUMN "completion_day" "OkrWeekDay";
