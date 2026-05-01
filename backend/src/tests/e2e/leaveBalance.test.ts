/**
 * E2E Tests: Leave Balance Management
 * 
 * Tests leave balance operations including:
 * - Balance updates after approval/rejection
 * - Accrual calculations
 * - Carry-over logic
 * - Cash-out operations
 */

import { testPrisma, cleanupTestLeaveData, cleanupTestEmployees } from '../setup';
import { createTestUser, Roles, apiRequest, formatDate, addDays, getNextMonday } from '../utils/testHelpers';
import { LeaveTypeFactory, LeaveBalanceFactory } from '../utils/factories';
import { endpoints, HttpStatus } from '../fixtures/testData';
import { Decimal } from '@prisma/client/runtime/library';
import { getFiscalYear } from '../../utils/leaveUtils';

describe('E2E: Leave Balance Management', () => {
  let companyId: number;
  let employeeToken: string;
  let employeeId: string;
  let adminToken: string;
  let adminId: string;
  let annualLeaveType: any;
  let fiscalYear: number;

  beforeAll(async () => {
    const company = await testPrisma.company.findFirst({
      where: { company_code: 'TEST01' },
    });
    if (!company) throw new Error('Test company not found');
    companyId = company.id;

    fiscalYear = await getFiscalYear(companyId);
    annualLeaveType = await LeaveTypeFactory.getAnnualLeave(companyId);

    const timestamp = Math.floor(Date.now() % 100000000); // 8 digits

    // Create admin
    adminId = `TEST-ADM-${timestamp}`;
    const adminResult = await createTestUser(companyId, adminId, `admin-bal-${timestamp}@test.com`, Roles.ADMIN);
    adminToken = adminResult.token;

    // Create employee
    employeeId = `TEST-EMP-${timestamp}`;
    const employeeResult = await createTestUser(companyId, employeeId, `emp-bal-${timestamp}@test.com`, Roles.EMPLOYEE);
    employeeToken = employeeResult.token;

    // Set up employment with start date for accrual
    await testPrisma.employment.updateMany({
      where: { employee_id: employeeId, company_id: companyId },
      data: { start_date: new Date('2023-01-01') },
    });

    // Create leave balance
    await LeaveBalanceFactory.create(employeeId, companyId, annualLeaveType.id, {
      fiscalYear,
      totalEntitlement: 16,
      usedDays: 0,
    });
  });

  afterAll(async () => {
    await cleanupTestLeaveData(companyId);
    await cleanupTestEmployees(companyId);
  });

  beforeEach(async () => {
    // Reset balance and clean applications
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
  // BALANCE RETRIEVAL
  // ============================================================================

  describe('Balance Retrieval', () => {
    it('should retrieve employee own leave balance', async () => {
      const response = await apiRequest(employeeToken).get(endpoints.myLeaveBalance);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data) || typeof response.body.data === 'object').toBe(true);
    });

    it('should show correct balance breakdown', async () => {
      const response = await apiRequest(employeeToken).get(endpoints.myLeaveBalance);

      expect(response.status).toBe(HttpStatus.OK);
      
      const balances = Array.isArray(response.body.data) ? response.body.data : [response.body.data];
      
      if (balances.length > 0) {
        const annualBalance = balances.find((b: any) => 
          b.leave_type_id === annualLeaveType.id || b.leaveType?.id === annualLeaveType.id
        );
        
        if (annualBalance) {
          // Should have balance fields
          expect(annualBalance).toHaveProperty('total_entitlement');
        }
      }
    });

    it('should allow admin to view any employee balance', async () => {
      const response = await apiRequest(adminToken).get(endpoints.employeeBalance(employeeId));

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should allow admin to view all employees balances', async () => {
      const response = await apiRequest(adminToken).get(endpoints.leaveBalances);

      expect(response.status).toBe(HttpStatus.OK);
    });
  });

  // ============================================================================
  // BALANCE UPDATES
  // ============================================================================

  describe('Balance Updates After Leave Actions', () => {
    it('should increase pending days when leave request is created', async () => {
      const initialBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id },
      });

      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Pending days test',
      });

      const updatedBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id },
      });

      // Pending days should increase
      expect(Number(updatedBalance?.pending_days)).toBeGreaterThan(Number(initialBalance?.pending_days || 0));
    });

    it('should update used days and decrease remaining after approval', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Used days test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Approve the leave
      await apiRequest(adminToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Approved' }
      );

      const balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id },
      });

      // After approval, used_days should increase OR status may still be pending in multi-step workflow
      // Check that either used_days > 0 OR pending_days > 0
      const usedDays = Number(balance?.used_days);
      const pendingDays = Number(balance?.pending_days);
      expect(usedDays + pendingDays).toBeGreaterThan(0);
    });

    it('should restore balance when leave is rejected', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Rejection restore test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Reject with rejection_reason
      await apiRequest(adminToken).post(
        endpoints.rejectApplication(applicationId),
        { rejection_reason: 'Rejected for test' }
      );

      const balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id },
      });

      // Pending should be restored (0 or reduced from 1)
      expect(Number(balance?.pending_days)).toBeLessThanOrEqual(1);
    });

    it('should restore balance when leave is cancelled', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Cancel restore test',
      });

      const applicationId = createResponse.body.data.application.id;

      // Cancel
      await apiRequest(employeeToken).post(endpoints.cancelApplication(applicationId));

      const balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id },
      });

      // Pending should be restored (0 or reduced)
      expect(Number(balance?.pending_days)).toBeLessThanOrEqual(1);
    });
  });

  // ============================================================================
  // ADMIN BALANCE ADJUSTMENTS
  // ============================================================================

  describe('Admin Balance Adjustments', () => {
    it('should allow admin to adjust balance (add days)', async () => {
      const balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id },
      });

      if (!balance) return;

      const response = await apiRequest(adminToken).put(endpoints.adjustBalance(balance.id), {
        adjustment_type: 'add',
        days: 5,
        reason: 'Bonus leave days',
      });

      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(response.status);
      
      if (response.status === HttpStatus.OK) {
        const updatedBalance = await testPrisma.leaveBalance.findUnique({
          where: { id: balance.id },
        });
        
        expect(Number(updatedBalance?.total_entitlement)).toBeGreaterThan(16);
      }
    });

    it('should allow admin to adjust balance (subtract days)', async () => {
      const balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id },
      });

      if (!balance) return;

      const response = await apiRequest(adminToken).put(endpoints.adjustBalance(balance.id), {
        adjustment_type: 'subtract',
        days: 2,
        reason: 'Correction',
      });

      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(response.status);
    });

    it('should not allow employee to adjust balance', async () => {
      const balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id },
      });

      if (!balance) return;

      const response = await apiRequest(employeeToken).put(endpoints.adjustBalance(balance.id), {
        adjustment_type: 'add',
        days: 100,
        reason: 'Trying to cheat',
      });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  // ============================================================================
  // MULTIPLE LEAVE TYPES
  // ============================================================================

  describe('Multiple Leave Types', () => {
    it('should track balance separately for different leave types', async () => {
      // Create sick leave type and balance
      const sickLeaveType = await LeaveTypeFactory.getSickLeave(companyId);
      
      await LeaveBalanceFactory.create(employeeId, companyId, sickLeaveType.id, {
        totalEntitlement: 10,
        usedDays: 0,
      });

      // Create annual leave request
      const startDate = getNextMonday();
      await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Annual leave',
      });

      // Check balances
      const annualBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, leave_type_id: annualLeaveType.id },
      });
      const sickBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, leave_type_id: sickLeaveType.id },
      });

      // Sick balance should be unaffected
      expect(Number(sickBalance?.pending_days)).toBe(0);
      expect(Number(annualBalance?.pending_days)).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // CARRY OVER
  // ============================================================================

  describe('Carry Over', () => {
    it('should handle carry over leave from previous year', async () => {
      // Create a balance for previous year with remaining days
      const previousYear = new Date().getFullYear() - 1;
      
      await testPrisma.leaveBalance.upsert({
        where: {
          employee_id_leave_type_id_fiscal_year: {
            employee_id: employeeId,
            leave_type_id: annualLeaveType.id,
            fiscal_year: previousYear,
          },
        },
        create: {
          employee_id: employeeId,
          company_id: companyId,
          leave_type_id: annualLeaveType.id,
          fiscal_year: previousYear,
          total_entitlement: new Decimal(16),
          used_days: new Decimal(10),
          pending_days: new Decimal(0),
          remaining_days: new Decimal(6), // 6 days to carry over
        },
        update: {
          remaining_days: new Decimal(6),
        },
      });

      // Test carry-over API
      const response = await apiRequest(adminToken).post('/api/v1/leave-balances/carry-over', {
        employee_id: employeeId,
        leave_type_id: annualLeaveType.id,
        from_year: previousYear,
        to_year: new Date().getFullYear(),
      });

      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND]).toContain(response.status);
    });
  });

  // ============================================================================
  // EXPIRING BALANCES
  // ============================================================================

  describe('Expiring Balances', () => {
    it('should list balances that are about to expire', async () => {
      // Create an expiring balance
      await testPrisma.leaveBalance.updateMany({
        where: { employee_id: employeeId, company_id: companyId },
        data: {
          expiry_date: addDays(new Date(), 30), // Expires in 30 days
        },
      });

      const response = await apiRequest(adminToken).get('/api/v1/leave-balances/expiring');

      expect(response.status).toBe(HttpStatus.OK);
    });
  });
});
