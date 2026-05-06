export const routeConstants = {
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  setupAccount: "/setup-account/:token",
  dashboard: "/admin/dashboard",

  // =========================
  // OKR MODULE
  // =========================

  okr: "/admin/okr",

  // Cycle Management
  okrCycles: "/admin/okr/cycles",
  okrCreateCycle: "/admin/okr/cycles/create",
  okrCycleDetail: "/admin/okr/cycles/:cycleId",

  // Company Objectives
  okrObjectives: "/admin/okr/objectives",
  okrObjectiveDetail: "/admin/okr/objectives/:objectiveId",

  okrCreateObjective: "/admin/okr/objectives/create",
  okrEditObjective: "/admin/okr/objectives/:objectiveId/edit",
  okrCreateKR: "/admin/okr/objectives/:objectiveId/kr/create",
  okrAssignDepartment: "/admin/okr/objectives/:objectiveId/assign",

  // Department Planning
  okrDepartmentPlanning: "/admin/okr/departments",
  okrDepartmentDetail: "/admin/okr/departments/:departmentId",

  // Week 3 — leadership / gallery / config / archive (UI shells; wire APIs later)
  okrCeoStrategicDashboard: "/admin/okr/leadership/strategic",
  okrDepartmentComparison: "/admin/okr/leadership/compare",
  okrCompanyGallery: "/admin/okr/gallery",
  okrConfiguration: "/admin/okr/configuration",
  okrArchiveManagement: "/admin/okr/archive",
  okrArchiveDetail: "/admin/okr/archive/:archiveId",
  okrAuditLogs: "/admin/okr/audit/logs",
  okrConfigSnapshotDetail: "/admin/okr/audit/snapshots/:snapshotId",
  okrDepartmentApprovalQueue: "/admin/okr/approvals",
  okrApprovalQueue: "/manager/okr/approvals",

  okrContributorAssignment: "/manager/okr/contributors",
  okrManagerDepartmentPlanning: "/manager/okr/planning",
  okrMyExecution: "/employee/execution",
  okrEmployeeObjectiveDetail: "/employee/execution/objectives/:objectiveId",
  okrTeamExecutionMonitor: "/manager/okr/team-execution",
  okrReviews: "/okr/reviews",
  okrReviewDetail: "/okr/reviews/:planId",
  okrPlanningCompliance: "/manager/okr/planning-compliance",

  createUser: "/admin/users/create",
  assignManager: "/admin/managers/assign",
  managerDetail: "/admin/managers/:managerId",
  createEmployment: "/admin/employment/create",
  createEmployee: "/admin/employees/create",
  employees: "/admin/employees",
  adminEmployeeSettings: "/admin/employees/settings",
  employeeDetail: "/admin/employees/:employeeId",
  fullEmployeeProfile: "/admin/employees/:employeeId/full-profile",
  submittedUsers: "/admin/users/submitted",
  submittedUserDetail: "/admin/users/submitted/:userId",
  pendingUsers: "/admin/users/pending",
  departments: "/admin/departments",
  employeeLogin: "/employee-login",
  adminLogin: "/admin-login",
  employeeOnboarding: "/employee/onboarding",
  employeeLeave: "/employee/leave",
  employeeLeaveHistory: "/employee/leave/history",
  employeeLeaveRecall: "/employee/leave-recall",
  employeeLeaveCashOut: "/employee/leave-cash-out",
  employeeProfile: "/employee/profile",
  employeeDashboard: "/employee/dashboard",
  employeeSettings: "/employee/settings",
  employeeDepartmentTree: "/employee/department-tree",
  settings: "/admin/settings",
  adminProfile: "/admin/profile",

  // Missing routes restored
  waitingApproval: "/employee/waiting-approval",
  promoteEmployee: "/admin/employees/:id/promote",

  // Admin Leave Management
  adminLeaves: "/admin/leaves",
  adminLeaveTypes: "/admin/leave-types",
  adminPublicHolidays: "/admin/public-holidays",
  adminLeaveSettings: "/admin/leave-settings",
  buildTeam: "/admin/managers/:managerId/build-team",

  // Manager Routes
  managerMyTeam: "/manager/my-team",
  managerTeamLeaves: "/manager/team-leaves",
  managerTeamOnLeave: "/manager/team-on-leave",
  managerDepartmentTree: "/manager/department-tree",

  roleManagement: "/admin/roles",

  notFound: "*",
  noAuthorized: "/no-authorized",
};

export const USER_ROLES = {
  ADMIN: "Admin",
  HR: "HR",
  EMPLOYEE: "Employee",
  SUPER_ADMIN: "Super Admin",
};

export const SUPER_ADMIN_ROLES = [
  "Super Admin",
  "SuperAdmin",
  "Superadmin",
  "superadmin",
  "super admin",
  "SUPERADMIN",
];

export const ROLE_OPTIONS = [
  { name: "Admin" },
  { name: "Employee" },
  { name: "HR" },
] as const;

export const getRoleNameById = (roleId?: number | null): string => {
  if (!roleId) return "Employee";
  if ([1, 2].includes(roleId)) return "Admin";
  if (roleId === 4) return "HR"; // Assuming HR ID is 4 based on previous common patterns or seed
  return "Employee";
};
