const RAW_BASE_URL =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_BASE_URL;

if (!RAW_BASE_URL) {
  throw new Error(
    "Missing API base URL. Set VITE_API_URL (recommended) or VITE_BASE_URL in frontend/.env (example: VITE_API_URL=http://localhost:5000/api/v1).",
  );
}

const BASE_URL = String(RAW_BASE_URL).replace(/\/+$/, "");

export const SERVER_URL = BASE_URL.replace(/\/api\/v1\/?$/, "");

const apiRoutes = {
  // Define your routes here as you add them
  auth: `${BASE_URL}/auth`,
  login: `${BASE_URL}/auth/login`,
  // Auth helpers used by authSaga
  me: `${BASE_URL}/users/me`,
  forgotPassword: `${BASE_URL}/auth/forgotPassword`,
  resetPassword: `${BASE_URL}/auth/resetPassword/:token`,
  updateMyPassword: `${BASE_URL}/auth/updateMyPassword`,
  updateMyEmail: `${BASE_URL}/auth/updateMyEmail`,
  activateAccount: (token: string) =>
    `${BASE_URL}/auth/activate-account/${token}`,
  users: `${BASE_URL}/users`,
  employees: `${BASE_URL}/employees`,
  employeeDetail: (id: string) => `${BASE_URL}/employees/${id}/detail`,
  employments: `${BASE_URL}/employments`,
  employmentById: (id: number) => `${BASE_URL}/employments/${id}`,
  employmentByEmployee: (id: string) =>
    `${BASE_URL}/employments/employee/${id}`,
  promote: `${BASE_URL}/employments/promote`,
  careerPromote: `${BASE_URL}/employments/promote`,
  careerDemote: `${BASE_URL}/employments/demote`,
  careerTransfer: `${BASE_URL}/employments/transfer`,
  careerEvents: `${BASE_URL}/career-events`,
  careerEventsByEmployee: (id: string) =>
    `${BASE_URL}/career-events/employee/${id}`,
  departments: `${BASE_URL}/departments`,
  assignDepartmentHead: (id: number | string) =>
    `${BASE_URL}/departments/${id}/assign-head`,
  jobTitles: `${BASE_URL}/job-titles`,

  jobLevels: `${BASE_URL}/job-levels`,
  institutions: `${BASE_URL}/institutions`,
  fieldsOfStudy: `${BASE_URL}/field-of-study`,
  employeesCount: `${BASE_URL}/employments/count`,
  employeeTabCounts: `${BASE_URL}/employees/tab-counts`,
  departmentsCount: `${BASE_URL}/departments/count`,
  activeEmploymentsCount: `${BASE_URL}/employments/count/active`,
  inactiveEmploymentsCount: `${BASE_URL}/employments/count/inactive`,
  managersCount: `${BASE_URL}/employments/count/managers`,
  genderDist: `${BASE_URL}/employments/gender-dist`,
  empTypeDist: `${BASE_URL}/employments/emp-type-dist`,
  deptDist: `${BASE_URL}/employments/dept-dist`,
  jobLevelDist: `${BASE_URL}/employments/job-dist`,
  managerDist: `${BASE_URL}/employments/manager-dist`,
  allowanceTypes: `${BASE_URL}/allowance-types`,
  onboarding: `${BASE_URL}/onboarding`,
  onboardingStatus: `${BASE_URL}/onboarding/status`,
  onboardingPersonalInfo: `${BASE_URL}/onboarding/personal-info`,
  onboardingContactInfo: `${BASE_URL}/onboarding/contact-info`,
  onboardingEducation: `${BASE_URL}/onboarding/education`,
  onboardingWorkExperience: `${BASE_URL}/onboarding/work-experience`,
  onboardingCertifications: `${BASE_URL}/onboarding/certifications`,
  onboardingDocuments: `${BASE_URL}/onboarding/documents`,
  onboardingSignature: `${BASE_URL}/onboarding/signature`,
  onboardingFinancialDetails: `${BASE_URL}/onboarding/financial-details`,
  educations: `${BASE_URL}/educations`,
  approveOnboarding: (id: string) =>
    `${BASE_URL}/employees/${id}/approve-onboarding`,
  activate: (id: string) => `${BASE_URL}/employees/${id}/activate`,
  // Granular Updates
  updatePersonal: (id: string) =>
    `${BASE_URL}/employees/${id}/personal-details`,
  updateSignature: (id: string) => `${BASE_URL}/employees/${id}/signature`,
  updateFinancial: (id: string) =>
    `${BASE_URL}/employees/${id}/financial-details`,
  updateEmployment: (id: string) =>
    `${BASE_URL}/employees/${id}/employment-details`,
  updateContact: (id: string) => `${BASE_URL}/employees/${id}/contact-info`,
  updateAddresses: (id: string) => `${BASE_URL}/employees/${id}/addresses`,
  updatePhones: (id: string) => `${BASE_URL}/employees/${id}/phones`,
  updateEducation: (id: string) =>
    `${BASE_URL}/employees/${id}/education-details`,
  updateWorkExperience: (id: string) =>
    `${BASE_URL}/employees/${id}/work-experience-details`,
  updateCertifications: (id: string) =>
    `${BASE_URL}/employees/${id}/certifications-details`,
  updateDocuments: (id: string) =>
    `${BASE_URL}/employees/${id}/documents-details`,
  updateEmergencyContacts: (id: string) =>
    `${BASE_URL}/employees/${id}/emergency-contacts`,
  updateBankAccounts: (id: string) =>
    `${BASE_URL}/employees/${id}/bank-accounts`,

  suggestions: {
    departments: `${BASE_URL}/suggestions/departments`,
    jobTitles: `${BASE_URL}/suggestions/job-titles`,
    jobLevels: `${BASE_URL}/suggestions/job-levels`,
    fieldsOfStudy: `${BASE_URL}/suggestions/fields-of-study`,
    institutions: `${BASE_URL}/suggestions/institutions`,
  },
  upload: `${BASE_URL}/upload`,
  exportFields: (
    type: "employee" | "employment" | "leave" | "leave_balance" | "on_leave",
  ) => `${BASE_URL}/export/fields?type=${type}`,
  exportEmployees: `${BASE_URL}/export/employees`,
  exportLeaves: `${BASE_URL}/export/leaves`,
  exportLeaveBalances: `${BASE_URL}/export/leave-balances`,
  exportOnLeave: `${BASE_URL}/export/on-leave`,
  assignManagers: {
    search: `${BASE_URL}/assign-managers/search`,
    bulkAssign: `${BASE_URL}/assign-managers/bulk-assign`,
    existingManagers: `${BASE_URL}/assign-managers/existing-managers`,
    removeMember: `${BASE_URL}/assign-managers/remove-member`,
    teamMembers: (id: string) =>
      `${BASE_URL}/assign-managers/${id}/team-members`,
  },
  analytics: {
    advancedStats: `${BASE_URL}/analytics/advanced-stats`,
  },
  experienceLetter: (id: string) => `${BASE_URL}/experience-letter/${id}`,
  certificateOfService: (id: string) =>
    `${BASE_URL}/certificate-of-service/${id}`,
  resignationLetter: (id: string) => `${BASE_URL}/resignation-letter/${id}`,

  // Leave Management
  leaveTypes: `${BASE_URL}/leave-types`,
  leaveTypeById: (id: string | number) => `${BASE_URL}/leave-types/${id}`,
  applicableLeaveTypes: `${BASE_URL}/leave-types/applicable`,
  seedLeaveTypes: `${BASE_URL}/leave-types/seed-defaults`,
  seedDefaultLeaveTypes: `${BASE_URL}/leave-types/seed-defaults`,
  leaveBalances: `${BASE_URL}/leave-balances`,
  leaveBalanceByEmployee: (employeeId: string) =>
    `${BASE_URL}/leave-balances/employee/${employeeId}`,
  myLeaveBalance: `${BASE_URL}/leave-balances/me`,
  adjustLeaveBalance: (id: string) => `${BASE_URL}/leave-balances/${id}/adjust`,
  allocateLeaveBalance: (employeeId: string) =>
    `${BASE_URL}/leave-balances/allocate/${employeeId}`,
  bulkAllocateLeaveBalance: `${BASE_URL}/leave-balances/bulk-allocate`,
  expiringLeaveBalances: `${BASE_URL}/leave-balances/expiring`,
  notifyExpiringBalances: `${BASE_URL}/leave-balances/notify-expiring`,
  carryOverLeave: `${BASE_URL}/leave-balances/carry-over`,
  leaveApplications: `${BASE_URL}/leave-applications`,
  leaveApplicationById: (id: string | number) =>
    `${BASE_URL}/leave-applications/${id}`,
  myLeaveApplications: `${BASE_URL}/leave-applications/me`,
  leaveApplicationsMe: `${BASE_URL}/leave-applications/me`,
  pendingLeaveApplications: `${BASE_URL}/leave-applications/pending`,
  leaveApplicationsPending: `${BASE_URL}/leave-applications/pending`,
  pendingLeaveCancellations: `${BASE_URL}/leave-applications/pending-cancellations`,
  onLeaveEmployees: `${BASE_URL}/leave-applications/on-leave`,
  leaveApplicationsOnLeave: `${BASE_URL}/leave-applications/on-leave`,
  leaveApplicationsStats: `${BASE_URL}/leave-applications/stats`,
  tabCounts: `${BASE_URL}/leave-applications/tab-counts`,
  cancellableLeaves: `${BASE_URL}/leave-applications/cancellable`,
  approveLeaveApplication: (id: string | number) =>
    `${BASE_URL}/leave-applications/${id}/approve`,
  rejectLeaveApplication: (id: string | number) =>
    `${BASE_URL}/leave-applications/${id}/reject`,
  cancelLeaveApplication: (id: string | number) =>
    `${BASE_URL}/leave-applications/${id}/cancel`,
  requestLeaveCancellation: (id: string | number) =>
    `${BASE_URL}/leave-applications/${id}/request-cancellation`,
  approveLeaveCancellation: (id: string | number) =>
    `${BASE_URL}/leave-applications/${id}/approve-cancellation`,
  rejectLeaveCancellation: (id: string | number) =>
    `${BASE_URL}/leave-applications/${id}/reject-cancellation`,
  leaveRecalls: `${BASE_URL}/leave-recalls`,
  leaveRecallById: (id: string | number) => `${BASE_URL}/leave-recalls/${id}`,
  myLeaveRecalls: `${BASE_URL}/leave-recalls/me`,
  activeLeavesForRecall: `${BASE_URL}/leave-recalls/active-leaves`,
  respondToRecall: (id: string) => `${BASE_URL}/leave-recalls/${id}/respond`,
  leaveReliefOfficers: `${BASE_URL}/leave-applications/relief-officers`,
  leaveStats: `${BASE_URL}/leave-applications/statistics`,
  leaveSettings: `${BASE_URL}/leave-settings`,

  // Leave Cash-Out
  calculateCashOut: `${BASE_URL}/leave-cash-out/calculate`,
  requestCashOut: `${BASE_URL}/leave-cash-out/request`,
  myCashOutRequests: `${BASE_URL}/leave-cash-out/my-requests`,
  allCashOutRequests: `${BASE_URL}/leave-cash-out`,
  approveCashOut: (id: string) => `${BASE_URL}/leave-cash-out/${id}/approve`,
  rejectCashOut: (id: string) => `${BASE_URL}/leave-cash-out/${id}/reject`,

  // Public Holidays
  publicHolidays: `${BASE_URL}/public-holidays`,
  publicHolidayById: (id: string | number) =>
    `${BASE_URL}/public-holidays/${id}`,
  seedDefaultHolidays: `${BASE_URL}/public-holidays/seed-defaults`,
  upcomingHolidays: `${BASE_URL}/public-holidays/upcoming`,

  // Notifications
  notifications: `${BASE_URL}/notifications`,
  unreadNotificationsCount: `${BASE_URL}/notifications/unread-count`,
  markNotificationRead: (id: string | number) =>
    `${BASE_URL}/notifications/${id}/read`,
  markAllNotificationsRead: `${BASE_URL}/notifications/read-all`,
  deleteNotification: (id: string | number) =>
    `${BASE_URL}/notifications/${id}`,

  // Manager
  isManager: `${BASE_URL}/manager/is-manager`,
  myTeam: `${BASE_URL}/manager/team`,
  teamMemberConfig: (id: string) => `${BASE_URL}/manager/team/${id}`,
  teamLeaveApplications: `${BASE_URL}/manager/leave-applications`,
  teamOnLeaveToday: `${BASE_URL}/manager/on-leave-today`,
  // Banks
  BANKS: {
    GET_ALL: `${BASE_URL}/banks`,
  },
  // Emergency Contacts
  EMERGENCY_CONTACTS: {
    BASE: `${BASE_URL}/emergency-contacts`,
    BY_ID: (id: number) => `${BASE_URL}/emergency-contacts/${id}`,
  },
  // Financial Details
  FINANCIAL_DETAILS: {
    BASE: `${BASE_URL}/financial-details`,
    BY_ID: (id: number) => `${BASE_URL}/financial-details/${id}`,
  },
  // Profile Picture
  PROFILE_PICTURE: {
    UPDATE: (id: string) => `${BASE_URL}/employees/${id}/profile-picture`,
  },

  // Celebrations
  celebrations: `${BASE_URL}/celebrations`,
  celebrationById: (id: string) => `${BASE_URL}/celebrations/${id}`,
  celebrationMessages: (id: string) =>
    `${BASE_URL}/celebrations/${id}/messages`,
  celebrationReactions: (id: string) =>
    `${BASE_URL}/celebrations/${id}/reactions`,
  dismissCelebration: (id: string) => `${BASE_URL}/celebrations/${id}/dismiss`,
  celebrationEvents: `${BASE_URL}/celebrations/events`,

  documentSignerConfig: `${BASE_URL}/document-signer-config`,
  employeeSettings: `${BASE_URL}/employee-settings`,
  companies: `${BASE_URL}/platform/companies`,
  myCompany: `${BASE_URL}/companies/me`,

  // OKR MODULE (aligned with backend Postman collection)
  okr: {
    // Cycles
    cycles: `${BASE_URL}/okr/cycles`,
    cycleById: (id: number | string) => `${BASE_URL}/okr/cycles/${id}`,
    currentCycle: `${BASE_URL}/okr/cycles/current`,
    openCycle: (id: number | string) => `${BASE_URL}/okr/cycles/${id}/open`,
    closeCycle: (id: number | string) => `${BASE_URL}/okr/cycles/${id}/close`,
    archiveCheck: (id: number | string) =>
      `${BASE_URL}/okr/cycles/${id}/archive-check`,

    // Dashboards & leadership rollups
    dashboardCeo: `${BASE_URL}/okr/dashboard/ceo`,
    dashboardDepartmentsCompare: `${BASE_URL}/okr/dashboard/departments/compare`,
    dashboardCompanyGallery: `${BASE_URL}/okr/dashboard/company/gallery`,
    dashboardFinancial: `${BASE_URL}/okr/dashboard/financial`,
    dashboardAtRisk: `${BASE_URL}/okr/dashboard/at-risk`,
    dashboardCompletion: (id: number | string) =>
      `${BASE_URL}/okr/dashboard/completion/${id}`,
    dashboardRollupRefresh: `${BASE_URL}/okr/dashboard/rollup/refresh`,
    dashboardSnapshotsGenerate: `${BASE_URL}/okr/dashboard/snapshots/generate`,
    dashboardSnapshots: (cycleId: number | string) =>
      `${BASE_URL}/okr/dashboard/snapshots?cycle_id=${cycleId}`,

    // Configuration
    configurations: `${BASE_URL}/okr/configurations`,
    configurationMenu: `${BASE_URL}/okr/configurations/menu`,
    configurationByKey: (key: string) =>
      `${BASE_URL}/okr/configurations/${key}`,
    auditLogs: `${BASE_URL}/okr/audit/logs`,
    configSnapshotById: (id: number | string) =>
      `${BASE_URL}/okr/audit/snapshots/${id}`,

    // Metric definitions
    metrics: `${BASE_URL}/okr/metrics`,
    metricById: (id: number | string) => `${BASE_URL}/okr/metrics/${id}`,
    metricCategories: `${BASE_URL}/okr/metrics/categories`,
    metricCategoryById: (id: number | string) =>
      `${BASE_URL}/okr/metrics/categories/${id}`,

    // Company
    companyMetrics: `${BASE_URL}/okr/company/metrics`,
    companyObjectives: `${BASE_URL}/okr/company/objectives`,
    companyObjectiveById: (id: number | string) =>
      `${BASE_URL}/okr/company/objectives/${id}`,
    publishCompanyObjectives: `${BASE_URL}/okr/company/objectives/publish`,
    publishCompanyObjective: (id: number | string) =>
      `${BASE_URL}/okr/company/objectives/${id}/publish`,
    companyAvailableKRs: `${BASE_URL}/okr/company/available-krs`,

    companyKRs: (objectiveId: number | string) =>
      `${BASE_URL}/okr/company/objectives/${objectiveId}/key-results`,
    companyKRById: (id: number | string) =>
      `${BASE_URL}/okr/company/key-results/${id}`,
    publishCompanyKR: (id: number | string) =>
      `${BASE_URL}/okr/company/key-results/${id}/publish`,
    assignDepartmentsToKR: (id: number | string) =>
      `${BASE_URL}/okr/company/key-results/${id}/assign-departments`,

    // Department
    departmentObjectives: `${BASE_URL}/okr/department/objectives`,
    departmentObjectiveById: (id: number | string) =>
      `${BASE_URL}/okr/department/objectives/${id}`,
    publishDepartmentObjective: (id: number | string) =>
      `${BASE_URL}/okr/department/objectives/${id}/publish`,
    submitDepartmentObjective: (id: number | string) =>
      `${BASE_URL}/okr/department/objectives/${id}/submit`,
    approveDepartmentObjective: (id: number | string) =>
      `${BASE_URL}/okr/department/objectives/${id}/approve`,
    adoptKR: `${BASE_URL}/okr/department/adopt-kr`,
    departmentKRSubmit: (id: number | string) =>
      `${BASE_URL}/okr/department/key-results/${id}/submit`,
    departmentKRApprove: (id: number | string) =>
      `${BASE_URL}/okr/department/key-results/${id}/approve`,
    departmentKRsPending: `${BASE_URL}/okr/department/key-results/pending`,
    departmentBulkSubmit: `${BASE_URL}/okr/department/bulk-submit`,
    departmentBulkApprove: `${BASE_URL}/okr/department/bulk-approve`,
    departmentPendingApprovals: `${BASE_URL}/okr/department/approvals/pending`,
    departmentBulkApproveItems: `${BASE_URL}/okr/department/approvals/bulk`,
    departmentApproveItem: `${BASE_URL}/okr/department/approvals/single`,
    departmentKRs: (departmentObjectiveId: number | string) =>
      `${BASE_URL}/okr/department/objectives/${departmentObjectiveId}/key-results`,
    departmentKRById: (id: number | string) =>
      `${BASE_URL}/okr/department/key-results/${id}`,
    publishDepartmentKR: (id: number | string) =>
      `${BASE_URL}/okr/department/key-results/${id}/publish`,
    // Department KR planning is unified with the new planning routes:
    // monthly plans hang off any KR via /okr/key-results/:id/monthly-plans.
    departmentKRMonthPlans: (krId: number | string) =>
      `${BASE_URL}/okr/key-results/${krId}/monthly-plans`,

    // Contributors (GET ?department_kr_id=, POST assign)
    contributors: `${BASE_URL}/okr/contributors`,
    contributorById: (id: number | string) =>
      `${BASE_URL}/okr/contributors/${id}`,
    contributorFlag: (id: number | string) =>
      `${BASE_URL}/okr/contributors/${id}/flag`,
    contributorsDepartmentSummary: `${BASE_URL}/okr/contributors/department-summary`,

    // Employee execution
    employeeObjectives: `${BASE_URL}/okr/employee/objectives`,
    employeeObjectiveById: (id: number | string) =>
      `${BASE_URL}/okr/employee/objectives/${id}`,
    publishEmployeeObjective: (id: number | string) =>
      `${BASE_URL}/okr/employee/objectives/${id}/publish`,
    employeeAssignedKRs: `${BASE_URL}/okr/employee/assigned-krs`,
    employeeAdoptAssignedKR: `${BASE_URL}/okr/employee/objectives/adopt-assigned-kr`,
    submitEmployeeObjective: (id: number | string) =>
      `${BASE_URL}/okr/employee/objectives/${id}/submit`,
    employeeBulkSubmit: `${BASE_URL}/okr/employee/bulk-submit`,
    employeeBulkPublish: `${BASE_URL}/okr/employee/bulk-publish`,
    employeeKRs: (objectiveId: number | string) =>
      `${BASE_URL}/okr/employee/objectives/${objectiveId}/key-results`,
    employeeKRById: (id: number | string) =>
      `${BASE_URL}/okr/employee/key-results/${id}`,
    submitEmployeeKR: (krId: number | string) =>
      `${BASE_URL}/okr/employee/key-results/${krId}/submit`,
    publishEmployeeKR: (id: number | string) =>
      `${BASE_URL}/okr/employee/key-results/${id}/publish`,
    employeeKRExecutionMode: (id: number | string) =>
      `${BASE_URL}/okr/employee/key-results/${id}/execution-mode`,
    // ── Planning (new schema, mounted at /okr) ────────────────────────
    // Monthly plans live under their parent KR.
    employeeKRMonthPlans: (krId: number | string) =>
      `${BASE_URL}/okr/key-results/${krId}/monthly-plans`,
    // Weekly plans live under their parent monthly plan.
    monthlyPlanWeeklyPlans: (monthlyPlanId: number | string) =>
      `${BASE_URL}/okr/monthly-plans/${monthlyPlanId}/weekly-plans`,
    // Daily plans live under their parent weekly plan.
    weeklyPlanDailyPlans: (weeklyPlanId: number | string) =>
      `${BASE_URL}/okr/weekly-plans/${weeklyPlanId}/daily-plans`,

    // Single-resource endpoints (PUT/DELETE/PATCH).
    monthlyPlanById: (id: number | string) =>
      `${BASE_URL}/okr/monthly-plans/${id}`,
    weeklyPlanById: (id: number | string) =>
      `${BASE_URL}/okr/weekly-plans/${id}`,
    dailyPlanById: (id: number | string) =>
      `${BASE_URL}/okr/daily-plans/${id}`,
    dailyPlanStatus: (id: number | string) =>
      `${BASE_URL}/okr/daily-plans/${id}/status`,

    // Subtasks (unchanged).
    employeeKRSubtasks: (krId: number | string) =>
      `${BASE_URL}/okr/employee/key-results/${krId}/subtasks`,
    employeeSubtaskById: (id: number | string) =>
      `${BASE_URL}/okr/employee/subtasks/${id}`,

    employeeKRProgress: (krId: number | string) =>
      `${BASE_URL}/okr/employee/key-results/${krId}/progress`,

    // Manager
    managerTeamSummary: `${BASE_URL}/okr/manager/team-summary`,
    managerSubordinatePositions: `${BASE_URL}/okr/manager/subordinate-positions`,
    managerPendingApprovals: `${BASE_URL}/okr/manager/pending-approvals`,
    managerPendingEmployeeObjectives: `${BASE_URL}/okr/manager/pending-employee-objectives`,
    managerPendingEmployeeKRs: `${BASE_URL}/okr/manager/pending-employee-key-results`,
    managerApprove: `${BASE_URL}/okr/manager/approve`,
    managerBulkApprove: `${BASE_URL}/okr/manager/bulk-approve`,
    managerPlanningCompliance: `${BASE_URL}/okr/manager/planning-compliance`,

    // Manager Plan Alignment (subordinate-facing)
    managerPlans: {
      alignmentMonth: (monthNum: number | string) =>
        `${BASE_URL}/okr/manager-plans/alignment/month/${monthNum}`,
      alignmentWeekly: (weekNum: number | string) =>
        `${BASE_URL}/okr/manager-plans/alignment/weekly/${weekNum}`,
    },

    // Archives
    archives: `${BASE_URL}/okr/archives`,
    archiveById: (id: number | string) => `${BASE_URL}/okr/archives/${id}`,
    archiveReports: (id: number | string) =>
      `${BASE_URL}/okr/archives/${id}/reports`,
    archiveInsights: (id: number | string) =>
      `${BASE_URL}/okr/archives/${id}/insights`,
    archiveExports: (id: number | string) =>
      `${BASE_URL}/okr/archives/${id}/exports`,
    exportJobById: (id: number | string) => `${BASE_URL}/okr/exports/${id}`,

    // Plan-Based Approval Flow
    submitPlan: `${BASE_URL}/okr/approvals/submit`,
    submissionById: (id: number | string) =>
      `${BASE_URL}/okr/approvals/submissions/${id}`,
    submissionComments: (id: number | string) =>
      `${BASE_URL}/okr/approvals/submissions/${id}/comments`,
    approveSubmission: (id: number | string) =>
      `${BASE_URL}/okr/approvals/${id}/approve`,
    rejectSubmission: (id: number | string) =>
      `${BASE_URL}/okr/approvals/${id}/reject`,
    submissionFeedback: `${BASE_URL}/okr/approvals/comment`,
    entityComments: `${BASE_URL}/okr/approvals/comments`,
    managerSubmissions: `${BASE_URL}/okr/approvals/manager/submissions`,
    adminSubmissions: `${BASE_URL}/okr/approvals/admin/submissions`,
    dashboardEmployee: (cycleId: number | string) =>
      `${BASE_URL}/okr/dashboard/employee?cycle_id=${cycleId}`,

    // Post-Publish Change Requests
    changeRequests: {
      create: `${BASE_URL}/okr/change-requests`,
      list: `${BASE_URL}/okr/change-requests`,
      myReviews: `${BASE_URL}/okr/change-requests/my-reviews`,
      detail: (id: number | string) => `${BASE_URL}/okr/change-requests/${id}`,
      approve: (id: number | string) => `${BASE_URL}/okr/change-requests/${id}/approve`,
      reject: (id: number | string) => `${BASE_URL}/okr/change-requests/${id}/reject`,
      realignmentFlags: `${BASE_URL}/okr/change-requests/realignment/my-flags`,
      entityRealignmentFlags: `${BASE_URL}/okr/change-requests/realignment/entity`,
      acknowledgeRealignment: (id: number | string) => `${BASE_URL}/okr/change-requests/realignment/${id}/acknowledge`,
      dismissRealignment: (id: number | string) => `${BASE_URL}/okr/change-requests/realignment/${id}/dismiss`,
      completeRealignment: (id: number | string) => `${BASE_URL}/okr/change-requests/realignment/${id}/complete`,
      subordinateAlignment: `${BASE_URL}/okr/change-requests/alignment/subordinates`,
    },
  },
  manager: {
    team: `${BASE_URL}/manager/team`,
  },
};

export default apiRoutes;
