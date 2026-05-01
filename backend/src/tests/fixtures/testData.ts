/**
 * Test Fixtures and Static Test Data
 * 
 * Contains reusable test data and configuration constants.
 */

/**
 * Test company data
 */
export const testCompany = {
  code: 'TEST01',
  name: 'Test Company',
};

/**
 * Common leave request reasons
 */
export const leaveReasons = {
  vacation: 'Annual vacation trip',
  family: 'Family emergency',
  medical: 'Medical appointment',
  personal: 'Personal matters',
  wedding: 'Wedding ceremony',
  bereavement: 'Bereavement leave',
};

/**
 * Test date utilities
 */
export const testDates = {
  /**
   * Get a future date that's a weekday
   */
  getFutureWeekday(daysFromNow: number = 7): Date {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    
    // Adjust to Monday if weekend
    const day = date.getDay();
    if (day === 0) date.setDate(date.getDate() + 1); // Sunday -> Monday
    if (day === 6) date.setDate(date.getDate() + 2); // Saturday -> Monday
    
    return date;
  },

  /**
   * Get a past date
   */
  getPastDate(daysAgo: number = 7): Date {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date;
  },

  /**
   * Get start of year
   */
  getStartOfYear(year: number = new Date().getFullYear()): Date {
    return new Date(year, 0, 1);
  },

  /**
   * Get end of year
   */
  getEndOfYear(year: number = new Date().getFullYear()): Date {
    return new Date(year, 11, 31);
  },

  /**
   * Get next Saturday
   */
  getNextSaturday(): Date {
    const date = new Date();
    const day = date.getDay();
    const diff = 6 - day + (day === 6 ? 7 : 0);
    date.setDate(date.getDate() + diff);
    return date;
  },

  /**
   * Get next Sunday
   */
  getNextSunday(): Date {
    const date = new Date();
    const day = date.getDay();
    const diff = 7 - day + (day === 0 ? 7 : 0);
    date.setDate(date.getDate() + diff);
    return date;
  },

  /**
   * Format date as YYYY-MM-DD
   */
  format(date: Date): string {
    return date.toISOString().split('T')[0];
  },
};

/**
 * Expected HTTP status codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

/**
 * Leave application statuses
 */
export const LeaveStatus = {
  PENDING_SUPERVISOR: 'PENDING_SUPERVISOR',
  PENDING_HR: 'PENDING_HR',
  PENDING_CEO: 'PENDING_CEO',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

/**
 * Test user emails
 */
export const testEmails = {
  employee: 'test.employee@test.com',
  employee2: 'test.employee2@test.com',
  manager: 'test.manager@test.com',
  hr: 'test.hr@test.com',
  admin: 'test.admin@test.com',
};

/**
 * Default fiscal year
 */
export const currentFiscalYear = new Date().getFullYear();

/**
 * API endpoints
 */
export const endpoints = {
  // Leave Applications
  leaveApplications: '/api/v1/leave-applications',
  myLeaveApplications: '/api/v1/leave-applications/me',
  pendingApplications: '/api/v1/leave-applications/pending',
  cancelApplication: (id: number) => `/api/v1/leave-applications/${id}/cancel`,
  approveApplication: (id: number) => `/api/v1/leave-applications/${id}/approve`,
  rejectApplication: (id: number) => `/api/v1/leave-applications/${id}/reject`,

  // Leave Balances
  leaveBalances: '/api/v1/leave-balances',
  myLeaveBalance: '/api/v1/leave-balances/me',
  employeeBalance: (empId: string) => `/api/v1/leave-balances/employee/${empId}`,
  adjustBalance: (id: number) => `/api/v1/leave-balances/${id}/adjust`,

  // Leave Types
  leaveTypes: '/api/v1/leave-types',
  applicableLeaveTypes: '/api/v1/leave-types/applicable',

  // Leave Recalls
  leaveRecalls: '/api/v1/leave-recalls',
  myRecalls: '/api/v1/leave-recalls/me',
  respondToRecall: (id: number) => `/api/v1/leave-recalls/${id}/respond`,

  // Leave Cash Out
  leaveCashOuts: '/api/v1/leave-cash-outs',

  // Auth
  login: '/api/v1/auth/login',
};

/**
 * Sample leave application payloads
 */
export const samplePayloads = {
  validLeaveRequest: (
    leaveTypeId: number,
    startDate: Date,
    endDate: Date,
    requestedDays: number
  ) => ({
    leave_type_id: leaveTypeId,
    start_date: testDates.format(startDate),
    end_date: testDates.format(endDate),
    requested_days: requestedDays,
    reason: leaveReasons.vacation,
  }),

  approvalComment: (approved: boolean) => ({
    comments: approved ? 'Leave approved' : 'Leave rejected due to project deadline',
  }),
};
