export const departments = [
  // User provided
  "Chief Executive Officer", // Kept as requested, though usually a role
  "PMO",
  "Procurement and Facility Management",
  "Finance",
  "Human Resource",
  "Partnership & Business Development",
  "Operations",
  "Marketing & Communication",
  "Sales and Distribution",
  "Technology",
  "Legal",
  "Business Development",
  "Customer Support",
  "Presales",
  "Sales & Marketing",
  "Human Resources and Corporate Services",
];

export const jobTitles = [
  // User provided
  { title: "Chief Executive Officer", level: "Executive" },
  { title: "Project Management Office Manager", level: "Manager" },
  { title: "Procurement and Facility Management - Head", level: "Director" },
  { title: "Human Resource and Corporate Services Director", level: "Director" },
  { title: "Business Development Director", level: "Director" },
  { title: "Head of Finance", level: "Director" },
  { title: "Senior Accountant", level: "Senior" },
  { title: "HR Specialist", level: "Mid" },
  { title: "Partnership and Business Development Manager", level: "Manager" },
  { title: "Human Resource and Corporate Services Manager", level: "Manager" },
  { title: "Product Owner", level: "Mid" },
  { title: "Data Science and Insight Analyst", level: "Mid" },
  { title: "Business Development and Innovation Expert", level: "Senior" },
  { title: "Junior Operations Expert", level: "Junior" },
  { title: "Contact Center Supervisor", level: "Senior" },
  { title: "Senior Sales Representative", level: "Senior" },
  { title: "Dispute and Reconcilation Management Expert", level: "Senior" },
  { title: "Operation Specialist", level: "Mid" },
  { title: "Operations Expert", level: "Senior" },
  { title: "Manager - Operations", level: "Manager" },
  { title: "Head- Dispute & Reconcilation", level: "Director" },
  { title: "Marketing and Communications Manager", level: "Manager" },
  { title: "UI/UX & Graphics Designer", level: "Mid" },
  { title: "Creative and Content Developer", level: "Mid" },
  { title: "Digital Marketing Specialist", level: "Mid" },
  { title: "Sales and Distribution Specialist", level: "Mid" },
  { title: "Sales and Distribution Manager", level: "Manager" },
  { title: "Regional Coordinator", level: "Manager" },
  { title: "Deputy Chief Technology Officer", level: "Executive" },
  { title: "Tech Lead", level: "Lead" },
  { title: "Lead-Mobile App Development", level: "Lead" },
  { title: "Senior Software Engineer", level: "Senior" },
  { title: "Senior Network Adminstrator", level: "Senior" },
  { title: "System Administrator", level: "Mid" },
  { title: "Senior Back end Engineer", level: "Senior" },
  { title: "Junior Software Engineer", level: "Junior" },
  { title: "Front-End Engineer", level: "Mid" },
  { title: "Mobile App Developer", level: "Mid" },
  { title: "Senior Mobile App Developer", level: "Senior" },
  { title: "QA and Process Engineer", level: "Mid" },
  { title: "Sales Representative", level: "Entry" },
  { title: "Junior Sales Representative", level: "Junior" },
  {title: "Sales Executive", level: "Senior" },

  // Existing Merged
  { title: "Office Administrator", level: "Entry" },
  { title: "HR Officer", level: "Mid" },
  { title: "HR Manager", level: "Manager" },
  { title: "Accountant", level: "Mid" },
  { title: "Finance Manager", level: "Manager" },
  { title: "Software Engineer", level: "Mid" },
  { title: "DevOps Engineer", level: "Mid" },
  { title: "Sales Manager", level: "Manager" },
  { title: "General Manager", level: "Executive" },
];

export const roles = ["Admin", "HR", "Employee"];

export const resources = [
  // Core resources
  { code: "EMPLOYEE", name: "Employee Management" },
  { code: "EMPLOYMENT", name: "Employment Management" },
  { code: "USER", name: "User Management" },
  { code: "COMPANY", name: "Company Management" },
  { code: "ROLE", name: "Role Management" },
  // Leave management resources
  { code: "LEAVE_TYPE", name: "Leave Types" },
  { code: "LEAVE_APPLICATION", name: "Leave Applications" },
  { code: "LEAVE_BALANCE", name: "Leave Balances" },
  { code: "LEAVE_RECALL", name: "Leave Recalls" },
  { code: "PUBLIC_HOLIDAY", name: "Public Holidays" },
  { code: "LEAVE_SETTINGS", name: "Leave Settings" },
  { code: "EMPLOYEE_SETTINGS", name: "Employee Settings" },
  { code: "SETTINGS", name: "System Settings" },
  { code: "JOB_TITLE", name: "Job Title Management" },
  { code: "DEPARTMENT", name: "Department Management" },
  { code: "JOB_LEVEL", name: "Job Level Management" },
  { code: "ALLOWANCE_TYPE", name: "Allowance Type Management" },
  { code: "EDUCATION_LEVEL", name: "Education Level Management" },
  { code: "FIELD_OF_STUDY", name: "Field of Study Management" },
  { code: "INSTITUTION", name: "Institution Management" },
  { code: "BANK", name: "Bank Management" },
  { code: "EMERGENCY_CONTACT", name: "Emergency Contact Management" },
  { code: "EMPLOYEE_ADDRESS", name: "Employee Address Management" },
  { code: "EMPLOYEE_PHONE", name: "Employee Phone Management" },
  { code: "EMPLOYEE_EDUCATION", name: "Employee Education Management" },
  { code: "EMPLOYEE_EXPERIENCE", name: "Employee Experience Management" },
  { code: "EMPLOYEE_ALLOWANCE", name: "Employee Allowance Management" },
  { code: "EMPLOYEE_CERTIFICATE", name: "Employee Certificate Management" },
  { code: "EMPLOYEE_RESIGNATION", name: "Employee Resignation Management" },
  { code: "CAREER_EVENT", name: "Career Event Management" },
  { code: "FINANCIAL_DETAIL", name: "Financial Detail Management" },
  { code: "DOCUMENT_SIGNER", name: "Document Signer Management" },
  { code: "EMPLOYEE_DOCUMENT", name: "Employee Document Management" },
  { code: "EMPLOYEE_COST_SHARING", name: "Employee Cost Sharing Management" },
  { code: "LEAVE_CASH_OUT", name: "Leave Cash Out Management" },
  { code: "CELEBRATION", name: "Celebration Management" },
  { code: "NOTIFICATION", name: "Notification Management" },
  // OKR Resources
  { code: "OKR_CYCLE", name: "OKR Cycles" },
  { code: "OKR_CONFIG", name: "OKR Configuration" },
  { code: "OKR_METRIC", name: "OKR Metrics" },
  { code: "COMPANY_OBJECTIVE", name: "Company Objectives" },
  { code: "COMPANY_KR", name: "Company Key Results" },
  { code: "DEPARTMENT_OBJECTIVE", name: "Department Objectives" },
  { code: "DEPARTMENT_KR", name: "Department Key Results" },
  { code: "EMPLOYEE_OBJECTIVE", name: "Employee Objectives" },
  { code: "EMPLOYEE_KR", name: "Employee Key Results" },
  { code: "OKR_PROGRESS", name: "OKR Progress Updates" },
  { code: "OKR_AUDIT", name: "OKR Audit/Activity Logs" },
];

export const allActions = [
  "create:any",
  "read:any",
  "update:any",
  "delete:any",
  "create:own",
  "read:own",
  "update:own",
  "delete:own",
];

export const employeePermissions = [
  // User - can read/update own profile
  { resource: "USER", actions: ["read:own", "update:own"] },
  // Employee - can read own details and team details
  {
    resource: "EMPLOYEE",
    actions: ["read:own", "update:own", "read:team"],
  },
  // Employment - can read own employment and team
  { resource: "EMPLOYMENT", actions: ["read:own", "read:team"] },
  // Leave Types - can read
  { resource: "LEAVE_TYPE", actions: ["read:own", "read:any"] },
  // Leave Applications - can create own, read own, update own (cancel), manage team
  {
    resource: "LEAVE_APPLICATION",
    actions: [
      "create:own",
      "read:own",
      "update:own",
      "read:team",
      "update:team",
    ],
  },
  // Leave Balances - can read own and team
  { resource: "LEAVE_BALANCE", actions: ["read:own", "read:team"] },
  // Leave Recalls - can read own, update own (respond), manage team
  {
    resource: "LEAVE_RECALL",
    actions: ["read:own", "update:own", "read:team", "update:team"],
  },
  // Public Holidays - can read
  { resource: "PUBLIC_HOLIDAY", actions: ["read:any"] },
  // Company - can read and create (Job Titles, Departments etc are needed for onboarding)
  { resource: "COMPANY", actions: ["read:any", "create:any"] },
  // Settings - can read and create
  { resource: "SETTINGS", actions: ["read:any", "create:any"] },
  // Employee Settings - can read (so users understand probation periods, though mainly HR modifies)
  { resource: "EMPLOYEE_SETTINGS", actions: ["read:any"] },
  // Job Titles - can read and create
  { resource: "JOB_TITLE", actions: ["read:any", "create:any"] },
  // Departments - can read and create
  { resource: "DEPARTMENT", actions: ["read:any", "create:any"] },
  // Job Levels - can read and create
  { resource: "JOB_LEVEL", actions: ["read:any", "create:any"] },
  // Allowance Types - can read
  { resource: "ALLOWANCE_TYPE", actions: ["read:any"] },
  // Education Levels - can read and create
  { resource: "EDUCATION_LEVEL", actions: ["read:any", "create:any"] },
  // Fields of Study - can read & create (user can add new ones)
  { resource: "FIELD_OF_STUDY", actions: ["read:any", "create:any"] },
  // Institutions - can read & create (user can add new ones)
  { resource: "INSTITUTION", actions: ["read:any", "create:any"] },
  // Banks - can read
  { resource: "BANK", actions: ["read:any"] },
  // Emergency Contact - own CRUD
  {
    resource: "EMERGENCY_CONTACT",
    actions: ["create:own", "read:own", "update:own", "delete:own"],
  },
  // Employee Address - own CRUD
  {
    resource: "EMPLOYEE_ADDRESS",
    actions: ["create:own", "read:own", "update:own", "delete:own"],
  },
  // Employee Phone - own CRUD
  {
    resource: "EMPLOYEE_PHONE",
    actions: ["create:own", "read:own", "update:own", "delete:own"],
  },
  // Employee Education - own CRUD
  {
    resource: "EMPLOYEE_EDUCATION",
    actions: ["create:own", "read:own", "update:own", "delete:own"],
  },
  // Employee Experience - own CRUD
  {
    resource: "EMPLOYEE_EXPERIENCE",
    actions: ["create:own", "read:own", "update:own", "delete:own"],
  },
  // Employee License - own CRUD
  {
    resource: "EMPLOYEE_CERTIFICATE",
    actions: ["create:own", "read:own", "update:own", "delete:own"],
  },
  // Financial Detail - own CRUD
  {
    resource: "FINANCIAL_DETAIL",
    actions: ["create:own", "read:own", "update:own", "delete:own"],
  },
  // Employee Document - own CRUD
  {
    resource: "EMPLOYEE_DOCUMENT",
    actions: ["create:own", "read:own", "update:own", "delete:own"],
  },
  // Employee Cost Sharing
  { resource: "EMPLOYEE_COST_SHARING", actions: ["read:own"] },
  // Leave Cash Out - own and team (for manager approval)
  {
    resource: "LEAVE_CASH_OUT",
    actions: ["create:own", "read:own", "read:team", "update:team"],
  },
  // Celebration - can read
  { resource: "CELEBRATION", actions: ["read:any"] },
  // Notification - own
  {
    resource: "NOTIFICATION",
    actions: ["read:own", "update:own", "delete:own"],
  },
  // Allowance - own
  { resource: "EMPLOYEE_ALLOWANCE", actions: ["read:own"] },
  // Resignation - own creation
  { resource: "EMPLOYEE_RESIGNATION", actions: ["create:own", "read:own"] },
  // Career events - own and team (team for manager view)
  { resource: "CAREER_EVENT", actions: ["read:own", "read:team"] },
  // OKR Module - Employees can read cycles, objectives, etc., and manage their own OKRs
  { resource: "OKR_CYCLE", actions: ["read:any"] },
  { resource: "COMPANY_OBJECTIVE", actions: ["read:any"] },
  { resource: "COMPANY_KR", actions: ["read:any"] },
  { resource: "DEPARTMENT_OBJECTIVE", actions: ["read:any"] },
  { resource: "DEPARTMENT_KR", actions: ["read:any"] },
  {
    resource: "EMPLOYEE_OBJECTIVE",
    actions: ["create:own", "read:own", "update:own", "delete:own", "read:team"],
  },
  {
    resource: "EMPLOYEE_KR",
    actions: ["create:own", "read:own", "update:own", "delete:own", "read:team"],
  },
  {
    resource: "OKR_PROGRESS",
    actions: ["create:own", "read:own", "update:own", "read:team"],
  },
];

export const getLeaveTypes = (companyId: number) => [
  {
    company_id: companyId,
    name: "Annual Leave",
    code: "ANNUAL",
    default_allowance_days: 16, // 16 working days for first year
    incremental_days_per_year: 1, // +1 day for every 2 years (handled in logic)
    max_accrual_limit: null,
    is_carry_over_allowed: true,
    carry_over_expiry_months: 24, // Maximum postponement: 2 years
    applicable_gender: "All",
    requires_attachment: false,
    is_paid: true,
    is_accrual_based: true,
  },
  {
    company_id: companyId,
    name: "Marriage Leave",
    code: "MARRIAGE",
    default_allowance_days: 3, // 3 working days
    incremental_days_per_year: 0,
    max_accrual_limit: null,
    is_carry_over_allowed: false,
    carry_over_expiry_months: null,
    applicable_gender: "All",
    requires_attachment: true, // Marriage certificate
    is_paid: true,
  },
  {
    company_id: companyId,
    name: "Maternity Leave (Pre-natal)",
    code: "MATERNITY_PRE",
    default_allowance_days: 30, // 30 consecutive days before childbirth
    incremental_days_per_year: 0,
    max_accrual_limit: null,
    is_carry_over_allowed: false,
    carry_over_expiry_months: null,
    applicable_gender: "Female",
    requires_attachment: true, // Medical certificate
    is_paid: true,
  },
  {
    company_id: companyId,
    name: "Maternity Leave (Post-natal)",
    code: "MATERNITY_POST",
    default_allowance_days: 90, // 90 consecutive days after childbirth
    incremental_days_per_year: 0,
    max_accrual_limit: null,
    is_carry_over_allowed: false,
    carry_over_expiry_months: null,
    applicable_gender: "Female",
    requires_attachment: true, // Medical certificate
    is_paid: true,
  },
  {
    company_id: companyId,
    name: "Paternity Leave",
    code: "PATERNITY",
    default_allowance_days: 3, // 3 consecutive days
    incremental_days_per_year: 0,
    max_accrual_limit: null,
    is_carry_over_allowed: false,
    carry_over_expiry_months: null,
    applicable_gender: "Male",
    requires_attachment: true, // Birth certificate
    is_paid: true,
  },
  {
    company_id: companyId,
    name: "Mourning/Bereavement Leave",
    code: "MOURNING",
    default_allowance_days: 3, // 3 working days
    incremental_days_per_year: 0,
    max_accrual_limit: null,
    is_carry_over_allowed: false,
    carry_over_expiry_months: null,
    applicable_gender: "All",
    requires_attachment: false, // Death certificate optional
    is_paid: true,
  },
  {
    company_id: companyId,
    name: "Sick Leave",
    code: "SICK",
    default_allowance_days: 180, // 6 months total (30 days @100%, 60 days @50%, 90 days @0%)
    incremental_days_per_year: 0,
    max_accrual_limit: null,
    is_carry_over_allowed: false,
    carry_over_expiry_months: null,
    applicable_gender: "All",
    requires_attachment: true, // Medical certificate required
    is_paid: true, // Payment tiers handled in payroll
  },
  {
    company_id: companyId,
    name: "Unpaid Leave",
    code: "UNPAID",
    default_allowance_days: 5, // Max 5 consecutive days per request
    incremental_days_per_year: 0,
    max_accrual_limit: null,
    is_carry_over_allowed: false,
    carry_over_expiry_months: null,
    applicable_gender: "All",
    requires_attachment: false,
    is_paid: false,
  },
];

export const allowanceTypes = [
  {
    name: "Representation Allowance",
    description: "Allowance for representation expenses",
  },
  { name: "Meal Allowance", description: "Daily meal allowance" },
  { name: "Housing Allowance", description: "Monthly housing support" },
  { name: "Transportation", description: "Transport allowance" },
  {
    name: "Project Allowance",
    description: "Allowance for specific project duties",
  },
];

// ---------------------------------------------------------------------------
// EDUCATION LOOKUP TABLES
// ---------------------------------------------------------------------------

export const educationLevels = [
  { name: "Certificate", display_order: 1 },
  { name: "Diploma", display_order: 2 },
  { name: "Advanced Diploma", display_order: 3 },
  { name: "Bachelor's Degree", display_order: 4 },
  { name: "Master's Degree", display_order: 5 },
  { name: "PhD", display_order: 6 },
];

export const fieldsOfStudy = [
  "Accounting",
  "Architecture",
  "Banking & Finance",
  "Business Administration",
  "Chemical Engineering",
  "Civil Engineering",
  "Computer Science",
  "Data Science",
  "Economics",
  "Electrical Engineering",
  "Finance",
  "Human Resource Management",
  "Information Systems",
  "Information Technology",
  "Law",
  "Management",
  "Marketing",
  "Mechanical Engineering",
  "Project Management",
  "Public Administration",
  "Software Engineering",
  "Statistics",
];

export const institutions = [
  { name: "Addis Ababa University", category: "Government" as const },
  {
    name: "Adama Science and Technology University",
    category: "Government" as const,
  },
  { name: "Jimma University", category: "Government" as const },
  { name: "University of Gondar", category: "Government" as const },
  { name: "Hawassa University", category: "Government" as const },
  { name: "Bahir Dar University", category: "Government" as const },
  { name: "Arba Minch University", category: "Government" as const },
  { name: "St. Mary's University", category: "Private" as const },
  { name: "Unity University", category: "Private" as const },
  {
    name: "Addis Ababa Science and Technology University",
    category: "Government" as const,
  },
];

export const publicHolidays = [
  { name: "Ethiopian Christmas", date: "2026-01-07", description: "Genna" },
  { name: "Epiphany / Timket", date: "2026-01-19", description: "Timket" },
  {
    name: "Adwa Victory Day",
    date: "2026-03-02",
    description: "Victory of Adwa",
  },
  {
    name: "Siklet / Good Friday",
    date: "2026-05-03",
    description: "Ethiopian Good Friday",
  },
  {
    name: "Fasika / Easter",
    date: "2026-05-05",
    description: "Ethiopian Easter",
  },
  {
    name: "Patriots' Day",
    date: "2026-05-05",
    description: "Return of Emperor Haile Selassie",
  },
  {
    name: "Eid al-Fitr",
    date: "2024-04-10",
    description: "End of Ramadan (Tentative)",
  },
  {
    name: "Eid al-Adha",
    date: "2024-06-17",
    description: "Arafat (Tentative)",
  },
  { name: "Ethiopian New Year", date: "2024-09-11", description: "Enkutatash" },
  {
    name: "Meskel",
    date: "2024-09-27",
    description: "Finding of the True Cross",
  },
];

// ---------------------------------------------------------------------------
// HR LOOKUP TABLES
// ---------------------------------------------------------------------------

export const separationReasons = [
  {
    reason_category: "Resignation",
    reason_detail: "Personal reasons",
    requires_exit_interview: true,
  },
  {
    reason_category: "Resignation",
    reason_detail: "Better opportunity",
    requires_exit_interview: true,
  },
  {
    reason_category: "Termination",
    reason_detail: "Performance",
    requires_exit_interview: true,
  },
  {
    reason_category: "Termination",
    reason_detail: "Policy violation",
    requires_exit_interview: true,
  },
  {
    reason_category: "End of Contract",
    reason_detail: "Contract completed",
    requires_exit_interview: false,
  },
  {
    reason_category: "Other",
    reason_detail: "Other",
    requires_exit_interview: false,
  },
];

export const banks = [
  { name: "Commercial Bank of Ethiopia", swift_code: "CBETETAA" },
  { name: "Awash Bank", swift_code: "AABORETH" },
  { name: "Dashen Bank", swift_code: "DASHETAA" },
  { name: "Bank of Abyssinia", swift_code: "AABORETH" },
  { name: "United Bank", swift_code: "UNTDETAA" },
  { name: "Wegagen Bank", swift_code: "WEABOREA" },
  { name: "Nib International Bank", swift_code: "NIBISETX" },
  { name: "Cooperative Bank of Oromia", swift_code: "CABOROAA" },
  { name: "Lion International Bank", swift_code: "LIBNETAA" },
  { name: "Zemen Bank", swift_code: "ZEMEETAA" },
  { name: "Oromia International Bank", swift_code: "OABORETH" },
  { name: "Bunna International Bank", swift_code: "BUIBETAA" },
  { name: "Berhan Bank", swift_code: "BERHETAA" },
  { name: "Abay Bank", swift_code: "AABORETH" },
  { name: "Addis International Bank", swift_code: "ADIBETAA" },
  { name: "Debub Global Bank", swift_code: "DEGAETAA" },
  { name: "Enat Bank", swift_code: "ABOROREL" },
  { name: "Hibret Bank", swift_code: "HIBRETAA" },
  { name: "Gadaa Bank", swift_code: null },
  { name: "Ahadu Bank", swift_code: null },
  { name: "Siinqee Bank", swift_code: null },
  { name: "Zamzam Bank", swift_code: null },
  { name: "Goh Betoch Bank", swift_code: null },
  { name: "Hijra Bank", swift_code: null },
];
