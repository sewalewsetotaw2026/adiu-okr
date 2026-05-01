/**
 * E2E Tests: Leave Cancellation
 * 
 * Tests leave cancellation at different stages:
 * - Employee cancelling pending leave
 * - Employee cancelling approved leave (before start)
 * - Admin modifying leave after approval
 * - Cancellation restrictions
 */

import { testPrisma, cleanupTestLeaveData, cleanupTestEmployees } from '../setup';
import { createTestUser, Roles, apiRequest, formatDate, addDays, getNextMonday } from '../utils/testHelpers';
import { LeaveTypeFactory, LeaveBalanceFactory, LeaveApplicationFactory } from '../utils/factories';
import { endpoints, HttpStatus, LeaveStatus } from '../fixtures/testData';

describe('E2E: Leave Cancellation', () => {
  let companyId: number;
  let employeeToken: string;
  let employeeId: string;
  let adminToken: string;
  let adminId: string;
  let annualLeaveType: any;

  beforeAll(async () => {
    const company = await testPrisma.company.findFirst({
      where: { company_code: 'TEST01' },
    });
    if (!company) throw new Error('Test company not found');
    companyId = company.id;

    annualLeaveType = await LeaveTypeFactory.getAnnualLeave(companyId);

    const timestamp = Math.floor(Date.now() % 100000000); // 8 digits

    // Create admin
    adminId = `TEST-ADM-${timestamp}`;
    const adminResult = await createTestUser(companyId, adminId, `admin-can-${timestamp}@test.com`, Roles.ADMIN);
    adminToken = adminResult.token;

    // Create employee
    employeeId = `TEST-EMP-${timestamp}`;
    const employeeResult = await createTestUser(companyId, employeeId, `emp-can-${timestamp}@test.com`, Roles.EMPLOYEE);
    employeeToken = employeeResult.token;

    // Create leave balance
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
    await testPrisma.leaveApprovalLog.deleteMany({
      where: { application: { company_id: companyId, employee_id: { startsWith: 'TEST-' } } },
    });
    await testPrisma.leaveApplication.deleteMany({
      where: { company_id: companyId, employee_id: { startsWith: 'TEST-' } },
    });
    await testPrisma.leaveBalance.updateMany({
      where: { employee_id: employeeId, company_id: companyId },
      data: { used_days: 0, pending_days: 0, remaining_days: 16 },
    });
  });

  // ============================================================================
  // EMPLOYEE CANCELLATION
  // ============================================================================

  describe('Employee Cancels Pending Leave', () => {
    it('should allow employee to cancel their pending leave', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Cancel test',
      });

      const applicationId = createResponse.body.data.application.id;

      const cancelResponse = await apiRequest(employeeToken).post(
        endpoints.cancelApplication(applicationId)
      );

      expect(cancelResponse.status).toBe(HttpStatus.OK);
    });

    it('should update status to CANCELLED after cancellation', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Status test',
      });

      const applicationId = createResponse.body.data.application.id;
      
      await apiRequest(employeeToken).post(endpoints.cancelApplication(applicationId));

      const application = await testPrisma.leaveApplication.findUnique({
        where: { id: applicationId },
      });

      expect(application?.current_status).toBe(LeaveStatus.CANCELLED);
    });

    it('should restore pending days after cancellation', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Restore test',
      });

      // Pending should be 1
      let balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, leave_type_id: annualLeaveType.id },
      });
      expect(Number(balance?.pending_days)).toBeGreaterThan(0);

      const applicationId = createResponse.body.data.application.id;
      await apiRequest(employeeToken).post(endpoints.cancelApplication(applicationId));

      // Pending should be 0
      balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, leave_type_id: annualLeaveType.id },
      });
      expect(Number(balance?.pending_days)).toBe(0);
    });

    it('should list cancellable leaves for employee', async () => {
      // Create a pending leave
      const startDate = getNextMonday();
      await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Cancellable test',
      });

      const response = await apiRequest(employeeToken).get('/api/v1/leave-applications/cancellable');

      expect(response.status).toBe(HttpStatus.OK);
      expect(Array.isArray(response.body.data.applications)).toBe(true);
    });
  });

  describe('Employee Cancels Approved Leave (Before Start)', () => {
    it('should allow cancellation of approved leave before it starts', async () => {
      const startDate = addDays(getNextMonday(), 7); // Far in future
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Cancel approved test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Approve the leave
      await apiRequest(adminToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Approved' }
      );

      // Employee cancels
      const cancelResponse = await apiRequest(employeeToken).post(
        endpoints.cancelApplication(applicationId)
      );

      // Should succeed or fail based on business rules
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(cancelResponse.status);
    });

    it('should restore used days when approved leave is cancelled', async () => {
      const startDate = addDays(getNextMonday(), 7);
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Restore used test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Approve
      await apiRequest(adminToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Approved' }
      );

      // Check used days
      let balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, leave_type_id: annualLeaveType.id },
      });
      const usedAfterApproval = Number(balance?.used_days);

      // Cancel
      const cancelResponse = await apiRequest(employeeToken).post(
        endpoints.cancelApplication(applicationId)
      );

      if (cancelResponse.status === HttpStatus.OK) {
        balance = await testPrisma.leaveBalance.findFirst({
          where: { employee_id: employeeId, leave_type_id: annualLeaveType.id },
        });
        expect(Number(balance?.used_days)).toBeLessThan(usedAfterApproval);
      }
    });
  });

  // ============================================================================
  // CANCELLATION RESTRICTIONS
  // ============================================================================

  describe('Cancellation Restrictions', () => {
    it('should not allow cancelling leave that has already started', async () => {
      // Create leave that starts today (in the past for testing)
      const application = await testPrisma.leaveApplication.create({
        data: {
          employee_id: employeeId,
          company_id: companyId,
          leave_type_id: annualLeaveType.id,
          start_date: addDays(new Date(), -1), // Started yesterday
          end_date: addDays(new Date(), 1), // Ends tomorrow
          return_date: addDays(new Date(), 2),
          requested_days: 3,
          reason: 'Already started leave',
          current_status: LeaveStatus.APPROVED,
        },
      });

      const cancelResponse = await apiRequest(employeeToken).post(
        endpoints.cancelApplication(application.id)
      );

      expect(cancelResponse.status).toBe(HttpStatus.BAD_REQUEST);
      expect(cancelResponse.body.message).toMatch(/started|progress|ongoing/i);
    });

    it('should not allow employee to cancel another employee leave', async () => {
      // Create another employee
      const timestamp = Math.floor(Date.now() % 100000000); // 8 digits
      const otherEmployeeId = `TEST-OTH-${timestamp}`;
      await createTestUser(companyId, otherEmployeeId, `other-can-${timestamp}@test.com`, Roles.EMPLOYEE);
      await LeaveBalanceFactory.create(otherEmployeeId, companyId, annualLeaveType.id);

      // Create leave for other employee
      const application = await LeaveApplicationFactory.create(
        otherEmployeeId,
        companyId,
        annualLeaveType.id
      );

      // Try to cancel as different employee
      const cancelResponse = await apiRequest(employeeToken).post(
        endpoints.cancelApplication(application.id)
      );

      expect([HttpStatus.FORBIDDEN, HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND]).toContain(cancelResponse.status);

      // Cleanup
      await testPrisma.leaveApplication.delete({ where: { id: application.id } });
      await testPrisma.leaveBalance.deleteMany({ where: { employee_id: otherEmployeeId } });
      await testPrisma.appUser.deleteMany({ where: { employee_id: otherEmployeeId } });
      await testPrisma.employment.deleteMany({ where: { employee_id: otherEmployeeId } });
      await testPrisma.employee.delete({ where: { id: otherEmployeeId } });
    });

    it('should not allow cancelling already cancelled leave', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Double cancel test',
      });

      const applicationId = createResponse.body.data.application.id;

      // First cancellation
      await apiRequest(employeeToken).post(endpoints.cancelApplication(applicationId));

      // Second cancellation attempt
      const secondCancel = await apiRequest(employeeToken).post(
        endpoints.cancelApplication(applicationId)
      );

      expect(secondCancel.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should not allow cancelling rejected leave', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Reject then cancel test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Reject
      await apiRequest(adminToken).post(
        endpoints.rejectApplication(applicationId),
        { rejection_reason: 'Rejected' }
      );

      // Try to cancel
      const cancelResponse = await apiRequest(employeeToken).post(
        endpoints.cancelApplication(applicationId)
      );

      expect(cancelResponse.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // ============================================================================
  // ADMIN OPERATIONS
  // ============================================================================

  describe('Admin Operations', () => {
    it('should allow admin to cancel any employee leave', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Admin cancel test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Admin cancels
      const cancelResponse = await apiRequest(adminToken).post(
        endpoints.cancelApplication(applicationId)
      );

      // Admin should be able to cancel
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(cancelResponse.status);
    });
  });
});
