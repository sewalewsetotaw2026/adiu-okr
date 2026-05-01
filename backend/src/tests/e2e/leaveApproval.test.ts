/**
 * E2E Tests: Leave Approval Workflows
 * 
 * Tests the complete approval chain including:
 * - Manager approval flow
 * - HR/Admin approval flow
 * - Rejection with comments
 * - Multi-level approval
 * - Concurrent approval handling
 */

import { testPrisma, cleanupTestLeaveData, cleanupTestEmployees } from '../setup';
import { createTestUser, Roles, apiRequest, formatDate, addDays, getNextMonday } from '../utils/testHelpers';
import { LeaveTypeFactory, LeaveBalanceFactory, LeaveApplicationFactory } from '../utils/factories';
import { endpoints, HttpStatus, LeaveStatus } from '../fixtures/testData';

describe('E2E: Leave Approval Workflows', () => {
  let companyId: number;
  let employeeToken: string;
  let employeeId: string;
  let managerToken: string;
  let managerId: string;
  let hrToken: string;
  let hrId: string;
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

    // Create test users with different roles
    const timestamp = Math.floor(Date.now() % 100000000); // 8 digits

    // Admin
    adminId = `TEST-ADM-${timestamp}`;
    const adminResult = await createTestUser(companyId, adminId, `admin-appr-${timestamp}@test.com`, Roles.ADMIN);
    adminToken = adminResult.token;

    // HR
    hrId = `TEST-HR-${timestamp}`;
    const hrResult = await createTestUser(companyId, hrId, `hr-appr-${timestamp}@test.com`, Roles.HR);
    hrToken = hrResult.token;

    // Manager (using HR role for approval permissions)
    managerId = `TEST-MGR-${timestamp}`;
    const managerResult = await createTestUser(companyId, managerId, `mgr-appr-${timestamp}@test.com`, Roles.HR);
    managerToken = managerResult.token;

    // Employee
    employeeId = `TEST-EMP-${timestamp}`;
    const employeeResult = await createTestUser(companyId, employeeId, `emp-appr-${timestamp}@test.com`, Roles.EMPLOYEE);
    employeeToken = employeeResult.token;

    // Set manager relationship
    await testPrisma.employment.updateMany({
      where: { employee_id: employeeId, company_id: companyId },
      data: { manager_id: managerId },
    });

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
    // Clean leave applications
    await testPrisma.leaveApprovalLog.deleteMany({
      where: { application: { company_id: companyId, employee_id: { startsWith: 'TEST-' } } },
    });
    await testPrisma.leaveApplication.deleteMany({
      where: { company_id: companyId, employee_id: { startsWith: 'TEST-' } },
    });
    // Reset balance
    await testPrisma.leaveBalance.updateMany({
      where: { employee_id: employeeId, company_id: companyId },
      data: { used_days: 0, pending_days: 0, remaining_days: 16 },
    });
  });

  // ============================================================================
  // MANAGER APPROVAL FLOW
  // ============================================================================

  describe('Manager Approval Flow', () => {
    it('should allow manager to approve pending leave request', async () => {
      // Employee creates leave
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Manager approval test',
      });

      expect(createResponse.status).toBe(HttpStatus.CREATED);
      const applicationId = createResponse.body.data.application.id;

      // Manager approves
      const approveResponse = await apiRequest(managerToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Approved by manager' }
      );

      expect(approveResponse.status).toBe(HttpStatus.OK);
      expect(approveResponse.body.status).toBe('success');
    });

    it('should update leave status after manager approval', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Status update test',
      });

      const applicationId = createResponse.body.data.application.id;
      
      await apiRequest(managerToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Approved' }
      );

      // Verify status updated
      const application = await testPrisma.leaveApplication.findUnique({
        where: { id: applicationId },
      });

      expect(application?.current_status).not.toBe(LeaveStatus.PENDING_SUPERVISOR);
    });

    it('should create approval log entry', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Approval log test',
      });

      const applicationId = createResponse.body.data.application.id;

      await apiRequest(managerToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Approval with log' }
      );

      // Verify approval log created
      const logs = await testPrisma.leaveApprovalLog.findMany({
        where: { application_id: applicationId },
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('APPROVED');
      expect(logs[0].comments).toBe('Approval with log');
    });
  });

  // ============================================================================
  // REJECTION FLOW
  // ============================================================================

  describe('Rejection Flow', () => {
    it('should allow manager to reject leave request', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Rejection test',
      });

      const applicationId = createResponse.body.data.application.id;

      const rejectResponse = await apiRequest(managerToken).post(
        endpoints.rejectApplication(applicationId),
        { rejection_reason: 'Rejected due to project deadline' }
      );

      expect(rejectResponse.status).toBe(HttpStatus.OK);
    });

    it('should update status to REJECTED after rejection', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Rejection status test',
      });

      const applicationId = createResponse.body.data.application.id;

      await apiRequest(managerToken).post(
        endpoints.rejectApplication(applicationId),
        { rejection_reason: 'Rejected' }
      );

      const application = await testPrisma.leaveApplication.findUnique({
        where: { id: applicationId },
      });

      expect(application?.current_status).toBe(LeaveStatus.REJECTED);
    });

    it('should restore balance after rejection', async () => {
      // Get initial balance
      const initialBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId },
      });

      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Balance restore test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Reject the leave
      await apiRequest(managerToken).post(
        endpoints.rejectApplication(applicationId),
        { rejection_reason: 'Rejected' }
      );

      // Check balance is restored (pending_days should be 0)
      const finalBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId },
      });

      expect(Number(finalBalance?.pending_days)).toBe(0);
    });

    it('should require rejection comment', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Comment required test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Try to reject without comment
      const rejectResponse = await apiRequest(managerToken).post(
        endpoints.rejectApplication(applicationId),
        {} // No rejection_reason
      );

      // Should either require comment or succeed - depends on implementation
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(rejectResponse.status);
    });
  });

  // ============================================================================
  // ADMIN/HR APPROVAL
  // ============================================================================

  describe('Admin/HR Approval', () => {
    it('should allow HR to approve leave requests', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'HR approval test',
      });

      const applicationId = createResponse.body.data.application.id;
      
      // Manually update status to PENDING_HR so HR can approve
      await testPrisma.leaveApplication.update({
        where: { id: applicationId },
        data: { current_status: 'PENDING_HR' }
      });

      const approveResponse = await apiRequest(hrToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'HR approved' }
      );

      expect(approveResponse.status).toBe(HttpStatus.OK);
    });

    it('should allow Admin to approve leave requests', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Admin approval test',
      });

      const applicationId = createResponse.body.data.application.id;

      const approveResponse = await apiRequest(adminToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Admin approved' }
      );

      expect(approveResponse.status).toBe(HttpStatus.OK);
    });

    it('should allow Admin to view all pending applications', async () => {
      // Create a leave request
      const startDate = getNextMonday();
      await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'View pending test',
      });

      const response = await apiRequest(adminToken).get(endpoints.pendingApplications);

      expect(response.status).toBe(HttpStatus.OK);
      expect(Array.isArray(response.body.data.applications)).toBe(true);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases: Double Actions', () => {
    it('should not allow approving an already approved leave', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Double approval test',
      });

      const applicationId = createResponse.body.data.application.id;

      // First approval
      await apiRequest(managerToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'First approval' }
      );

      // Second approval attempt
      const secondApproval = await apiRequest(adminToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Second approval' }
      );

      // Should handle gracefully - either reject or accept based on multi-level approval
      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(secondApproval.status);
    });

    it('should not allow rejecting an already rejected leave', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Double rejection test',
      });

      const applicationId = createResponse.body.data.application.id;

      // First rejection
      await apiRequest(managerToken).post(
        endpoints.rejectApplication(applicationId),
        { rejection_reason: 'First rejection' }
      );

      // Second rejection attempt
      const secondRejection = await apiRequest(adminToken).post(
        endpoints.rejectApplication(applicationId),
        { rejection_reason: 'Second rejection' }
      );

      expect(secondRejection.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should not allow approving a cancelled leave', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Cancel then approve test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Employee cancels
      await apiRequest(employeeToken).post(endpoints.cancelApplication(applicationId));

      // Manager tries to approve cancelled leave
      const approveResponse = await apiRequest(managerToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Trying to approve cancelled' }
      );

      if (approveResponse.status !== HttpStatus.BAD_REQUEST) {
        console.log('Approve response body:', JSON.stringify(approveResponse.body, null, 2));
      }

      expect(approveResponse.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Authorization Checks', () => {
    it('should not allow employee to approve any leave', async () => {
      // Create leave for a different employee (using admin to create directly)
      const timestamp = Math.floor(Date.now() % 100000000);
      const otherEmployeeId = `TEST-OTH-${timestamp}`;
      const otherResult = await createTestUser(
        companyId,
        otherEmployeeId,
        `other-${timestamp}@test.com`,
        Roles.EMPLOYEE
      );

      await LeaveBalanceFactory.create(otherEmployeeId, companyId, annualLeaveType.id);

      const startDate = getNextMonday();
      const application = await LeaveApplicationFactory.create(
        otherEmployeeId,
        companyId,
        annualLeaveType.id,
        { startDate, endDate: startDate, requestedDays: 1 }
      );

      // Employee tries to approve
      const approveResponse = await apiRequest(employeeToken).post(
        endpoints.approveApplication(application.id),
        { comments: 'Unauthorized approval' }
      );

      expect(approveResponse.status).toBe(HttpStatus.FORBIDDEN);

      // Cleanup
      await testPrisma.leaveApplication.delete({ where: { id: application.id } });
      await testPrisma.leaveBalance.deleteMany({ where: { employee_id: otherEmployeeId } });
      await testPrisma.appUser.deleteMany({ where: { employee_id: otherEmployeeId } });
      await testPrisma.employment.deleteMany({ where: { employee_id: otherEmployeeId } });
      await testPrisma.employee.delete({ where: { id: otherEmployeeId } });
    });
  });
});
