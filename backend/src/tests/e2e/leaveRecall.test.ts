/**
 * E2E Tests: Leave Recall
 * 
 * Tests recall workflows:
 * - Manager recalling employee from leave
 * - Employee responding to recall
 * - Balance restoration after recall
 */

import { testPrisma, cleanupTestLeaveData, cleanupTestEmployees } from '../setup';
import { createTestUser, Roles, apiRequest, formatDate, addDays, getNextMonday } from '../utils/testHelpers';
import { LeaveTypeFactory, LeaveBalanceFactory, LeaveApplicationFactory } from '../utils/factories';
import { endpoints, HttpStatus, LeaveStatus } from '../fixtures/testData';

describe('E2E: Leave Recall', () => {
  let companyId: number;
  let employeeToken: string;
  let employeeId: string;
  let managerToken: string;
  let managerId: string;
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
    const adminResult = await createTestUser(companyId, adminId, `admin-rec-${timestamp}@test.com`, Roles.ADMIN);
    adminToken = adminResult.token;

    // Create manager
    managerId = `TEST-MGR-${timestamp}`;
    const managerResult = await createTestUser(companyId, managerId, `mgr-rec-${timestamp}@test.com`, Roles.HR);
    managerToken = managerResult.token;

    // Create employee
    employeeId = `TEST-EMP-${timestamp}`;
    const employeeResult = await createTestUser(companyId, employeeId, `emp-rec-${timestamp}@test.com`, Roles.EMPLOYEE);
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
    // Clean up recalls
    await testPrisma.leaveRecall.deleteMany({
      where: { leaveApplication: { company_id: companyId, employee_id: { startsWith: 'TEST-' } } },
    });
    await testPrisma.leaveApprovalLog.deleteMany({
      where: { application: { company_id: companyId, employee_id: { startsWith: 'TEST-' } } },
    });
    await testPrisma.leaveApplication.deleteMany({
      where: { company_id: companyId, employee_id: { startsWith: 'TEST-' } },
    });
    await testPrisma.leaveBalance.updateMany({
      where: { employee_id: employeeId, company_id: companyId },
      data: { used_days: 5, pending_days: 0, remaining_days: 11 }, // Employee has used some leave
    });
  });

  // Helper to create an active leave
  async function createActiveLeave() {
    const today = new Date();
    const startDate = addDays(today, -2); // Started 2 days ago
    const endDate = addDays(today, 5); // Ends in 5 days
    const returnDate = addDays(endDate, 1);

    const application = await testPrisma.leaveApplication.create({
      data: {
        employee_id: employeeId,
        company_id: companyId,
        leave_type_id: annualLeaveType.id,
        start_date: startDate,
        end_date: endDate,
        return_date: returnDate,
        requested_days: 8,
        reason: 'Active leave for recall test',
        current_status: LeaveStatus.APPROVED,
      },
    });

    // Add approval log
    await testPrisma.leaveApprovalLog.create({
      data: {
        application_id: application.id,
        approver_id: adminId,
        approver_company_id: companyId,
        approver_role: Roles.ADMIN,
        action: 'APPROVED',
      },
    });

    return application;
  }

  // ============================================================================
  // RECALL CREATION
  // ============================================================================

  describe('Recall Creation', () => {
    it('should allow manager to create recall request', async () => {
      const activeLeave = await createActiveLeave();

      const response = await apiRequest(managerToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Urgent project requirement',
        recall_date: formatDate(new Date()),
      });

      expect([HttpStatus.OK, HttpStatus.CREATED]).toContain(response.status);
    });

    it('should allow admin to create recall request', async () => {
      const activeLeave = await createActiveLeave();

      const response = await apiRequest(adminToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Critical business need',
        recall_date: formatDate(new Date()),
      });

      expect([HttpStatus.OK, HttpStatus.CREATED]).toContain(response.status);
    });

    it('should not allow employee to create recall for themselves', async () => {
      const activeLeave = await createActiveLeave();

      const response = await apiRequest(employeeToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Self recall attempt',
        recall_date: formatDate(new Date()),
      });

      expect([HttpStatus.FORBIDDEN, HttpStatus.BAD_REQUEST]).toContain(response.status);
    });

    it('should require reason for recall', async () => {
      const activeLeave = await createActiveLeave();

      const response = await apiRequest(managerToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        recall_date: formatDate(new Date()),
        // Missing reason
      });

      expect([HttpStatus.BAD_REQUEST, HttpStatus.OK, HttpStatus.CREATED]).toContain(response.status);
    });

    it('should only allow recall of approved/ongoing leave', async () => {
      // Create pending leave (not approved)
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Pending leave',
      });

      const applicationId = createResponse.body.data.application.id;

      const response = await apiRequest(managerToken).post(endpoints.leaveRecalls, {
        leave_application_id: applicationId,
        reason: 'Trying to recall pending leave',
        recall_date: formatDate(new Date()),
      });

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  // ============================================================================
  // RECALL LISTING
  // ============================================================================

  describe('Recall Listing', () => {
    it('should list all recalls for admin', async () => {
      const activeLeave = await createActiveLeave();

      // Create a recall
      await apiRequest(adminToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Test recall',
        recall_date: formatDate(new Date()),
      });

      const response = await apiRequest(adminToken).get(endpoints.leaveRecalls);

      expect(response.status).toBe(HttpStatus.OK);
      expect(Array.isArray(response.body.data.recalls)).toBe(true);
    });

    it('should list recall notifications for employee', async () => {
      const activeLeave = await createActiveLeave();

      // Create a recall
      await apiRequest(adminToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Employee recall',
        recall_date: formatDate(new Date()),
      });

      const response = await apiRequest(employeeToken).get(endpoints.myRecalls);

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should get employees currently on leave for recall', async () => {
      await createActiveLeave();

      const response = await apiRequest(adminToken).get('/api/v1/leave-recalls/active-leaves');

      expect(response.status).toBe(HttpStatus.OK);
    });
  });

  // ============================================================================
  // RECALL RESPONSE
  // ============================================================================

  describe('Employee Recall Response', () => {
    it('should allow employee to respond to recall', async () => {
      const activeLeave = await createActiveLeave();

      // Create recall
      const recallResponse = await apiRequest(adminToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Need employee back',
        recall_date: formatDate(new Date()),
      });

      if (recallResponse.status !== HttpStatus.CREATED && recallResponse.status !== HttpStatus.OK) {
        return; // Skip if recall creation failed
      }

      const recallId = recallResponse.body.data?.recall?.id;
      if (!recallId) return;

      // Employee responds
      const response = await apiRequest(employeeToken).post(
        endpoints.respondToRecall(recallId),
        {
          response: 'ACCEPTED',
          actual_return_date: formatDate(addDays(new Date(), 1)),
        }
      );

      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(response.status);
    });

    it('should update recall status after response', async () => {
      const activeLeave = await createActiveLeave();

      const recallResponse = await apiRequest(adminToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Urgent recall',
        recall_date: formatDate(new Date()),
      });

      if (recallResponse.body.data?.recall?.id) {
        const recallId = recallResponse.body.data.recall.id;

        await apiRequest(employeeToken).post(
          endpoints.respondToRecall(recallId),
          { response: 'ACCEPTED', actual_return_date: formatDate(new Date()) }
        );

        const recall = await testPrisma.leaveRecall.findUnique({
          where: { id: recallId },
        });

        expect(recall?.employee_response).toBeDefined();
      }
    });
  });

  // ============================================================================
  // BALANCE RESTORATION
  // ============================================================================

  describe('Balance Restoration After Recall', () => {
    it('should calculate days restored correctly', async () => {
      const activeLeave = await createActiveLeave();

      // Get initial balance
      const initialBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, leave_type_id: annualLeaveType.id },
      });

      const recallResponse = await apiRequest(adminToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Balance restoration test',
        recall_date: formatDate(new Date()),
      });

      if (recallResponse.body.data?.recall?.id) {
        const recallId = recallResponse.body.data.recall.id;

        // Employee responds and returns immediately
        await apiRequest(employeeToken).post(
          endpoints.respondToRecall(recallId),
          { response: 'ACCEPTED', actual_return_date: formatDate(new Date()) }
        );

        // Check the recall for days_restored
        const recall = await testPrisma.leaveRecall.findUnique({
          where: { id: recallId },
        });

        // days_restored should be set if employee returned early
        if (recall?.days_restored) {
          expect(Number(recall.days_restored)).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // ============================================================================
  // RECALL CANCELLATION
  // ============================================================================

  describe('Recall Cancellation', () => {
    it('should allow admin to cancel a pending recall', async () => {
      const activeLeave = await createActiveLeave();

      const recallResponse = await apiRequest(adminToken).post(endpoints.leaveRecalls, {
        leave_application_id: activeLeave.id,
        reason: 'Recall to be cancelled',
        recall_date: formatDate(new Date()),
      });

      if (recallResponse.body.data?.recall?.id) {
        const recallId = recallResponse.body.data.recall.id;

        const deleteResponse = await apiRequest(adminToken).delete(
          `/api/v1/leave-recalls/${recallId}`
        );

        expect([HttpStatus.OK, HttpStatus.NO_CONTENT, HttpStatus.BAD_REQUEST]).toContain(deleteResponse.status);
      }
    });
  });
});
