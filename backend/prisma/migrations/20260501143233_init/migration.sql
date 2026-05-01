-- CreateEnum
CREATE TYPE "InstitutionCategory" AS ENUM ('Government', 'Private');

-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('Regular', 'Extension', 'Weekend', 'Distance');

-- CreateEnum
CREATE TYPE "CostSharingCommitmentType" AS ENUM ('Full_Study', 'Partial_Study', 'Service_Obligation');

-- CreateEnum
CREATE TYPE "CostSharingStatus" AS ENUM ('DECLARED', 'VERIFIED', 'REJECTED', 'CLEARED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CostSharingPaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'FULLY_PAID');

-- CreateEnum
CREATE TYPE "CelebrationType" AS ENUM ('BIRTHDAY', 'PROMOTION', 'ANNIVERSARY');

-- CreateEnum
CREATE TYPE "CelebrationVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "OkrSubmissionType" AS ENUM ('OBJECTIVE_PLANNING', 'MONTHLY_PLAN', 'WEEKLY_PLAN');

-- CreateEnum
CREATE TYPE "OkrCycleStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "OkrScopeLevel" AS ENUM ('COMPANY', 'DEPARTMENT', 'TEAM', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "OkrContributorRoleType" AS ENUM ('EMPLOYEE', 'TEAM_LEADER', 'MANAGER', 'DIRECTOR', 'DEPARTMENT_HEAD');

-- CreateEnum
CREATE TYPE "OkrExecutionMode" AS ENUM ('DIRECT_ADOPTION', 'CUSTOMIZED');

-- CreateEnum
CREATE TYPE "OkrPlanningCadence" AS ENUM ('MONTHLY', 'WEEKLY', 'DAILY');

-- CreateEnum
CREATE TYPE "OkrConfigScopeType" AS ENUM ('GLOBAL', 'ORGANIZATION', 'DEPARTMENT', 'ROLE', 'QUARTER');

-- CreateEnum
CREATE TYPE "OkrMetricCategory" AS ENUM ('NUMERIC', 'PERCENTAGE', 'CURRENCY', 'BINARY', 'MILESTONE', 'RATING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OkrConfidenceLevel" AS ENUM ('ON_TRACK', 'AT_RISK', 'OFF_TRACK');

-- CreateEnum
CREATE TYPE "OkrWeekDay" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "OkrApprovalAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "OkrEntityType" AS ENUM ('CYCLE', 'COMPANY_OBJECTIVE', 'COMPANY_KR', 'KR_CONTRIBUTOR', 'EMPLOYEE_OBJECTIVE', 'EMPLOYEE_KR', 'EMPLOYEE_MONTH_PLAN', 'EMPLOYEE_MONTH_PLAN_ITEM', 'MANAGER_MONTH_PLAN', 'MANAGER_MONTH_PLAN_ITEM', 'MANAGER_WEEKLY_PLAN', 'WEEKLY_PLAN', 'SUBTASK', 'DAILY_PLAN', 'PROGRESS_UPDATE', 'ARCHIVE', 'EXPORT', 'SUBMISSION');

-- CreateEnum
CREATE TYPE "OkrArchiveStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OkrExportFormat" AS ENUM ('PDF', 'XLSX', 'CSV', 'JSON');

-- CreateEnum
CREATE TYPE "OkrExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "company" (
    "id" SERIAL NOT NULL,
    "company_code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "logo_url" VARCHAR(255),
    "stamp_url" VARCHAR(500),
    "primary_color" VARCHAR(10) DEFAULT '#e55400',
    "secondary_color" VARCHAR(10) DEFAULT '#ffda00',
    "phone" VARCHAR(20),
    "email" VARCHAR(100),
    "is_active" BOOLEAN DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "department_code" VARCHAR(20),
    "head_user_id" INTEGER,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_title" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "level" VARCHAR(50),

    CONSTRAINT "job_title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_level" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "job_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee" (
    "id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "gender" VARCHAR(10),
    "date_of_birth" DATE,
    "tin_number" VARCHAR(20),
    "pension_number" VARCHAR(20),
    "place_of_work" VARCHAR(100) DEFAULT 'Head Office',
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "profile_picture_url" VARCHAR(500),
    "signature_url" VARCHAR(500),

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_document" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cv" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certificates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experienceLetters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "taxForms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pensionForms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "guarantee_letter" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "medical_certificate" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "national_id" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "police_certificate" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "employee_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_address" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "employee_id" VARCHAR(20) NOT NULL,
    "region" VARCHAR(100),
    "city" VARCHAR(100),
    "sub_city" VARCHAR(100),
    "woreda" VARCHAR(20),

    CONSTRAINT "employee_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_phone" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "employee_id" VARCHAR(50),
    "phone_number" VARCHAR(20) NOT NULL,
    "phone_type" VARCHAR(20) DEFAULT 'Private',
    "is_primary" BOOLEAN DEFAULT false,

    CONSTRAINT "employee_phone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "manager_id" VARCHAR(20),
    "department_id" INTEGER,
    "job_title_id" INTEGER,
    "employment_type" VARCHAR(20) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "gross_salary" DECIMAL(12,2),
    "basic_salary" DECIMAL(12,2),
    "cost_sharing_document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cost_sharing_status" VARCHAR(20),
    "cost_sharing_amount" DECIMAL(12,2),
    "provider_company" VARCHAR(150),
    "contract_reference" VARCHAR(100),
    "probation_end_date" DATE,
    "notes" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowance_type" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_taxable" BOOLEAN DEFAULT true,

    CONSTRAINT "allowance_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_allowance" (
    "id" SERIAL NOT NULL,
    "employment_id" INTEGER,
    "allowance_type_id" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) DEFAULT 'ETB',
    "effective_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" DATE,
    "is_active" BOOLEAN DEFAULT true,

    CONSTRAINT "employee_allowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_history" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "previous_company_name" VARCHAR(150) NOT NULL,
    "job_title_id" INTEGER,
    "employment_type" VARCHAR(50),
    "previous_level" VARCHAR(50),
    "department_name" VARCHAR(100),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_verified" BOOLEAN DEFAULT false,
    "notes" TEXT,
    "document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "separation_reason" (
    "id" SERIAL NOT NULL,
    "reason_category" VARCHAR(50) NOT NULL,
    "reason_detail" VARCHAR(150) NOT NULL,
    "requires_exit_interview" BOOLEAN DEFAULT true,

    CONSTRAINT "separation_reason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_resignation" (
    "id" SERIAL NOT NULL,
    "employment_id" INTEGER,
    "employee_id" VARCHAR(50),
    "resignation_date" DATE NOT NULL,
    "last_working_date" DATE,
    "reason_id" INTEGER,
    "new_company" VARCHAR(150),
    "resigned_salary" DECIMAL(12,2),
    "termination_status" VARCHAR(50),
    "termination_payment" DECIMAL(12,2),
    "claims" TEXT,
    "employment_type_at_resignation" VARCHAR(20),
    "position_level_at_resignation" VARCHAR(20),
    "notes" TEXT,
    "recorded_by" VARCHAR(20),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_resignation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_career_event" (
    "id" SERIAL NOT NULL,
    "previous_employment_id" INTEGER,
    "new_employment_id" INTEGER,
    "employee_id" VARCHAR(20),
    "event_date" DATE NOT NULL,
    "effective_date" DATE NOT NULL,
    "previous_job_title_id" INTEGER,
    "new_job_title_id" INTEGER,
    "previous_salary" DECIMAL(12,2),
    "new_salary" DECIMAL(12,2),
    "event_type" VARCHAR(50) NOT NULL,
    "justification" TEXT,
    "approved_by" VARCHAR(20),
    "recorded_by" VARCHAR(20),
    "department_changed" BOOLEAN DEFAULT false,
    "notes" TEXT,
    "document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_career_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_level" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "display_order" INTEGER DEFAULT 0,

    CONSTRAINT "education_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_of_study" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "field_of_study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category" "InstitutionCategory" NOT NULL,
    "is_verified" BOOLEAN DEFAULT false,

    CONSTRAINT "institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_education" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20),
    "education_level_id" INTEGER,
    "field_of_study_id" INTEGER,
    "institution_id" INTEGER,
    "program_type" "ProgramType" NOT NULL,
    "has_cost_sharing" BOOLEAN,
    "cost_sharing_document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cost_sharing_details" TEXT,
    "document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_date" DATE,
    "end_date" DATE,
    "is_verified" BOOLEAN DEFAULT false,
    "is_current" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_cost_sharing" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "education_id" INTEGER,
    "document_number" VARCHAR(100),
    "issuing_institution" VARCHAR(200),
    "issue_date" DATE,
    "declared_total_cost" DECIMAL(12,2),
    "remaining_cost" DECIMAL(12,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'ETB',
    "commitment_type" "CostSharingCommitmentType",
    "regulation_reference" VARCHAR(150),
    "status" "CostSharingStatus" NOT NULL DEFAULT 'DECLARED',
    "payment_status" "CostSharingPaymentStatus" DEFAULT 'UNPAID',
    "document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_cost_sharing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_licenses_and_certifications" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20),
    "name" VARCHAR(150) NOT NULL,
    "issuing_organization" VARCHAR(150),
    "issue_date" DATE,
    "expiration_date" DATE,
    "credential_id" VARCHAR(100),
    "credential_url" VARCHAR(255),
    "document_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_licenses_and_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_role" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "app_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(20),
    "email" VARCHAR(150) NOT NULL,
    "role_id" INTEGER NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_resource" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,

    CONSTRAINT "app_resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_permission" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,

    CONSTRAINT "app_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_role_job_title" (
    "company_id" INTEGER NOT NULL,
    "job_title_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,

    CONSTRAINT "app_role_job_title_pkey" PRIMARY KEY ("job_title_id","company_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "recipient_id" VARCHAR(20) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "action_url" VARCHAR(255),
    "related_entity_type" VARCHAR(50),
    "related_entity_id" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contact" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "relationship" VARCHAR(50) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "email" VARCHAR(150),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "swift_code" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_detail" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "bank_id" INTEGER NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "account_holder_name" VARCHAR(150) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_detail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_signer_config" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "signer_employee_id" VARCHAR(20) NOT NULL,
    "signer_title" VARCHAR(150),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_signer_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "celebration" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "type" "CelebrationType" NOT NULL,
    "visibility" "CelebrationVisibility" NOT NULL DEFAULT 'PUBLIC',
    "celebration_date" DATE NOT NULL,
    "details" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "celebration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "celebration_message" (
    "id" SERIAL NOT NULL,
    "celebration_id" INTEGER NOT NULL,
    "sender_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "is_reaction" BOOLEAN NOT NULL DEFAULT false,
    "reaction_type" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "celebration_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "celebration_dismissal" (
    "id" SERIAL NOT NULL,
    "celebration_id" INTEGER NOT NULL,
    "user_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "dismissed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "celebration_dismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_settings" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "probation_period_days" INTEGER NOT NULL DEFAULT 90,
    "probation_notification_days" INTEGER NOT NULL DEFAULT 5,
    "pension_age" INTEGER NOT NULL DEFAULT 60,
    "pension_notification_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "default_allowance_days" INTEGER NOT NULL,
    "incremental_days_per_year" INTEGER DEFAULT 0,
    "incremental_period_years" INTEGER DEFAULT 2,
    "max_accrual_limit" INTEGER,
    "is_carry_over_allowed" BOOLEAN DEFAULT false,
    "carry_over_expiry_months" INTEGER,
    "applicable_gender" VARCHAR(10) DEFAULT 'All',
    "requires_attachment" BOOLEAN DEFAULT false,
    "is_paid" BOOLEAN DEFAULT true,
    "is_calendar_days" BOOLEAN DEFAULT false,
    "is_accrual_based" BOOLEAN DEFAULT false,
    "accrual_frequency" VARCHAR(20) DEFAULT 'DAILY',
    "accrual_divisor" INTEGER DEFAULT 365,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unpaid_leave_usage" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unpaid_leave_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "holiday_date" DATE NOT NULL,
    "is_recurring" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "total_entitlement" DECIMAL(5,2) NOT NULL,
    "used_days" DECIMAL(5,2) DEFAULT 0,
    "pending_days" DECIMAL(5,2) DEFAULT 0,
    "remaining_days" DECIMAL(5,2),
    "manual_adjustment_days" DECIMAL(5,2) DEFAULT 0,
    "expiry_date" DATE,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_applications" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "requested_days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "attachment_url" TEXT,
    "relief_officer_id" VARCHAR(20),
    "relief_company_id" INTEGER,
    "is_start_half_day" BOOLEAN DEFAULT false,
    "is_end_half_day" BOOLEAN DEFAULT false,
    "current_status" VARCHAR(50) NOT NULL DEFAULT 'PENDING_SUPERVISOR',
    "cancellation_status" VARCHAR(50),
    "requested_return_date" DATE,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_approval_logs" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "approver_id" VARCHAR(20) NOT NULL,
    "approver_company_id" INTEGER NOT NULL,
    "approver_role" VARCHAR(50) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "comments" TEXT,
    "action_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_approval_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_recalls" (
    "id" SERIAL NOT NULL,
    "leave_application_id" INTEGER NOT NULL,
    "recalled_by" VARCHAR(20) NOT NULL,
    "recalled_by_company_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "recall_date" DATE NOT NULL,
    "actual_return_date" DATE,
    "status" VARCHAR(20) DEFAULT 'PENDING',
    "employee_response" TEXT,
    "responded_at" TIMESTAMP(3),
    "days_restored" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_recalls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_settings" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "saturday_half_day" BOOLEAN DEFAULT true,
    "sunday_off" BOOLEAN DEFAULT true,
    "fiscal_year_start_month" INTEGER DEFAULT 1,
    "accrual_basis" VARCHAR(20) DEFAULT 'ANNIVERSARY',
    "require_ceo_approval_for_managers" BOOLEAN DEFAULT true,
    "auto_approve_after_days" INTEGER,
    "annual_leave_base_days" INTEGER DEFAULT 16,
    "accrual_frequency" VARCHAR(20) DEFAULT 'DAILY',
    "accrual_divisor" INTEGER DEFAULT 365,
    "increment_period_years" INTEGER DEFAULT 2,
    "increment_amount" INTEGER DEFAULT 1,
    "max_annual_leave_cap" INTEGER,
    "enable_leave_expiry" BOOLEAN DEFAULT true,
    "expiry_notification_days" INTEGER DEFAULT 30,
    "balance_notification_enabled" BOOLEAN DEFAULT true,
    "notification_channels" VARCHAR(100) DEFAULT 'EMAIL',
    "enable_encashment" BOOLEAN DEFAULT false,
    "encashment_salary_divisor" INTEGER DEFAULT 30,
    "max_encashment_days" INTEGER,
    "encashment_rounding" VARCHAR(10) DEFAULT 'ROUND',
    "policy_effective_date" DATE DEFAULT CURRENT_TIMESTAMP,
    "policy_version" INTEGER DEFAULT 1,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accrual_logs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "accrual_date" DATE NOT NULL,
    "days_accrued" DECIMAL(6,4) NOT NULL,
    "cumulative_accrued" DECIMAL(6,2) NOT NULL,
    "annual_entitlement" INTEGER NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accrual_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_cash_outs" (
    "id" SERIAL NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "company_id" INTEGER NOT NULL,
    "leave_type_id" INTEGER NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "days_cashed_out" DECIMAL(5,2) NOT NULL,
    "cash_value" DECIMAL(12,2) NOT NULL,
    "monthly_salary" DECIMAL(12,2) NOT NULL,
    "salary_divisor" INTEGER NOT NULL,
    "status" VARCHAR(20) DEFAULT 'PENDING',
    "approved_by" VARCHAR(20),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_cash_outs_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "okr_cycle" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "quarter_label" VARCHAR(20),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "OkrCycleStatus" NOT NULL DEFAULT 'DRAFT',
    "description" VARCHAR(500),
    "created_by" VARCHAR(20) NOT NULL,
    "closed_by" VARCHAR(20),
    "archived_by" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "okr_cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_config_profile" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "scope_type" "OkrConfigScopeType" NOT NULL,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_config_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_config_value" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "config_profile_id" INTEGER NOT NULL,
    "config_key" VARCHAR(150) NOT NULL,
    "config_value_json" JSONB NOT NULL,
    "value_type" VARCHAR(50) NOT NULL,
    "is_overridable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_config_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_config_assignment" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "config_profile_id" INTEGER NOT NULL,
    "cycle_id" INTEGER,
    "department_id" INTEGER,
    "role_code" VARCHAR(50),
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_config_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_feature_flag" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "feature_name" VARCHAR(100) NOT NULL,
    "scope_type" "OkrConfigScopeType" NOT NULL,
    "cycle_id" INTEGER,
    "department_id" INTEGER,
    "role_code" VARCHAR(50),
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_feature_flag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_status_definition" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "entity_type" "OkrEntityType" NOT NULL,
    "status_code" VARCHAR(50) NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "is_initial" BOOLEAN NOT NULL DEFAULT false,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_status_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_status_transition" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "entity_type" "OkrEntityType" NOT NULL,
    "from_status_code" VARCHAR(50) NOT NULL,
    "to_status_code" VARCHAR(50) NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "required_role" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_status_transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_metric_definition" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "category" "OkrMetricCategory" NOT NULL,
    "unit_of_measure" VARCHAR(30),
    "is_financial" BOOLEAN NOT NULL DEFAULT false,
    "requires_target_value" BOOLEAN NOT NULL DEFAULT true,
    "allows_binary_completion" BOOLEAN NOT NULL DEFAULT false,
    "supports_value_rollup" BOOLEAN NOT NULL DEFAULT true,
    "supports_weighted_score" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "okr_metric_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_config_snapshot" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "entity_type" "OkrEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "resolved_config_json" JSONB NOT NULL,
    "captured_by" VARCHAR(20) NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okr_config_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_objective" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "final_score" DECIMAL(7,2),
    "indirect_score" DECIMAL(7,2),
    "indirect_value" DECIMAL(18,4),
    "status_code" VARCHAR(50) NOT NULL,
    "created_by" VARCHAR(20) NOT NULL,
    "approved_by" VARCHAR(20),
    "published_by" VARCHAR(20),
    "published_at" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "progress_percent" DECIMAL(7,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submission_id" INTEGER,

    CONSTRAINT "company_objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_key_result" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "objective_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "metric_definition_id" INTEGER NOT NULL,
    "unit_of_measure" VARCHAR(30),
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "weight_percent" DECIMAL(7,2),
    "contributes_to_objective_score" BOOLEAN NOT NULL DEFAULT true,
    "contributes_to_objective_value" BOOLEAN NOT NULL DEFAULT true,
    "is_mandatory_for_completion" BOOLEAN NOT NULL DEFAULT false,
    "final_score" DECIMAL(7,2),
    "indirect_score" DECIMAL(7,2),
    "indirect_value" DECIMAL(18,4),
    "status_code" VARCHAR(50) NOT NULL,
    "created_by" VARCHAR(20) NOT NULL,
    "approved_by" VARCHAR(20),
    "published_by" VARCHAR(20),
    "published_at" TIMESTAMP(3),
    "progress_percent" DECIMAL(7,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submission_id" INTEGER,

    CONSTRAINT "company_key_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kr_contributor" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "company_kr_id" INTEGER,
    "employee_kr_id" INTEGER,
    "department_kr_id" INTEGER,
    "user_id" VARCHAR(20) NOT NULL,
    "role_type" "OkrContributorRoleType" NOT NULL,
    "is_required_for_completion" BOOLEAN NOT NULL DEFAULT true,
    "status_code" VARCHAR(50) NOT NULL,
    "assigned_by" VARCHAR(20) NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kr_contributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_objective" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "department_id" INTEGER,
    "kr_contributor_id" INTEGER NOT NULL,
    "chosen_parent_kr_id" INTEGER,
    "chosen_parent_employee_kr_id" INTEGER,
    "user_id" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "final_score" DECIMAL(7,2),
    "indirect_score" DECIMAL(7,2),
    "indirect_value" DECIMAL(18,4),
    "status_code" VARCHAR(50) NOT NULL,
    "created_by" VARCHAR(20) NOT NULL,
    "approved_by" VARCHAR(20),
    "published_by" VARCHAR(20),
    "published_at" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "progress_percent" DECIMAL(7,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submission_id" INTEGER,

    CONSTRAINT "employee_objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_key_result" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_objective_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "metric_definition_id" INTEGER NOT NULL,
    "unit_of_measure" VARCHAR(30),
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "weight_percent" DECIMAL(7,2),
    "contributes_to_objective_score" BOOLEAN NOT NULL DEFAULT true,
    "contributes_to_objective_value" BOOLEAN NOT NULL DEFAULT true,
    "is_mandatory_for_completion" BOOLEAN NOT NULL DEFAULT false,
    "execution_mode" "OkrExecutionMode" NOT NULL DEFAULT 'DIRECT_ADOPTION',
    "status_code" VARCHAR(50) NOT NULL,
    "final_score" DECIMAL(7,2),
    "indirect_score" DECIMAL(7,2),
    "indirect_value" DECIMAL(18,4),
    "created_by" VARCHAR(20) NOT NULL,
    "approved_by" VARCHAR(20),
    "published_by" VARCHAR(20),
    "published_at" TIMESTAMP(3),
    "progress_percent" DECIMAL(7,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submission_id" INTEGER,

    CONSTRAINT "employee_key_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_month_plan" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "month_number" INTEGER NOT NULL,
    "employee_objective_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "final_score" DECIMAL(7,2),
    "indirect_score" DECIMAL(7,2),
    "indirect_value" DECIMAL(18,4),
    "is_manager_plan" BOOLEAN NOT NULL DEFAULT false,
    "status_code" VARCHAR(50) NOT NULL,
    "created_by" VARCHAR(20) NOT NULL,
    "approved_by" VARCHAR(20),
    "published_by" VARCHAR(20),
    "published_at" TIMESTAMP(3),
    "progress_percent" DECIMAL(7,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submission_id" INTEGER,

    CONSTRAINT "employee_month_plan_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "weekly_plan" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_kr_id" INTEGER NOT NULL,
    "employee_month_plan_id" INTEGER NOT NULL,
    "week_number" INTEGER NOT NULL,
    "title" VARCHAR(200),
    "metric_definition_id" INTEGER,
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "weight_percent" DECIMAL(7,2),
    "final_score" DECIMAL(7,2),
    "indirect_score" DECIMAL(7,2),
    "indirect_value" DECIMAL(18,4),
    "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
    "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true,
    "parent_weekly_plan_id" INTEGER,
    "parent_weekly_task_id" INTEGER,
    "employee_month_plan_item_id" INTEGER,
    "status_code" VARCHAR(50) NOT NULL,
    "confidence_level" "OkrConfidenceLevel",
    "blockers" VARCHAR(2000),
    "created_by" VARCHAR(20) NOT NULL,
    "approved_by" VARCHAR(20),
    "published_by" VARCHAR(20),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "progress_percent" DECIMAL(7,2),
    "submission_id" INTEGER,

    CONSTRAINT "weekly_plan_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "subtask" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_kr_id" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "metric_definition_id" INTEGER,
    "target_value" DECIMAL(18,4),
    "current_value" DECIMAL(18,4),
    "weight_percent" DECIMAL(7,2),
    "progress_percent" DECIMAL(7,2),
    "final_score" DECIMAL(7,2),
    "confidence_level" "OkrConfidenceLevel",
    "contributes_to_parent_score" BOOLEAN NOT NULL DEFAULT true,
    "indirect_score" DECIMAL(7,2),
    "indirect_value" DECIMAL(18,4),
    "contributes_to_parent_value" BOOLEAN NOT NULL DEFAULT true,
    "status_code" VARCHAR(50) NOT NULL,
    "target_month" INTEGER,
    "target_week" INTEGER,
    "sequence_order" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_by" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtask_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "progress_update" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "employee_kr_id" INTEGER NOT NULL,
    "week_number" INTEGER,
    "month_number" INTEGER,
    "completion_day" "OkrWeekDay",
    "daily_plan_id" INTEGER,
    "current_value" DECIMAL(18,4),
    "confidence_level" "OkrConfidenceLevel",
    "blockers" VARCHAR(2000),
    "comment" VARCHAR(2000),
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" VARCHAR(20) NOT NULL,
    "cycle_label" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_update_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_approval_log" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "entity_type" "OkrEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "approver_id" VARCHAR(20) NOT NULL,
    "action" "OkrApprovalAction" NOT NULL,
    "comments" VARCHAR(2000),
    "action_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okr_approval_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_activity_log" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "entity_type" "OkrEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "actor_id" VARCHAR(20) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okr_activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_audit_log" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "entity_type" "OkrEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "old_value_json" JSONB,
    "new_value_json" JSONB,
    "changed_by" VARCHAR(20) NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okr_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_score_snapshot" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "entity_type" "OkrEntityType" NOT NULL,
    "entity_id" INTEGER,
    "scope_level" "OkrScopeLevel" NOT NULL,
    "department_id" INTEGER,
    "snapshot_date" DATE NOT NULL,
    "score_value" DECIMAL(7,2),
    "objective_value" DECIMAL(18,4),
    "completion_rate" DECIMAL(7,2),
    "avg_confidence_score" DECIMAL(5,2),
    "confidence_level" "OkrConfidenceLevel",
    "on_track_count" INTEGER NOT NULL DEFAULT 0,
    "at_risk_count" INTEGER NOT NULL DEFAULT 0,
    "off_track_count" INTEGER NOT NULL DEFAULT 0,
    "total_objectives" INTEGER NOT NULL DEFAULT 0,
    "total_key_results" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "okr_score_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "okr_comment" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "entity_type" "OkrEntityType" NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "author_id" VARCHAR(20) NOT NULL,
    "parent_comment_id" INTEGER,
    "content" TEXT NOT NULL,
    "attachment_url" VARCHAR(500),
    "is_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "companyObjectiveId" INTEGER,
    "companyKeyResultId" INTEGER,
    "employeeObjectiveId" INTEGER,
    "employeeKeyResultId" INTEGER,

    CONSTRAINT "okr_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarter_archive" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "quarter_name" VARCHAR(50) NOT NULL,
    "status" "OkrArchiveStatus" NOT NULL DEFAULT 'PENDING',
    "archived_by" VARCHAR(20) NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot_reference" VARCHAR(255),
    "report_pack_generated" BOOLEAN NOT NULL DEFAULT false,
    "insights_generated" BOOLEAN NOT NULL DEFAULT false,
    "exports_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarter_archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive_report" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "quarter_archive_id" INTEGER NOT NULL,
    "report_type" VARCHAR(100) NOT NULL,
    "report_name" VARCHAR(200) NOT NULL,
    "report_payload_json" JSONB,
    "generated_by" VARCHAR(20) NOT NULL,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archive_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive_insight" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "quarter_archive_id" INTEGER NOT NULL,
    "insight_type" VARCHAR(100) NOT NULL,
    "insight_title" VARCHAR(200) NOT NULL,
    "insight_payload_json" JSONB,
    "generated_by" VARCHAR(20) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archive_insight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_job" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "quarter_archive_id" INTEGER NOT NULL,
    "export_type" VARCHAR(100) NOT NULL,
    "format" "OkrExportFormat" NOT NULL,
    "status" "OkrExportStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" VARCHAR(20) NOT NULL,
    "generated_file_reference" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "export_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exported_file" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "export_job_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "checksum" VARCHAR(128),
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "exported_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_company_code_key" ON "company"("company_code");

-- CreateIndex
CREATE INDEX "idx_dept_company" ON "department"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "department_company_id_name_key" ON "department"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "department_company_id_department_code_key" ON "department"("company_id", "department_code");

-- CreateIndex
CREATE UNIQUE INDEX "ux_department_id_company" ON "department"("id", "company_id");

-- CreateIndex
CREATE INDEX "idx_jobtitle_company" ON "job_title"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_title_company_id_title_level_key" ON "job_title"("company_id", "title", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ux_job_title_id_company" ON "job_title"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_level_company_id_name_key" ON "job_level"("company_id", "name");

-- CreateIndex
CREATE INDEX "idx_employee_company" ON "employee"("company_id");

-- CreateIndex
CREATE INDEX "idx_employee_gender" ON "employee"("company_id", "gender");

-- CreateIndex
CREATE INDEX "idx_employee_dob" ON "employee"("company_id", "date_of_birth");

-- CreateIndex
CREATE UNIQUE INDEX "ux_employee_id_company" ON "employee"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_employee_tin_company" ON "employee"("company_id", "tin_number");

-- CreateIndex
CREATE UNIQUE INDEX "employee_document_employee_id_company_id_key" ON "employee_document"("employee_id", "company_id");

-- CreateIndex
CREATE INDEX "idx_employment_company" ON "employment"("company_id");

-- CreateIndex
CREATE INDEX "idx_employment_employee" ON "employment"("employee_id");

-- CreateIndex
CREATE INDEX "idx_employment_manager" ON "employment"("manager_id");

-- CreateIndex
CREATE INDEX "idx_employment_department" ON "employment"("department_id");

-- CreateIndex
CREATE INDEX "idx_employment_job_title" ON "employment"("job_title_id");

-- CreateIndex
CREATE INDEX "idx_employment_is_active" ON "employment"("is_active");

-- CreateIndex
CREATE INDEX "idx_employment_company_is_active" ON "employment"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_employment_start_date" ON "employment"("company_id", "start_date");

-- CreateIndex
CREATE INDEX "idx_employment_cost_sharing" ON "employment"("company_id", "cost_sharing_status");

-- CreateIndex
CREATE UNIQUE INDEX "allowance_type_name_key" ON "allowance_type"("name");

-- CreateIndex
CREATE INDEX "idx_emp_allowance_employment" ON "employee_allowance"("employment_id");

-- CreateIndex
CREATE INDEX "idx_emp_allowance_type" ON "employee_allowance"("allowance_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "education_level_name_key" ON "education_level"("name");

-- CreateIndex
CREATE UNIQUE INDEX "field_of_study_name_key" ON "field_of_study"("name");

-- CreateIndex
CREATE UNIQUE INDEX "institution_name_key" ON "institution"("name");

-- CreateIndex
CREATE INDEX "idx_emp_edu_employee" ON "employee_education"("employee_id");

-- CreateIndex
CREATE INDEX "employee_cost_sharing_employee_id_idx" ON "employee_cost_sharing"("employee_id");

-- CreateIndex
CREATE INDEX "employee_cost_sharing_status_idx" ON "employee_cost_sharing"("status");

-- CreateIndex
CREATE INDEX "employee_cost_sharing_education_id_idx" ON "employee_cost_sharing"("education_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_role_company_id_name_key" ON "app_role"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ux_app_role_id_company" ON "app_role"("id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_employee_id_key" ON "app_user"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "idx_app_user_company" ON "app_user"("company_id");

-- CreateIndex
CREATE INDEX "idx_app_user_role" ON "app_user"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_company_id_employee_id_key" ON "app_user"("company_id", "employee_id");

-- CreateIndex
CREATE INDEX "password_reset_user_id_idx" ON "password_reset"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_resource_code_key" ON "app_resource"("code");

-- CreateIndex
CREATE INDEX "idx_app_permission_role" ON "app_permission"("role_id");

-- CreateIndex
CREATE INDEX "idx_app_permission_resource" ON "app_permission"("resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_permission_role_id_resource_id_action_key" ON "app_permission"("role_id", "resource_id", "action");

-- CreateIndex
CREATE INDEX "idx_notification_recipient_read" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notification_company_created" ON "notifications"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notification_type" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "idx_notification_entity" ON "notifications"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "emergency_contact_employee_id_idx" ON "emergency_contact"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_name_key" ON "bank"("name");

-- CreateIndex
CREATE INDEX "financial_detail_employee_id_idx" ON "financial_detail"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_signer_config_company_id_document_type_key" ON "document_signer_config"("company_id", "document_type");

-- CreateIndex
CREATE INDEX "celebration_company_id_celebration_date_idx" ON "celebration"("company_id", "celebration_date");

-- CreateIndex
CREATE INDEX "celebration_employee_id_idx" ON "celebration"("employee_id");

-- CreateIndex
CREATE INDEX "celebration_type_idx" ON "celebration"("type");

-- CreateIndex
CREATE UNIQUE INDEX "celebration_employee_id_company_id_type_celebration_date_key" ON "celebration"("employee_id", "company_id", "type", "celebration_date");

-- CreateIndex
CREATE INDEX "celebration_message_celebration_id_idx" ON "celebration_message"("celebration_id");

-- CreateIndex
CREATE INDEX "celebration_message_sender_id_idx" ON "celebration_message"("sender_id");

-- CreateIndex
CREATE INDEX "celebration_dismissal_celebration_id_idx" ON "celebration_dismissal"("celebration_id");

-- CreateIndex
CREATE UNIQUE INDEX "celebration_dismissal_celebration_id_user_id_key" ON "celebration_dismissal"("celebration_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_settings_company_id_key" ON "employee_settings"("company_id");

-- CreateIndex
CREATE INDEX "idx_leave_types_company" ON "leave_types"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_company_id_code_key" ON "leave_types"("company_id", "code");

-- CreateIndex
CREATE INDEX "idx_unpaid_leave_usage_employee" ON "unpaid_leave_usage"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "unpaid_leave_usage_employee_id_company_id_fiscal_year_key" ON "unpaid_leave_usage"("employee_id", "company_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "idx_public_holidays_company" ON "public_holidays"("company_id");

-- CreateIndex
CREATE INDEX "idx_public_holidays_date" ON "public_holidays"("holiday_date");

-- CreateIndex
CREATE INDEX "idx_leave_balances_employee" ON "leave_balances"("employee_id");

-- CreateIndex
CREATE INDEX "idx_leave_balances_company" ON "leave_balances"("company_id");

-- CreateIndex
CREATE INDEX "idx_leave_balances_leave_type" ON "leave_balances"("leave_type_id");

-- CreateIndex
CREATE INDEX "idx_leave_balances_fiscal_year" ON "leave_balances"("fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_employee_id_leave_type_id_fiscal_year_key" ON "leave_balances"("employee_id", "leave_type_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "idx_leave_applications_employee" ON "leave_applications"("employee_id");

-- CreateIndex
CREATE INDEX "idx_leave_applications_company" ON "leave_applications"("company_id");

-- CreateIndex
CREATE INDEX "idx_leave_applications_leave_type" ON "leave_applications"("leave_type_id");

-- CreateIndex
CREATE INDEX "idx_leave_applications_status" ON "leave_applications"("current_status");

-- CreateIndex
CREATE INDEX "idx_leave_applications_dates" ON "leave_applications"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_leave_approval_logs_application" ON "leave_approval_logs"("application_id");

-- CreateIndex
CREATE INDEX "idx_leave_approval_logs_approver" ON "leave_approval_logs"("approver_id");

-- CreateIndex
CREATE INDEX "idx_leave_approval_logs_action_date" ON "leave_approval_logs"("action_date");

-- CreateIndex
CREATE INDEX "idx_leave_recalls_application" ON "leave_recalls"("leave_application_id");

-- CreateIndex
CREATE INDEX "idx_leave_recalls_recalled_by" ON "leave_recalls"("recalled_by");

-- CreateIndex
CREATE INDEX "idx_leave_recalls_status" ON "leave_recalls"("status");

-- CreateIndex
CREATE UNIQUE INDEX "leave_settings_company_id_key" ON "leave_settings"("company_id");

-- CreateIndex
CREATE INDEX "idx_accrual_log_employee_type_year" ON "accrual_logs"("employee_id", "leave_type_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "idx_accrual_log_date" ON "accrual_logs"("accrual_date");

-- CreateIndex
CREATE INDEX "idx_cash_out_employee_year" ON "leave_cash_outs"("employee_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "okr_submission_company_id_idx" ON "okr_submission"("company_id");

-- CreateIndex
CREATE INDEX "okr_submission_cycle_id_idx" ON "okr_submission"("cycle_id");

-- CreateIndex
CREATE INDEX "okr_submission_submitter_id_idx" ON "okr_submission"("submitter_id");

-- CreateIndex
CREATE INDEX "okr_submission_status_idx" ON "okr_submission"("status");

-- CreateIndex
CREATE INDEX "okr_cycle_company_id_idx" ON "okr_cycle"("company_id");

-- CreateIndex
CREATE INDEX "okr_cycle_company_id_status_idx" ON "okr_cycle"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "okr_cycle_company_id_name_key" ON "okr_cycle"("company_id", "name");

-- CreateIndex
CREATE INDEX "okr_config_profile_company_id_idx" ON "okr_config_profile"("company_id");

-- CreateIndex
CREATE INDEX "okr_config_profile_company_id_scope_type_is_active_idx" ON "okr_config_profile"("company_id", "scope_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "okr_config_profile_company_id_name_key" ON "okr_config_profile"("company_id", "name");

-- CreateIndex
CREATE INDEX "okr_config_value_company_id_idx" ON "okr_config_value"("company_id");

-- CreateIndex
CREATE INDEX "okr_config_value_config_profile_id_idx" ON "okr_config_value"("config_profile_id");

-- CreateIndex
CREATE INDEX "okr_config_value_company_id_config_key_idx" ON "okr_config_value"("company_id", "config_key");

-- CreateIndex
CREATE UNIQUE INDEX "okr_config_value_config_profile_id_config_key_key" ON "okr_config_value"("config_profile_id", "config_key");

-- CreateIndex
CREATE INDEX "okr_config_assignment_company_id_idx" ON "okr_config_assignment"("company_id");

-- CreateIndex
CREATE INDEX "okr_config_assignment_config_profile_id_idx" ON "okr_config_assignment"("config_profile_id");

-- CreateIndex
CREATE INDEX "okr_config_assignment_cycle_id_idx" ON "okr_config_assignment"("cycle_id");

-- CreateIndex
CREATE INDEX "okr_config_assignment_department_id_idx" ON "okr_config_assignment"("department_id");

-- CreateIndex
CREATE INDEX "okr_config_assignment_company_id_is_active_priority_idx" ON "okr_config_assignment"("company_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "okr_feature_flag_company_id_idx" ON "okr_feature_flag"("company_id");

-- CreateIndex
CREATE INDEX "okr_feature_flag_feature_name_idx" ON "okr_feature_flag"("feature_name");

-- CreateIndex
CREATE INDEX "okr_feature_flag_cycle_id_idx" ON "okr_feature_flag"("cycle_id");

-- CreateIndex
CREATE INDEX "okr_feature_flag_department_id_idx" ON "okr_feature_flag"("department_id");

-- CreateIndex
CREATE INDEX "okr_feature_flag_company_id_feature_name_is_enabled_idx" ON "okr_feature_flag"("company_id", "feature_name", "is_enabled");

-- CreateIndex
CREATE INDEX "okr_status_definition_company_id_idx" ON "okr_status_definition"("company_id");

-- CreateIndex
CREATE INDEX "okr_status_definition_company_id_entity_type_is_active_idx" ON "okr_status_definition"("company_id", "entity_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "okr_status_definition_company_id_entity_type_status_code_key" ON "okr_status_definition"("company_id", "entity_type", "status_code");

-- CreateIndex
CREATE INDEX "okr_status_transition_company_id_idx" ON "okr_status_transition"("company_id");

-- CreateIndex
CREATE INDEX "okr_status_transition_company_id_entity_type_is_active_idx" ON "okr_status_transition"("company_id", "entity_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "okr_status_transition_company_id_entity_type_from_status_co_key" ON "okr_status_transition"("company_id", "entity_type", "from_status_code", "to_status_code");

-- CreateIndex
CREATE INDEX "okr_metric_definition_company_id_idx" ON "okr_metric_definition"("company_id");

-- CreateIndex
CREATE INDEX "okr_metric_definition_company_id_category_is_active_idx" ON "okr_metric_definition"("company_id", "category", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "okr_metric_definition_company_id_code_key" ON "okr_metric_definition"("company_id", "code");

-- CreateIndex
CREATE INDEX "okr_config_snapshot_company_id_idx" ON "okr_config_snapshot"("company_id");

-- CreateIndex
CREATE INDEX "okr_config_snapshot_entity_type_entity_id_idx" ON "okr_config_snapshot"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "company_objective_company_id_idx" ON "company_objective"("company_id");

-- CreateIndex
CREATE INDEX "company_objective_cycle_id_idx" ON "company_objective"("cycle_id");

-- CreateIndex
CREATE INDEX "company_objective_submission_id_idx" ON "company_objective"("submission_id");

-- CreateIndex
CREATE INDEX "company_objective_company_id_cycle_id_status_code_idx" ON "company_objective"("company_id", "cycle_id", "status_code");

-- CreateIndex
CREATE INDEX "company_key_result_company_id_idx" ON "company_key_result"("company_id");

-- CreateIndex
CREATE INDEX "company_key_result_objective_id_idx" ON "company_key_result"("objective_id");

-- CreateIndex
CREATE INDEX "company_key_result_metric_definition_id_idx" ON "company_key_result"("metric_definition_id");

-- CreateIndex
CREATE INDEX "company_key_result_submission_id_idx" ON "company_key_result"("submission_id");

-- CreateIndex
CREATE INDEX "company_key_result_company_id_objective_id_status_code_idx" ON "company_key_result"("company_id", "objective_id", "status_code");

-- CreateIndex
CREATE INDEX "kr_contributor_company_id_idx" ON "kr_contributor"("company_id");

-- CreateIndex
CREATE INDEX "kr_contributor_company_kr_id_idx" ON "kr_contributor"("company_kr_id");

-- CreateIndex
CREATE INDEX "kr_contributor_employee_kr_id_idx" ON "kr_contributor"("employee_kr_id");

-- CreateIndex
CREATE INDEX "kr_contributor_user_id_idx" ON "kr_contributor"("user_id");

-- CreateIndex
CREATE INDEX "kr_contributor_company_id_status_code_idx" ON "kr_contributor"("company_id", "status_code");

-- CreateIndex
CREATE UNIQUE INDEX "kr_contributor_company_kr_id_employee_kr_id_user_id_key" ON "kr_contributor"("company_kr_id", "employee_kr_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_objective_kr_contributor_id_key" ON "employee_objective"("kr_contributor_id");

-- CreateIndex
CREATE INDEX "employee_objective_company_id_idx" ON "employee_objective"("company_id");

-- CreateIndex
CREATE INDEX "employee_objective_cycle_id_idx" ON "employee_objective"("cycle_id");

-- CreateIndex
CREATE INDEX "employee_objective_user_id_idx" ON "employee_objective"("user_id");

-- CreateIndex
CREATE INDEX "employee_objective_chosen_parent_kr_id_idx" ON "employee_objective"("chosen_parent_kr_id");

-- CreateIndex
CREATE INDEX "employee_objective_submission_id_idx" ON "employee_objective"("submission_id");

-- CreateIndex
CREATE INDEX "employee_objective_company_id_cycle_id_user_id_status_code_idx" ON "employee_objective"("company_id", "cycle_id", "user_id", "status_code");

-- CreateIndex
CREATE INDEX "employee_key_result_company_id_idx" ON "employee_key_result"("company_id");

-- CreateIndex
CREATE INDEX "employee_key_result_employee_objective_id_idx" ON "employee_key_result"("employee_objective_id");

-- CreateIndex
CREATE INDEX "employee_key_result_metric_definition_id_idx" ON "employee_key_result"("metric_definition_id");

-- CreateIndex
CREATE INDEX "employee_key_result_submission_id_idx" ON "employee_key_result"("submission_id");

-- CreateIndex
CREATE INDEX "employee_key_result_company_id_employee_objective_id_status_idx" ON "employee_key_result"("company_id", "employee_objective_id", "status_code");

-- CreateIndex
CREATE INDEX "employee_month_plan_company_id_idx" ON "employee_month_plan"("company_id");

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
CREATE INDEX "weekly_plan_employee_kr_id_employee_month_plan_id_week_numb_idx" ON "weekly_plan"("employee_kr_id", "employee_month_plan_id", "week_number");

-- CreateIndex
CREATE INDEX "weekly_plan_company_id_idx" ON "weekly_plan"("company_id");

-- CreateIndex
CREATE INDEX "weekly_plan_employee_kr_id_idx" ON "weekly_plan"("employee_kr_id");

-- CreateIndex
CREATE INDEX "weekly_plan_employee_month_plan_id_idx" ON "weekly_plan"("employee_month_plan_id");

-- CreateIndex
CREATE INDEX "weekly_plan_employee_month_plan_item_id_idx" ON "weekly_plan"("employee_month_plan_item_id");

-- CreateIndex
CREATE INDEX "weekly_plan_metric_definition_id_idx" ON "weekly_plan"("metric_definition_id");

-- CreateIndex
CREATE INDEX "weekly_plan_submission_id_idx" ON "weekly_plan"("submission_id");

-- CreateIndex
CREATE INDEX "weekly_plan_parent_weekly_plan_id_idx" ON "weekly_plan"("parent_weekly_plan_id");

-- CreateIndex
CREATE INDEX "weekly_plan_parent_weekly_task_id_idx" ON "weekly_plan"("parent_weekly_task_id");

-- CreateIndex
CREATE INDEX "weekly_plan_company_id_week_number_status_code_idx" ON "weekly_plan"("company_id", "week_number", "status_code");

-- CreateIndex
CREATE INDEX "weekly_task_company_id_idx" ON "weekly_task"("company_id");

-- CreateIndex
CREATE INDEX "weekly_task_weekly_plan_id_idx" ON "weekly_task"("weekly_plan_id");

-- CreateIndex
CREATE INDEX "subtask_company_id_idx" ON "subtask"("company_id");

-- CreateIndex
CREATE INDEX "subtask_employee_kr_id_idx" ON "subtask"("employee_kr_id");

-- CreateIndex
CREATE INDEX "subtask_metric_definition_id_idx" ON "subtask"("metric_definition_id");

-- CreateIndex
CREATE INDEX "subtask_company_id_target_month_target_week_idx" ON "subtask"("company_id", "target_month", "target_week");

-- CreateIndex
CREATE INDEX "subtask_company_id_status_code_idx" ON "subtask"("company_id", "status_code");

-- CreateIndex
CREATE INDEX "daily_plan_company_id_idx" ON "daily_plan"("company_id");

-- CreateIndex
CREATE INDEX "daily_plan_weekly_task_id_idx" ON "daily_plan"("weekly_task_id");

-- CreateIndex
CREATE INDEX "daily_plan_metric_definition_id_idx" ON "daily_plan"("metric_definition_id");

-- CreateIndex
CREATE INDEX "daily_plan_company_id_status_code_idx" ON "daily_plan"("company_id", "status_code");

-- CreateIndex
CREATE INDEX "progress_update_company_id_idx" ON "progress_update"("company_id");

-- CreateIndex
CREATE INDEX "progress_update_employee_kr_id_idx" ON "progress_update"("employee_kr_id");

-- CreateIndex
CREATE INDEX "progress_update_updated_by_idx" ON "progress_update"("updated_by");

-- CreateIndex
CREATE INDEX "progress_update_company_id_week_number_idx" ON "progress_update"("company_id", "week_number");

-- CreateIndex
CREATE INDEX "progress_update_company_id_month_number_idx" ON "progress_update"("company_id", "month_number");

-- CreateIndex
CREATE INDEX "okr_approval_log_company_id_idx" ON "okr_approval_log"("company_id");

-- CreateIndex
CREATE INDEX "okr_approval_log_entity_type_entity_id_idx" ON "okr_approval_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "okr_approval_log_approver_id_idx" ON "okr_approval_log"("approver_id");

-- CreateIndex
CREATE INDEX "okr_approval_log_company_id_action_date_idx" ON "okr_approval_log"("company_id", "action_date");

-- CreateIndex
CREATE INDEX "okr_activity_log_company_id_idx" ON "okr_activity_log"("company_id");

-- CreateIndex
CREATE INDEX "okr_activity_log_entity_type_entity_id_idx" ON "okr_activity_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "okr_activity_log_actor_id_idx" ON "okr_activity_log"("actor_id");

-- CreateIndex
CREATE INDEX "okr_activity_log_company_id_created_at_idx" ON "okr_activity_log"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "okr_audit_log_company_id_idx" ON "okr_audit_log"("company_id");

-- CreateIndex
CREATE INDEX "okr_audit_log_entity_type_entity_id_idx" ON "okr_audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "okr_audit_log_changed_by_idx" ON "okr_audit_log"("changed_by");

-- CreateIndex
CREATE INDEX "okr_audit_log_company_id_changed_at_idx" ON "okr_audit_log"("company_id", "changed_at");

-- CreateIndex
CREATE INDEX "okr_score_snapshot_company_id_idx" ON "okr_score_snapshot"("company_id");

-- CreateIndex
CREATE INDEX "okr_score_snapshot_cycle_id_idx" ON "okr_score_snapshot"("cycle_id");

-- CreateIndex
CREATE INDEX "okr_score_snapshot_entity_type_entity_id_idx" ON "okr_score_snapshot"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "okr_score_snapshot_company_id_cycle_id_scope_level_idx" ON "okr_score_snapshot"("company_id", "cycle_id", "scope_level");

-- CreateIndex
CREATE INDEX "okr_score_snapshot_company_id_snapshot_date_idx" ON "okr_score_snapshot"("company_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "okr_comment_company_id_idx" ON "okr_comment"("company_id");

-- CreateIndex
CREATE INDEX "okr_comment_entity_type_entity_id_idx" ON "okr_comment"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "okr_comment_author_id_idx" ON "okr_comment"("author_id");

-- CreateIndex
CREATE INDEX "okr_comment_parent_comment_id_idx" ON "okr_comment"("parent_comment_id");

-- CreateIndex
CREATE INDEX "quarter_archive_company_id_idx" ON "quarter_archive"("company_id");

-- CreateIndex
CREATE INDEX "quarter_archive_cycle_id_idx" ON "quarter_archive"("cycle_id");

-- CreateIndex
CREATE INDEX "quarter_archive_company_id_status_idx" ON "quarter_archive"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quarter_archive_company_id_cycle_id_key" ON "quarter_archive"("company_id", "cycle_id");

-- CreateIndex
CREATE INDEX "archive_report_company_id_idx" ON "archive_report"("company_id");

-- CreateIndex
CREATE INDEX "archive_report_quarter_archive_id_idx" ON "archive_report"("quarter_archive_id");

-- CreateIndex
CREATE INDEX "archive_report_company_id_report_type_idx" ON "archive_report"("company_id", "report_type");

-- CreateIndex
CREATE INDEX "archive_insight_company_id_idx" ON "archive_insight"("company_id");

-- CreateIndex
CREATE INDEX "archive_insight_quarter_archive_id_idx" ON "archive_insight"("quarter_archive_id");

-- CreateIndex
CREATE INDEX "archive_insight_company_id_insight_type_idx" ON "archive_insight"("company_id", "insight_type");

-- CreateIndex
CREATE INDEX "export_job_company_id_idx" ON "export_job"("company_id");

-- CreateIndex
CREATE INDEX "export_job_quarter_archive_id_idx" ON "export_job"("quarter_archive_id");

-- CreateIndex
CREATE INDEX "export_job_company_id_status_idx" ON "export_job"("company_id", "status");

-- CreateIndex
CREATE INDEX "exported_file_company_id_idx" ON "exported_file"("company_id");

-- CreateIndex
CREATE INDEX "exported_file_export_job_id_idx" ON "exported_file"("export_job_id");

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department" ADD CONSTRAINT "department_head_user_id_fkey" FOREIGN KEY ("head_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_title" ADD CONSTRAINT "job_title_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_level" ADD CONSTRAINT "job_level_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee" ADD CONSTRAINT "employee_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_document" ADD CONSTRAINT "employee_document_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_address" ADD CONSTRAINT "employee_address_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_address" ADD CONSTRAINT "employee_address_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_phone" ADD CONSTRAINT "employee_phone_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_phone" ADD CONSTRAINT "employee_phone_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment" ADD CONSTRAINT "employment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment" ADD CONSTRAINT "employment_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment" ADD CONSTRAINT "employment_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment" ADD CONSTRAINT "employment_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "job_title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment" ADD CONSTRAINT "employment_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_allowance" ADD CONSTRAINT "employee_allowance_allowance_type_id_fkey" FOREIGN KEY ("allowance_type_id") REFERENCES "allowance_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_allowance" ADD CONSTRAINT "employee_allowance_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_history" ADD CONSTRAINT "employment_history_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "job_title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_resignation" ADD CONSTRAINT "employee_resignation_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_resignation" ADD CONSTRAINT "employee_resignation_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "employment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_resignation" ADD CONSTRAINT "employee_resignation_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "separation_reason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_resignation" ADD CONSTRAINT "employee_resignation_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_career_event" ADD CONSTRAINT "employee_career_event_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_career_event" ADD CONSTRAINT "employee_career_event_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_career_event" ADD CONSTRAINT "employee_career_event_new_employment_id_fkey" FOREIGN KEY ("new_employment_id") REFERENCES "employment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_career_event" ADD CONSTRAINT "employee_career_event_new_job_title_id_fkey" FOREIGN KEY ("new_job_title_id") REFERENCES "job_title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_career_event" ADD CONSTRAINT "employee_career_event_previous_employment_id_fkey" FOREIGN KEY ("previous_employment_id") REFERENCES "employment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_career_event" ADD CONSTRAINT "employee_career_event_previous_job_title_id_fkey" FOREIGN KEY ("previous_job_title_id") REFERENCES "job_title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_career_event" ADD CONSTRAINT "employee_career_event_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_education" ADD CONSTRAINT "employee_education_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_education" ADD CONSTRAINT "employee_education_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_education" ADD CONSTRAINT "employee_education_field_of_study_id_fkey" FOREIGN KEY ("field_of_study_id") REFERENCES "field_of_study"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_education" ADD CONSTRAINT "employee_education_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_cost_sharing" ADD CONSTRAINT "employee_cost_sharing_education_id_fkey" FOREIGN KEY ("education_id") REFERENCES "employee_education"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_cost_sharing" ADD CONSTRAINT "employee_cost_sharing_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_licenses_and_certifications" ADD CONSTRAINT "employee_licenses_and_certifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_role" ADD CONSTRAINT "app_role_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "app_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_permission" ADD CONSTRAINT "app_permission_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "app_resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_permission" ADD CONSTRAINT "app_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "app_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_role_job_title" ADD CONSTRAINT "app_role_job_title_job_title_id_company_id_fkey" FOREIGN KEY ("job_title_id", "company_id") REFERENCES "job_title"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_role_job_title" ADD CONSTRAINT "app_role_job_title_role_id_company_id_fkey" FOREIGN KEY ("role_id", "company_id") REFERENCES "app_role"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_company_id_fkey" FOREIGN KEY ("recipient_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contact" ADD CONSTRAINT "emergency_contact_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_detail" ADD CONSTRAINT "financial_detail_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_detail" ADD CONSTRAINT "financial_detail_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signer_config" ADD CONSTRAINT "document_signer_config_signer_employee_id_fkey" FOREIGN KEY ("signer_employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_signer_config" ADD CONSTRAINT "document_signer_config_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "celebration" ADD CONSTRAINT "celebration_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "celebration_message" ADD CONSTRAINT "celebration_message_celebration_id_fkey" FOREIGN KEY ("celebration_id") REFERENCES "celebration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "celebration_message" ADD CONSTRAINT "celebration_message_sender_id_company_id_fkey" FOREIGN KEY ("sender_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "celebration_dismissal" ADD CONSTRAINT "celebration_dismissal_celebration_id_fkey" FOREIGN KEY ("celebration_id") REFERENCES "celebration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "celebration_dismissal" ADD CONSTRAINT "celebration_dismissal_user_id_company_id_fkey" FOREIGN KEY ("user_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_settings" ADD CONSTRAINT "employee_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_applications" ADD CONSTRAINT "leave_applications_relief_officer_id_relief_company_id_fkey" FOREIGN KEY ("relief_officer_id", "relief_company_id") REFERENCES "employee"("id", "company_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_logs" ADD CONSTRAINT "leave_approval_logs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "leave_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_approval_logs" ADD CONSTRAINT "leave_approval_logs_approver_id_approver_company_id_fkey" FOREIGN KEY ("approver_id", "approver_company_id") REFERENCES "employee"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_recalls" ADD CONSTRAINT "leave_recalls_leave_application_id_fkey" FOREIGN KEY ("leave_application_id") REFERENCES "leave_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_recalls" ADD CONSTRAINT "leave_recalls_recalled_by_recalled_by_company_id_fkey" FOREIGN KEY ("recalled_by", "recalled_by_company_id") REFERENCES "employee"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_settings" ADD CONSTRAINT "leave_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accrual_logs" ADD CONSTRAINT "accrual_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "leave_settings"("company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_cash_outs" ADD CONSTRAINT "leave_cash_outs_employee_id_company_id_fkey" FOREIGN KEY ("employee_id", "company_id") REFERENCES "employee"("id", "company_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_cash_outs" ADD CONSTRAINT "leave_cash_outs_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_config_value" ADD CONSTRAINT "okr_config_value_config_profile_id_fkey" FOREIGN KEY ("config_profile_id") REFERENCES "okr_config_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_config_assignment" ADD CONSTRAINT "okr_config_assignment_config_profile_id_fkey" FOREIGN KEY ("config_profile_id") REFERENCES "okr_config_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_config_assignment" ADD CONSTRAINT "okr_config_assignment_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "okr_cycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_objective" ADD CONSTRAINT "company_objective_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "okr_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_objective" ADD CONSTRAINT "company_objective_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_key_result" ADD CONSTRAINT "company_key_result_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_key_result" ADD CONSTRAINT "company_key_result_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "company_objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "employee_objective" ADD CONSTRAINT "employee_objective_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "okr_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_objective" ADD CONSTRAINT "employee_objective_kr_contributor_id_fkey" FOREIGN KEY ("kr_contributor_id") REFERENCES "kr_contributor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_objective" ADD CONSTRAINT "employee_objective_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_objective" ADD CONSTRAINT "employee_objective_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_key_result" ADD CONSTRAINT "employee_key_result_employee_objective_id_fkey" FOREIGN KEY ("employee_objective_id") REFERENCES "employee_objective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_key_result" ADD CONSTRAINT "employee_key_result_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_employee_kr_id_fkey" FOREIGN KEY ("employee_kr_id") REFERENCES "employee_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_employee_month_plan_id_fkey" FOREIGN KEY ("employee_month_plan_id") REFERENCES "employee_month_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_employee_month_plan_item_id_fkey" FOREIGN KEY ("employee_month_plan_item_id") REFERENCES "employee_month_plan_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "okr_submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_parent_weekly_plan_id_fkey" FOREIGN KEY ("parent_weekly_plan_id") REFERENCES "weekly_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_plan" ADD CONSTRAINT "weekly_plan_parent_weekly_task_id_fkey" FOREIGN KEY ("parent_weekly_task_id") REFERENCES "weekly_task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_task" ADD CONSTRAINT "weekly_task_weekly_plan_id_fkey" FOREIGN KEY ("weekly_plan_id") REFERENCES "weekly_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask" ADD CONSTRAINT "subtask_employee_kr_id_fkey" FOREIGN KEY ("employee_kr_id") REFERENCES "employee_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtask" ADD CONSTRAINT "subtask_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan" ADD CONSTRAINT "daily_plan_metric_definition_id_fkey" FOREIGN KEY ("metric_definition_id") REFERENCES "okr_metric_definition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan" ADD CONSTRAINT "daily_plan_weekly_task_id_fkey" FOREIGN KEY ("weekly_task_id") REFERENCES "weekly_task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_update" ADD CONSTRAINT "progress_update_daily_plan_id_fkey" FOREIGN KEY ("daily_plan_id") REFERENCES "daily_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_update" ADD CONSTRAINT "progress_update_employee_kr_id_fkey" FOREIGN KEY ("employee_kr_id") REFERENCES "employee_key_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_score_snapshot" ADD CONSTRAINT "okr_score_snapshot_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "okr_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_comment" ADD CONSTRAINT "okr_comment_companyKeyResultId_fkey" FOREIGN KEY ("companyKeyResultId") REFERENCES "company_key_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_comment" ADD CONSTRAINT "okr_comment_companyObjectiveId_fkey" FOREIGN KEY ("companyObjectiveId") REFERENCES "company_objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_comment" ADD CONSTRAINT "okr_comment_employeeKeyResultId_fkey" FOREIGN KEY ("employeeKeyResultId") REFERENCES "employee_key_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_comment" ADD CONSTRAINT "okr_comment_employeeObjectiveId_fkey" FOREIGN KEY ("employeeObjectiveId") REFERENCES "employee_objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "okr_comment" ADD CONSTRAINT "okr_comment_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "okr_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarter_archive" ADD CONSTRAINT "quarter_archive_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "okr_cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_report" ADD CONSTRAINT "archive_report_quarter_archive_id_fkey" FOREIGN KEY ("quarter_archive_id") REFERENCES "quarter_archive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_insight" ADD CONSTRAINT "archive_insight_quarter_archive_id_fkey" FOREIGN KEY ("quarter_archive_id") REFERENCES "quarter_archive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_job" ADD CONSTRAINT "export_job_quarter_archive_id_fkey" FOREIGN KEY ("quarter_archive_id") REFERENCES "quarter_archive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exported_file" ADD CONSTRAINT "exported_file_export_job_id_fkey" FOREIGN KEY ("export_job_id") REFERENCES "export_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
