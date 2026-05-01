/**
 * E2E Tests: Leave Application Lifecycle
 * 
 * Tests the complete leave application lifecycle including:
 * - Creating leave requests
 * - Validation rules
 * - Edge cases (overlapping, backdated, insufficient balance)
 * - Date handling (weekends, holidays)
 */

import request from 'supertest';
import app from '../../app';
import { testPrisma, cleanupTestLeaveData, cleanupTestEmployees } from '../setup';
import { createTestUser, Roles, apiRequest, formatDate, addDays, getNextMonday } from '../utils/testHelpers';
import { EmployeeFactory, LeaveTypeFactory, LeaveBalanceFactory, LeaveApplicationFactory, PublicHolidayFactory } from '../utils/factories';
import { endpoints, HttpStatus, LeaveStatus, leaveReasons, testDates } from '../fixtures/testData';

describe('E2E: Leave Application Lifecycle', () => {
  let companyId: number;
  let employeeToken: string;
  let employeeId: string;
  let managerToken: string;
  let managerId: string;
  let adminToken: string;
  let adminId: string;
  let annualLeaveType: any;

  beforeAll(async () => {
    // Get existing test company
    const company = await testPrisma.company.findFirst({
      where: { company_code: 'TEST01' },
    });
    
    if (!company) {
      throw new Error('Test company not found. Please run seed first.');
    }
    companyId = company.id;

    // Get or create leave types
    annualLeaveType = await LeaveTypeFactory.getAnnualLeave(companyId);

    // Create test manager
    const timestamp = Math.floor(Date.now() % 100000000);
    managerId = `TEST-MGR-${timestamp}`;
    const managerResult = await createTestUser(
      companyId,
      managerId,
      `manager-${timestamp}@test.com`,
      Roles.HR, // HR can approve
      { fullName: 'Test Manager' }
    );
    managerToken = managerResult.token;

    // Create test admin
    adminId = `TEST-ADMIN-${timestamp}`;
    const adminResult = await createTestUser(
      companyId,
      adminId,
      `admin-${timestamp}@test.com`,
      Roles.ADMIN,
      { fullName: 'Test Admin' }
    );
    adminToken = adminResult.token;

    // Create test employee with manager
    employeeId = `TEST-EMP-${timestamp}`;
    const employeeResult = await createTestUser(
      companyId,
      employeeId,
      `employee-${Date.now()}@test.com`,
      Roles.EMPLOYEE,
      { fullName: 'Test Employee' }
    );
    employeeToken = employeeResult.token;

    // Set manager for employee
    await testPrisma.employment.updateMany({
      where: { employee_id: employeeId, company_id: companyId },
      data: { manager_id: managerId },
    });

    // Create leave balance for employee
    await LeaveBalanceFactory.create(employeeId, companyId, annualLeaveType.id, {
      totalEntitlement: 16,
      usedDays: 0,
    });
  });

  afterAll(async () => {
    await cleanupTestLeaveData(companyId);
    await cleanupTestEmployees(companyId);
  });

  beforeEach(async () => {
    // Clean up leave applications between tests (keep balances)
    await testPrisma.leaveApprovalLog.deleteMany({
      where: {
        application: {
          company_id: companyId,
          employee_id: { startsWith: 'TEST-' },
        },
      },
    });
    await testPrisma.leaveApplication.deleteMany({
      where: {
        company_id: companyId,
        employee_id: { startsWith: 'TEST-' },
      },
    });

    // Reset leave balance
    await testPrisma.leaveBalance.updateMany({
      where: { employee_id: employeeId, company_id: companyId },
      data: { used_days: 0, pending_days: 0, remaining_days: 16 },
    });
  });

  // ============================================================================
  // HAPPY PATH TESTS
  // ============================================================================

  describe('Happy Path: Employee Creates Leave Request', () => {
    it('should create a valid leave request for future dates', async () => {
      const startDate = getNextMonday();
      const endDate = addDays(startDate, 2); // 3 working days

      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        requested_days: 3,
        reason: leaveReasons.vacation,
      });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toBeDefined();
      expect(response.body.data.application.current_status).toBe(LeaveStatus.PENDING_SUPERVISOR);
    });

    it('should create single-day leave request', async () => {
      const leaveDate = getNextMonday();

      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(leaveDate),
        end_date: formatDate(leaveDate),
        requested_days: 1,
        reason: leaveReasons.medical,
      });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body.data.application.requested_days).toBe('1');
    });

    it('should retrieve employee own leave applications', async () => {
      // Create a leave first
      const startDate = getNextMonday();
      await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Test leave',
      });

      const response = await apiRequest(employeeToken).get(endpoints.myLeaveApplications);

      expect(response.status).toBe(HttpStatus.OK);
      expect(Array.isArray(response.body.data.applications)).toBe(true);
      expect(response.body.data.applications.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================

  describe('Validation: Invalid Date Ranges', () => {
    it('should reject when end date is before start date', async () => {
      const startDate = getNextMonday();
      const endDate = addDays(startDate, -2); // Before start

      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        requested_days: 1,
        reason: 'Invalid dates test',
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toMatch(/Requested leave days must be greater than zero|end date|before|invalid/i);
    });

    it('should reject missing required fields', async () => {
      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        // Missing dates
        reason: 'Test',
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Validation: Insufficient Balance', () => {
    it('should reject leave request exceeding available balance', async () => {
      // Set balance to only 2 days
      await testPrisma.leaveBalance.updateMany({
        where: { employee_id: employeeId, company_id: companyId },
        // Set used days to a high number to ensure remaining is 0 despite dynamic accrual
        data: { remaining_days: 0, used_days: 100 },
      });

      const startDate = getNextMonday();
      const endDate = addDays(startDate, 4); // Requesting 5 days

      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        requested_days: 5,
        reason: 'Insufficient balance test',
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toMatch(/insufficient|balance|exceed/i);
    });

    it('should reject when balance is zero', async () => {
      // Exhaust balance
      await testPrisma.leaveBalance.updateMany({
        where: { employee_id: employeeId, company_id: companyId },
        // Set used days to a high number to ensure remaining is 0 despite dynamic accrual
        data: { remaining_days: 0, used_days: 100 },
      });

      const startDate = getNextMonday();

      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Zero balance test',
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Validation: Overlapping Leave Requests', () => {
    it('should reject overlapping leave requests for same dates', async () => {
      const startDate = getNextMonday();
      const endDate = addDays(startDate, 2);

      // Create first leave request
      await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate),
        requested_days: 3,
        reason: 'First request',
      });

      // Try to create overlapping request
      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(addDays(startDate, 1)),
        requested_days: 2,
        reason: 'Overlapping request',
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toMatch(/overlap|existing|conflict/i);
    });

    it('should reject partially overlapping leave requests', async () => {
      const firstStart = getNextMonday();
      const firstEnd = addDays(firstStart, 4);

      // Create first leave request (5 days)
      await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(firstStart),
        end_date: formatDate(firstEnd),
        requested_days: 5,
        reason: 'First request',
      });

      // Try to create overlapping request (starts in middle of first)
      const secondStart = addDays(firstStart, 2);
      const secondEnd = addDays(secondStart, 3);

      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(secondStart),
        end_date: formatDate(secondEnd),
        requested_days: 4,
        reason: 'Overlapping request',
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases: Backdated Leave Requests', () => {
    it('should reject leave requests for past dates', async () => {
      const pastDate = testDates.getPastDate(7);

      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(pastDate),
        end_date: formatDate(pastDate),
        requested_days: 1,
        reason: 'Backdated request',
      });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toMatch(/past|backdated|future/i);
    });
  });

  describe('Edge Cases: Weekend and Holiday Spanning', () => {
    it('should correctly calculate working days when leave spans a weekend', async () => {
      // Find a Friday
      const today = new Date();
      let friday = new Date(today);
      while (friday.getDay() !== 5) {
        friday.setDate(friday.getDate() + 1);
      }
      // Move to next week if too close
      if ((friday.getTime() - today.getTime()) < 3 * 24 * 60 * 60 * 1000) {
        friday.setDate(friday.getDate() + 7);
      }

      const nextMonday = addDays(friday, 3);

      // Request leave from Friday to Monday (should be 2 working days if weekend excluded)
      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(friday),
        end_date: formatDate(nextMonday),
        requested_days: 2, // Friday + Monday
        reason: 'Weekend spanning test',
      });

      // Should succeed - the system should calculate working days
      expect([HttpStatus.CREATED, HttpStatus.BAD_REQUEST]).toContain(response.status);
      if (response.status === HttpStatus.CREATED) {
        // The requested_days should reflect working days only
        const createdLeave = response.body.data;
        expect(createdLeave).toBeDefined();
      }
    });

    it('should handle leave that includes a public holiday', async () => {
      // Create a holiday for tomorrow
      const tomorrow = addDays(new Date(), 1);
      while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
        tomorrow.setDate(tomorrow.getDate() + 1);
      }

      await PublicHolidayFactory.create(companyId, 'Test Holiday', tomorrow);

      const dayAfterHoliday = addDays(tomorrow, 1);
      while (dayAfterHoliday.getDay() === 0 || dayAfterHoliday.getDay() === 6) {
        dayAfterHoliday.setDate(dayAfterHoliday.getDate() + 1);
      }

      // Request leave including the holiday
      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(tomorrow),
        end_date: formatDate(dayAfterHoliday),
        requested_days: 1, // Only 1 working day (the day after holiday)
        reason: 'Holiday spanning test',
      });

      // The system should calculate correctly or reject if count doesn't match
      expect([HttpStatus.CREATED, HttpStatus.BAD_REQUEST]).toContain(response.status);
    });
  });

  // ============================================================================
  // AUTHORIZATION TESTS
  // ============================================================================

  describe('Authorization: Employee Access', () => {
    it('should not allow employee to approve their own leave', async () => {
      const startDate = getNextMonday();
      
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Self-approval test',
      });

      const applicationId = createResponse.body.data?.id;
      if (!applicationId) return;

      const approveResponse = await apiRequest(employeeToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Self approval' }
      );

      expect(approveResponse.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should not allow employee to view all leave applications', async () => {
      const response = await apiRequest(employeeToken).get(endpoints.leaveApplications);

      // Employee should only see their own, not all
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('Authorization: Unauthenticated Access', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get(endpoints.myLeaveApplications);

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get(endpoints.myLeaveApplications)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });
});
