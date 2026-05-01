/**
 * Test Data Factories
 * 
 * Creates test entities with sensible defaults.
 * All test entities use IDs prefixed with 'TEST-' for easy cleanup.
 */

import { testPrisma } from '../setup';
import { Decimal } from '@prisma/client/runtime/library';

let testCounter = 0;

/**
 * Generate a unique test ID
 */
export function generateTestId(prefix: string = 'TEST'): string {
  testCounter++;
  return `${prefix}-${Date.now()}-${testCounter}`;
}

/**
 * Employee Factory
 */
export const EmployeeFactory = {
  /**
   * Create a test employee with employment record
   */
  async create(
    companyId: number,
    options: {
      id?: string;
      fullName?: string;
      gender?: string;
      dateOfBirth?: Date;
      hireDate?: Date;
      departmentId?: number;
      managerId?: string;
      jobTitleId?: number;
    } = {}
  ) {
    const {
      id = generateTestId('EMP'),
      fullName = `Test Employee ${testCounter}`,
      gender = 'Male',
      dateOfBirth = new Date('1990-05-15'),
      hireDate = new Date('2023-01-01'),
      departmentId,
      managerId,
      jobTitleId,
    } = options;

    const employee = await testPrisma.employee.create({
      data: {
        id,
        company_id: companyId,
        full_name: fullName,
        gender,
        date_of_birth: dateOfBirth,
      },
    });

    // Get default department if not provided
    let deptId = departmentId;
    if (!deptId) {
      const dept = await testPrisma.department.findFirst({
        where: { company_id: companyId },
      });
      deptId = dept?.id;
    }

    // Create employment record
    const employment = await testPrisma.employment.create({
      data: {
        employee_id: id,
        company_id: companyId,
        department_id: deptId,
        job_title_id: jobTitleId,
        manager_id: managerId,
        employment_type: 'Full Time',
        start_date: hireDate,
        is_active: true,
      },
    });

    return { employee, employment };
  },

  /**
   * Create a female test employee
   */
  async createFemale(companyId: number, options: Parameters<typeof this.create>[1] = {}) {
    return this.create(companyId, { ...options, gender: 'Female' });
  },

  /**
   * Create an employee on probation
   */
  async createOnProbation(companyId: number, options: Parameters<typeof this.create>[1] = {}) {
    const result = await this.create(companyId, {
      ...options,
      hireDate: new Date(), // Just started
    });

    // Update employment with probation end date
    await testPrisma.employment.update({
      where: { id: result.employment.id },
      data: {
        probation_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
      },
    });

    return result;
  },
};

/**
 * Leave Type Factory
 */
export const LeaveTypeFactory = {
  /**
   * Get or create Annual Leave type
   */
  async getAnnualLeave(companyId: number) {
    let leaveType = await testPrisma.leaveType.findFirst({
      where: { company_id: companyId, code: 'ANNUAL' },
    });

    if (!leaveType) {
      leaveType = await testPrisma.leaveType.create({
        data: {
          company_id: companyId,
          name: 'Annual Leave',
          code: 'ANNUAL',
          default_allowance_days: 16,
          incremental_days_per_year: 1,
          incremental_period_years: 2,
          max_accrual_limit: 30,
          is_carry_over_allowed: true,
          carry_over_expiry_months: 24,
          applicable_gender: 'All',
          is_paid: true,
          is_calendar_days: false,
          is_accrual_based: true,
          accrual_frequency: 'DAILY',
          accrual_divisor: 365,
        },
      });
    }

    return leaveType;
  },

  /**
   * Get or create Sick Leave type
   */
  async getSickLeave(companyId: number) {
    let leaveType = await testPrisma.leaveType.findFirst({
      where: { company_id: companyId, code: 'SICK' },
    });

    if (!leaveType) {
      leaveType = await testPrisma.leaveType.create({
        data: {
          company_id: companyId,
          name: 'Sick Leave',
          code: 'SICK',
          default_allowance_days: 10,
          applicable_gender: 'All',
          requires_attachment: true,
          is_paid: true,
          is_calendar_days: false,
        },
      });
    }

    return leaveType;
  },

  /**
   * Get or create Maternity Leave type
   */
  async getMaternityLeave(companyId: number) {
    let leaveType = await testPrisma.leaveType.findFirst({
      where: { company_id: companyId, code: 'MATERNITY' },
    });

    if (!leaveType) {
      leaveType = await testPrisma.leaveType.create({
        data: {
          company_id: companyId,
          name: 'Maternity Leave',
          code: 'MATERNITY',
          default_allowance_days: 120,
          applicable_gender: 'Female',
          is_paid: true,
          is_calendar_days: true,
        },
      });
    }

    return leaveType;
  },

  /**
   * Get or create Paternity Leave type
   */
  async getPaternityLeave(companyId: number) {
    let leaveType = await testPrisma.leaveType.findFirst({
      where: { company_id: companyId, code: 'PATERNITY' },
    });

    if (!leaveType) {
      leaveType = await testPrisma.leaveType.create({
        data: {
          company_id: companyId,
          name: 'Paternity Leave',
          code: 'PATERNITY',
          default_allowance_days: 5,
          applicable_gender: 'Male',
          is_paid: true,
          is_calendar_days: false,
        },
      });
    }

    return leaveType;
  },
};

/**
 * Leave Balance Factory
 */
export const LeaveBalanceFactory = {
  /**
   * Create a leave balance for an employee
   */
  async create(
    employeeId: string,
    companyId: number,
    leaveTypeId: number,
    options: {
      fiscalYear?: number;
      totalEntitlement?: number;
      usedDays?: number;
      pendingDays?: number;
      expiryDate?: Date;
    } = {}
  ) {
    const {
      fiscalYear = new Date().getFullYear(),
      totalEntitlement = 16,
      usedDays = 0,
      pendingDays = 0,
      expiryDate,
    } = options;

    const remainingDays = totalEntitlement - usedDays - pendingDays;

    return testPrisma.leaveBalance.upsert({
      where: {
        employee_id_leave_type_id_fiscal_year: {
          employee_id: employeeId,
          leave_type_id: leaveTypeId,
          fiscal_year: fiscalYear,
        },
      },
      update: {
        total_entitlement: new Decimal(totalEntitlement),
        used_days: new Decimal(usedDays),
        pending_days: new Decimal(pendingDays),
        remaining_days: new Decimal(remainingDays),
        expiry_date: expiryDate,
      },
      create: {
        employee_id: employeeId,
        company_id: companyId,
        leave_type_id: leaveTypeId,
        fiscal_year: fiscalYear,
        total_entitlement: new Decimal(totalEntitlement),
        used_days: new Decimal(usedDays),
        pending_days: new Decimal(pendingDays),
        remaining_days: new Decimal(remainingDays),
        expiry_date: expiryDate,
      },
    });
  },

  /**
   * Create balance with specific remaining days
   */
  async createWithRemaining(
    employeeId: string,
    companyId: number,
    leaveTypeId: number,
    remainingDays: number
  ) {
    return this.create(employeeId, companyId, leaveTypeId, {
      totalEntitlement: 16,
      usedDays: 16 - remainingDays,
    });
  },

  /**
   * Create balance with zero remaining
   */
  async createExhausted(
    employeeId: string,
    companyId: number,
    leaveTypeId: number
  ) {
    return this.create(employeeId, companyId, leaveTypeId, {
      totalEntitlement: 16,
      usedDays: 16,
    });
  },
};

/**
 * Leave Application Factory
 */
export const LeaveApplicationFactory = {
  /**
   * Create a leave application
   */
  async create(
    employeeId: string,
    companyId: number,
    leaveTypeId: number,
    options: {
      startDate?: Date;
      endDate?: Date;
      returnDate?: Date;
      requestedDays?: number;
      reason?: string;
      status?: string;
      reliefOfficerId?: string;
    } = {}
  ) {
    const today = new Date();
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(today.getDate() + 7); // 1 week from now

    const defaultEndDate = new Date(defaultStartDate);
    defaultEndDate.setDate(defaultStartDate.getDate() + 2); // 3 days leave

    const defaultReturnDate = new Date(defaultEndDate);
    defaultReturnDate.setDate(defaultEndDate.getDate() + 1);

    const {
      startDate = defaultStartDate,
      endDate = defaultEndDate,
      returnDate = defaultReturnDate,
      requestedDays = 3,
      reason = 'Test leave application',
      status = 'PENDING_SUPERVISOR',
      reliefOfficerId,
    } = options;

    return testPrisma.leaveApplication.create({
      data: {
        employee_id: employeeId,
        company_id: companyId,
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        return_date: returnDate,
        requested_days: new Decimal(requestedDays),
        reason,
        current_status: status,
        relief_officer_id: reliefOfficerId,
        relief_company_id: reliefOfficerId ? companyId : undefined,
      },
    });
  },

  /**
   * Create an approved leave application
   */
  async createApproved(
    employeeId: string,
    companyId: number,
    leaveTypeId: number,
    approverId: string,
    options: Parameters<typeof this.create>[3] = {}
  ) {
    const application = await this.create(employeeId, companyId, leaveTypeId, {
      ...options,
      status: 'APPROVED',
    });

    // Add approval log
    await testPrisma.leaveApprovalLog.create({
      data: {
        application_id: application.id,
        approver_id: approverId,
        approver_company_id: companyId,
        approver_role: 'Admin',
        action: 'APPROVED',
        comments: 'Test approval',
      },
    });

    return application;
  },
};

/**
 * Public Holiday Factory
 */
export const PublicHolidayFactory = {
  /**
   * Create a public holiday
   */
  async create(
    companyId: number,
    name: string,
    date: Date,
    isRecurring: boolean = true
  ) {
    return testPrisma.publicHoliday.create({
      data: {
        company_id: companyId,
        name,
        holiday_date: date,
        is_recurring: isRecurring,
      },
    });
  },
};
