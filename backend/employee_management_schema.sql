-- =============================================
-- Employee Data Management System - PostgreSQL Schema
-- Updated: 2026-01-02
-- =============================================

-- 1. COMPANIES & STRUCTURE
-- =============================================
CREATE TABLE company (
  id SERIAL PRIMARY KEY,
  company_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  logo_url VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE department (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  UNIQUE (company_id, name),
  CONSTRAINT ux_department_id_company UNIQUE (id, company_id)
);
CREATE INDEX idx_dept_company ON department(company_id);

CREATE TABLE job_title (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  title VARCHAR(150) NOT NULL,
  level VARCHAR(50), -- Entry, Mid, Senior, Lead, Manager, Director, Executive
  UNIQUE (company_id, title, level),
  CONSTRAINT ux_job_title_id_company UNIQUE (id, company_id)
);
CREATE INDEX idx_jobtitle_company ON job_title(company_id);

-- 2. EMPLOYEES
-- =============================================
CREATE TABLE employee (
  id VARCHAR(20) PRIMARY KEY,
  company_id INT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
  full_name VARCHAR(150) NOT NULL,
  gender VARCHAR(10), -- Male, Female
  date_of_birth DATE,
  tin_number VARCHAR(20) UNIQUE,
  pension_number VARCHAR(20),
  place_of_work VARCHAR(100) DEFAULT 'Head Office',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ux_employee_id_company UNIQUE (id, company_id)
);
CREATE INDEX idx_employee_company ON employee(company_id);
CREATE INDEX idx_employee_gender ON employee(company_id, gender);
CREATE INDEX idx_employee_dob ON employee(company_id, date_of_birth);

CREATE TABLE employee_document (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  company_id INT NOT NULL,
  cv TEXT[] DEFAULT '{}',
  certificates TEXT[] DEFAULT '{}',
  photo TEXT[] DEFAULT '{}',
  experience_letters TEXT[] DEFAULT '{}',
  tax_forms TEXT[] DEFAULT '{}',
  pension_forms TEXT[] DEFAULT '{}',
  CONSTRAINT fk_employee_document_employee FOREIGN KEY (employee_id, company_id) REFERENCES employee(id, company_id) ON DELETE CASCADE,
  UNIQUE (employee_id, company_id)
);

CREATE TABLE employee_address (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES company(id) ON DELETE RESTRICT,
  employee_id VARCHAR(20) REFERENCES employee(id) ON DELETE RESTRICT,
  region VARCHAR(100),
  city VARCHAR(100),
  sub_city VARCHAR(100),
  woreda VARCHAR(50)
);

CREATE TABLE employee_phone (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES company(id) ON DELETE RESTRICT,
  employee_id VARCHAR(20) REFERENCES employee(id) ON DELETE RESTRICT,
  phone_number VARCHAR(20) NOT NULL,
  phone_type VARCHAR(20) DEFAULT 'Private', -- Private, Office, Home, Emergency, Other
  is_primary BOOLEAN DEFAULT false
);

-- 3. EMPLOYMENT & COMPENSATION
-- =============================================
CREATE TABLE employment (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  company_id INT NOT NULL REFERENCES company(id) ON DELETE RESTRICT,
  manager_id VARCHAR(20),
  department_id INT REFERENCES department(id),
  job_title_id INT REFERENCES job_title(id),
  employment_type VARCHAR(20) NOT NULL, -- Full Time, Part-Time, Contract, Outsourced
  start_date DATE NOT NULL,
  end_date DATE,
  gross_salary NUMERIC(12,2),
  basic_salary NUMERIC(12,2),
  transportation_allowance NUMERIC(12,2),
  housing_allowance NUMERIC(12,2),
  meal_allowance NUMERIC(12,2),
  cost_sharing_status VARCHAR(20),
  cost_sharing_amount NUMERIC(12,2),
  provider_company VARCHAR(150),
  contract_reference VARCHAR(100),
  probation_end_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_employment_employee FOREIGN KEY (employee_id) REFERENCES employee(id) ON DELETE RESTRICT,
  CONSTRAINT fk_employment_manager FOREIGN KEY (manager_id) REFERENCES employee(id)
);
CREATE INDEX idx_employment_company ON employment(company_id);
CREATE INDEX idx_employment_employee ON employment(employee_id);
CREATE INDEX idx_employment_manager ON employment(manager_id);
CREATE INDEX idx_employment_department ON employment(department_id);
CREATE INDEX idx_employment_job_title ON employment(job_title_id);
CREATE INDEX idx_employment_is_active ON employment(is_active);
CREATE INDEX idx_employment_company_is_active ON employment(company_id, is_active);

CREATE TABLE allowance_type (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_taxable BOOLEAN DEFAULT true
);

CREATE TABLE employee_allowance (
  id SERIAL PRIMARY KEY,
  employment_id INT REFERENCES employment(id) ON DELETE RESTRICT,
  allowance_type_id INT REFERENCES allowance_type(id),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ETB',
  end_date DATE,
  is_active BOOLEAN DEFAULT true
);
CREATE INDEX idx_emp_allowance_employment ON employee_allowance(employment_id);
CREATE INDEX idx_emp_allowance_type ON employee_allowance(allowance_type_id);

-- 4. HISTORY & EVENTS
-- =============================================
CREATE TABLE employment_history (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL REFERENCES employee(id) ON DELETE RESTRICT,
  previous_company_name VARCHAR(150) NOT NULL,
  job_title_id INT REFERENCES job_title(id),
  previous_job_title_text VARCHAR(150),
  previous_level VARCHAR(50),
  department_name VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE,
  is_verified BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE separation_reason (
  id SERIAL PRIMARY KEY,
  reason_category VARCHAR(50) NOT NULL,
  reason_detail VARCHAR(150) NOT NULL,
  requires_exit_interview BOOLEAN DEFAULT true
);

CREATE TABLE employee_resignation (
  id SERIAL PRIMARY KEY,
  employment_id INT REFERENCES employment(id),
  employee_id VARCHAR(20) REFERENCES employee(id) ON DELETE RESTRICT,
  resignation_date DATE NOT NULL,
  last_working_date DATE,
  reason_id INT REFERENCES separation_reason(id),
  new_company VARCHAR(150),
  resigned_salary NUMERIC(12,2),
  termination_status VARCHAR(50),
  termination_payment NUMERIC(12,2),
  claims TEXT,
  employment_type_at_resignation VARCHAR(20),
  position_level_at_resignation VARCHAR(20),
  notes TEXT,
  recorded_by VARCHAR(20) REFERENCES employee(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_career_event (
  id SERIAL PRIMARY KEY,
  previous_employment_id INT REFERENCES employment(id),
  new_employment_id INT REFERENCES employment(id),
  employee_id VARCHAR(20) REFERENCES employee(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  effective_date DATE NOT NULL,
  previous_job_title_id INT REFERENCES job_title(id),
  new_job_title_id INT REFERENCES job_title(id),
  previous_salary NUMERIC(12,2),
  new_salary NUMERIC(12,2),
  event_type VARCHAR(50) NOT NULL,
  justification TEXT,
  approved_by VARCHAR(20) REFERENCES employee(id),
  recorded_by VARCHAR(20) REFERENCES employee(id),
  department_changed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. EDUCATION & CERTIFICATIONS
-- =============================================
CREATE TABLE education_level (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_order INT DEFAULT 0
);

CREATE TABLE field_of_study (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TYPE institution_category AS ENUM ('Government', 'Private');

CREATE TABLE institution (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  category institution_category NOT NULL,
  is_verified BOOLEAN DEFAULT false
);

CREATE TYPE program_type AS ENUM ('Regular', 'Extension', 'Weekend', 'Distance');

CREATE TABLE employee_education (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) REFERENCES employee(id) ON DELETE RESTRICT,
  education_level_id INT REFERENCES education_level(id),
  field_of_study_id INT REFERENCES field_of_study(id),
  institution_id INT REFERENCES institution(id),
  program_type program_type NOT NULL,
  has_cost_sharing BOOLEAN,
  cost_sharing_document_url VARCHAR(255),
  start_date DATE,
  end_date DATE,
  is_verified BOOLEAN DEFAULT false,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_emp_edu_employee ON employee_education(employee_id);

CREATE TABLE employee_licenses_and_certifications (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) REFERENCES employee(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  issuing_organization VARCHAR(150),
  issue_date DATE,
  expiration_date DATE,
  credential_id VARCHAR(100),
  credential_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. AUTHENTICATION & RBAC
-- =============================================
CREATE TABLE app_role (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  UNIQUE (company_id, name),
  CONSTRAINT ux_app_role_id_company UNIQUE (id, company_id)
);

CREATE TYPE onboarding_status AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SUBMITTED');

CREATE TABLE app_user (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  employee_id VARCHAR(20),
  email VARCHAR(150) UNIQUE NOT NULL,
  role_id INT NOT NULL REFERENCES app_role(id),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  onboarding_status onboarding_status DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, employee_id)
);
CREATE INDEX idx_app_user_company ON app_user(company_id);
CREATE INDEX idx_app_user_role ON app_user(role_id);

CREATE TABLE password_reset (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_password_reset_user ON password_reset(user_id);

CREATE TABLE app_resource (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL
);

CREATE TABLE app_permission (
  id SERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES app_role(id) ON DELETE CASCADE,
  resource_id INT NOT NULL REFERENCES app_resource(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- e.g., "create:any", "read:own"
  UNIQUE (role_id, resource_id, action)
);
CREATE INDEX idx_app_permission_role ON app_permission(role_id);
CREATE INDEX idx_app_permission_resource ON app_permission(resource_id);

CREATE TABLE app_role_job_title (
  company_id INT NOT NULL,
  job_title_id INT NOT NULL,
  role_id INT NOT NULL,
  PRIMARY KEY (job_title_id, company_id),
  CONSTRAINT fk_rjt_job_title_company FOREIGN KEY (job_title_id, company_id) REFERENCES job_title(id, company_id) ON DELETE CASCADE,
  CONSTRAINT fk_rjt_role_company FOREIGN KEY (role_id, company_id) REFERENCES app_role(id, company_id) ON DELETE CASCADE
);

-- 7. LEAVE MANAGEMENT
-- =============================================
CREATE TABLE leave_types (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  default_allowance_days INT NOT NULL,
  incremental_days_per_year INT DEFAULT 0,
  incremental_period_years INT DEFAULT 2,
  max_accrual_limit INT,
  is_carry_over_allowed BOOLEAN DEFAULT false,
  carry_over_expiry_months INT,
  applicable_gender VARCHAR(10) DEFAULT 'All', -- Male, Female, All
  requires_attachment BOOLEAN DEFAULT false,
  is_paid BOOLEAN DEFAULT true,
  is_calendar_days BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (company_id, code)
);
CREATE INDEX idx_leave_types_company ON leave_types(company_id);

CREATE TABLE unpaid_leave_usage (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  company_id INT NOT NULL,
  fiscal_year INT NOT NULL,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (employee_id, company_id, fiscal_year)
);
CREATE INDEX idx_unpaid_leave_usage_employee ON unpaid_leave_usage(employee_id);

CREATE TABLE public_holidays (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  holiday_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_public_holidays_company ON public_holidays(company_id);
CREATE INDEX idx_public_holidays_date ON public_holidays(holiday_date);

CREATE TABLE leave_balances (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  company_id INT NOT NULL,
  leave_type_id INT NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  fiscal_year INT NOT NULL,
  total_entitlement DECIMAL(5, 2) NOT NULL,
  used_days DECIMAL(5, 2) DEFAULT 0,
  pending_days DECIMAL(5, 2) DEFAULT 0,
  remaining_days DECIMAL(5, 2) GENERATED ALWAYS AS (total_entitlement - used_days) STORED,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_balances_employee FOREIGN KEY (employee_id, company_id) REFERENCES employee(id, company_id) ON DELETE CASCADE,
  UNIQUE (employee_id, leave_type_id, fiscal_year)
);
CREATE INDEX idx_leave_balances_employee ON leave_balances(employee_id);
CREATE INDEX idx_leave_balances_company ON leave_balances(company_id);
CREATE INDEX idx_leave_balances_leave_type ON leave_balances(leave_type_id);
CREATE INDEX idx_leave_balances_fiscal_year ON leave_balances(fiscal_year);

CREATE TABLE leave_applications (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  company_id INT NOT NULL,
  leave_type_id INT NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  return_date DATE NOT NULL,
  requested_days DECIMAL(5, 2) NOT NULL,
  reason TEXT,
  attachment_url TEXT,
  relief_officer_id VARCHAR(20),
  relief_company_id INT,
  current_status VARCHAR(50) DEFAULT 'PENDING_SUPERVISOR', -- PENDING_SUPERVISOR, PENDING_HR, PENDING_CEO, APPROVED, REJECTED, CANCELLED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_applications_employee FOREIGN KEY (employee_id, company_id) REFERENCES employee(id, company_id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_applications_relief FOREIGN KEY (relief_officer_id, relief_company_id) REFERENCES employee(id, company_id) ON DELETE SET NULL
);
CREATE INDEX idx_leave_applications_employee ON leave_applications(employee_id);
CREATE INDEX idx_leave_applications_company ON leave_applications(company_id);
CREATE INDEX idx_leave_applications_leave_type ON leave_applications(leave_type_id);
CREATE INDEX idx_leave_applications_status ON leave_applications(current_status);
CREATE INDEX idx_leave_applications_dates ON leave_applications(start_date, end_date);

CREATE TABLE leave_approval_logs (
  id SERIAL PRIMARY KEY,
  application_id INT NOT NULL REFERENCES leave_applications(id) ON DELETE CASCADE,
  approver_id VARCHAR(20) NOT NULL,
  approver_company_id INT NOT NULL,
  approver_role VARCHAR(50) NOT NULL, -- Supervisor, HR, CEO
  action VARCHAR(20) NOT NULL, -- APPROVED, REJECTED, SENT_BACK
  comments TEXT,
  action_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_approval_approver FOREIGN KEY (approver_id, approver_company_id) REFERENCES employee(id, company_id) ON DELETE RESTRICT
);
CREATE INDEX idx_leave_approval_logs_application ON leave_approval_logs(application_id);
CREATE INDEX idx_leave_approval_logs_approver ON leave_approval_logs(approver_id);
CREATE INDEX idx_leave_approval_logs_action_date ON leave_approval_logs(action_date);

CREATE TABLE leave_recalls (
  id SERIAL PRIMARY KEY,
  leave_application_id INT NOT NULL REFERENCES leave_applications(id) ON DELETE CASCADE,
  recalled_by VARCHAR(20) NOT NULL,
  recalled_by_company_id INT NOT NULL,
  reason TEXT NOT NULL,
  recall_date DATE NOT NULL,
  actual_return_date DATE,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED
  employee_response TEXT,
  responded_at TIMESTAMP,
  days_restored DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_recalls_recalled_by FOREIGN KEY (recalled_by, recalled_by_company_id) REFERENCES employee(id, company_id) ON DELETE RESTRICT
);
CREATE INDEX idx_leave_recalls_application ON leave_recalls(leave_application_id);
CREATE INDEX idx_leave_recalls_recalled_by ON leave_recalls(recalled_by);
CREATE INDEX idx_leave_recalls_status ON leave_recalls(status);

CREATE TABLE leave_settings (
  id SERIAL PRIMARY KEY,
  company_id INT UNIQUE NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  saturday_half_day BOOLEAN DEFAULT true,
  sunday_off BOOLEAN DEFAULT true,
  fiscal_year_start_month INT DEFAULT 1,
  accrual_basis VARCHAR(20) DEFAULT 'ANNIVERSARY', -- ANNIVERSARY, CALENDAR_YEAR
  require_ceo_approval_for_managers BOOLEAN DEFAULT true,
  auto_approve_after_days INT,
  
  -- Accrual Configuration
  annual_leave_base_days INT DEFAULT 16,
  accrual_frequency VARCHAR(20) DEFAULT 'DAILY', -- DAILY, MONTHLY
  accrual_divisor INT DEFAULT 365,
  increment_period_years INT DEFAULT 2,
  increment_amount INT DEFAULT 1,
  max_annual_leave_cap INT,

  -- Expiry & Notification
  enable_leave_expiry BOOLEAN DEFAULT true,
  expiry_notification_days INT DEFAULT 30,
  balance_notification_enabled BOOLEAN DEFAULT true,
  notification_channels VARCHAR(100) DEFAULT 'EMAIL', -- EMAIL,IN_APP,PUSH

  -- Cash-Out Configuration
  enable_encashment BOOLEAN DEFAULT false,
  encashment_salary_divisor INT DEFAULT 30,
  max_encashment_days INT,
  encashment_rounding VARCHAR(10) DEFAULT 'ROUND', -- ROUND, FLOOR, CEIL

  -- Policy Versioning
  policy_effective_date DATE DEFAULT CURRENT_DATE,
  policy_version INT DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accrual_logs (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL REFERENCES leave_settings(company_id) ON DELETE CASCADE,
  employee_id VARCHAR(20) NOT NULL,
  leave_type_id INT NOT NULL,
  accrual_date DATE NOT NULL,
  days_accrued DECIMAL(6, 4) NOT NULL,
  cumulative_accrued DECIMAL(6, 2) NOT NULL,
  annual_entitlement INT NOT NULL,
  fiscal_year INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_accrual_log_employee_type_year ON accrual_logs(employee_id, leave_type_id, fiscal_year);
CREATE INDEX idx_accrual_log_date ON accrual_logs(accrual_date);

CREATE TABLE leave_cash_outs (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL,
  company_id INT NOT NULL,
  leave_type_id INT NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  fiscal_year INT NOT NULL,
  days_cashed_out DECIMAL(5, 2) NOT NULL,
  cash_value DECIMAL(12, 2) NOT NULL,
  monthly_salary DECIMAL(12, 2) NOT NULL,
  salary_divisor INT NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, APPROVED, PAID, REJECTED
  approved_by VARCHAR(20),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_leave_cash_out_employee FOREIGN KEY (employee_id, company_id) REFERENCES employee(id, company_id) ON DELETE CASCADE
);
CREATE INDEX idx_cash_out_employee_year ON leave_cash_outs(employee_id, fiscal_year);
