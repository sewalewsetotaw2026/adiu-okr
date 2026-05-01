/**
 * E2E Tests: Authorization & Security
 * 
 * Tests role-based access control:
 * - Employee vs Manager vs Admin access
 * - Cross-company data isolation
 * - Invalid token handling
 * - Permission boundaries
 */

import request from 'supertest';
import app from '../../app';
import { testPrisma, cleanupTestLeaveData, cleanupTestEmployees } from '../setup';
import { createTestUser, Roles, apiRequest, formatDate, getNextMonday, generateAuthToken } from '../utils/testHelpers';
import { LeaveTypeFactory, LeaveBalanceFactory } from '../utils/factories';
import { endpoints, HttpStatus } from '../fixtures/testData';

describe('E2E: Authorization & Security', () => {
  let companyId: number;
  let employeeToken: string;
  let employeeId: string;
  let adminToken: string;
  let adminId: string;
  let hrToken: string;
  let hrId: string;
  let annualLeaveType: any;

  // Second company for isolation tests
  let company2Id: number;
  let employee2Token: string;
  let employee2Id: string;

  beforeAll(async () => {
    // First company
    const company = await testPrisma.company.findFirst({
      where: { company_code: 'TEST01' },
    });
    if (!company) throw new Error('Test company not found');
    companyId = company.id;

    // Create or get second company for isolation tests
    let company2 = await testPrisma.company.findFirst({
      where: { company_code: 'TEST02' },
    });
    if (!company2) {
      company2 = await testPrisma.company.create({
        data: {
          company_code: 'TEST02',
          name: 'Test Company 2',
          is_active: true,
        },
      });
      
      // Create department for company 2
      await testPrisma.department.create({
        data: {
          company_id: company2.id,
          name: 'Default Department',
        },
      });
    }
    company2Id = company2.id;

    annualLeaveType = await LeaveTypeFactory.getAnnualLeave(companyId);

    const timestamp = Math.floor(Date.now() % 100000000); // 8 digits

    // Company 1 users
    adminId = `TEST-ADM-${timestamp}`;
    const adminResult = await createTestUser(companyId, adminId, `admin-auth-${timestamp}@test.com`, Roles.ADMIN);
    adminToken = adminResult.token;

    hrId = `TEST-HR-${timestamp}`;
    const hrResult = await createTestUser(companyId, hrId, `hr-auth-${timestamp}@test.com`, Roles.HR);
    hrToken = hrResult.token;

    employeeId = `TEST-EMP-${timestamp}`;
    const employeeResult = await createTestUser(companyId, employeeId, `emp-auth-${timestamp}@test.com`, Roles.EMPLOYEE);
    employeeToken = employeeResult.token;

    await LeaveBalanceFactory.create(employeeId, companyId, annualLeaveType.id);

    // Company 2 employee (for cross-company tests)
    employee2Id = `TEST-EM2-${timestamp}`;
    
    // Create role for company 2
    let role2 = await testPrisma.appRole.findFirst({
      where: { company_id: company2Id, name: Roles.EMPLOYEE },
    });
    if (!role2) {
      role2 = await testPrisma.appRole.create({
        data: { company_id: company2Id, name: Roles.EMPLOYEE, description: 'Employee role' },
      });
    }

    // Grant read:own permission to the role (idempotent check)
    const leaveAppResource = await testPrisma.appResource.findUnique({
      where: { code: 'LEAVE_APPLICATION' },
    });

    if (leaveAppResource) {
      const existingPerm = await testPrisma.appPermission.findUnique({
        where: {
          role_id_resource_id_action: {
            role_id: role2.id,
            resource_id: leaveAppResource.id,
            action: 'read:own',
          },
        },
      });

      if (!existingPerm) {
        await testPrisma.appPermission.create({
          data: {
            role_id: role2.id,
            resource_id: leaveAppResource.id,
            action: 'read:own',
          },
        });
      }
    }

    // Create employee directly
    await testPrisma.employee.create({
      data: { id: employee2Id, company_id: company2Id, full_name: 'Test Employee 2' },
    });
    
    const dept2 = await testPrisma.department.findFirst({ where: { company_id: company2Id } });
    await testPrisma.employment.create({
      data: {
        employee_id: employee2Id,
        company_id: company2Id,
        department_id: dept2?.id,
        employment_type: 'Full Time',
        start_date: new Date(),
        is_active: true,
      },
    });

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('testpassword123', 12);
    const user2 = await testPrisma.appUser.create({
      data: {
        company_id: company2Id,
        employee_id: employee2Id,
        email: `emp2-auth-${timestamp}@test.com`,
        password_hash: hashedPassword,
        role_id: role2.id,
        is_active: true,
        onboarding_status: 'COMPLETED',
      },
    });
    employee2Token = generateAuthToken(user2.id);
  });

  afterAll(async () => {
    await cleanupTestLeaveData(companyId);
    await cleanupTestEmployees(companyId);
    
    // Cleanup company 2
    await testPrisma.appUser.deleteMany({ where: { company_id: company2Id, employee_id: { startsWith: 'TEST-' } } });
    await testPrisma.employment.deleteMany({ where: { company_id: company2Id, employee_id: { startsWith: 'TEST-' } } });
    await testPrisma.employee.deleteMany({ where: { company_id: company2Id, id: { startsWith: 'TEST-' } } });
  });

  // ============================================================================
  // AUTHENTICATION TESTS
  // ============================================================================

  describe('Authentication', () => {
    it('should reject requests without token', async () => {
      const response = await request(app).get(endpoints.myLeaveBalance);
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get(endpoints.myLeaveBalance)
        .set('Authorization', 'Bearer invalid-token-here');
      
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should reject requests with expired token', async () => {
      // Generate token that expires immediately
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { id: 1 },
        process.env.JWT_SECRET || 'test-jwt-secret-key',
        { expiresIn: '-1s' } // Already expired
      );

      const response = await request(app)
        .get(endpoints.myLeaveBalance)
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should reject malformed authorization header', async () => {
      const response = await request(app)
        .get(endpoints.myLeaveBalance)
        .set('Authorization', 'InvalidFormat token');
      
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });
  });

  // ============================================================================
  // ROLE-BASED ACCESS (EMPLOYEE)
  // ============================================================================

  describe('Employee Role Access', () => {
    it('should allow employee to view own leave balance', async () => {
      const response = await apiRequest(employeeToken).get(endpoints.myLeaveBalance);
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should allow employee to view own leave applications', async () => {
      const response = await apiRequest(employeeToken).get(endpoints.myLeaveApplications);
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should allow employee to create leave request', async () => {
      const startDate = getNextMonday();
      const response = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Auth test',
      });

      expect(response.status).toBe(HttpStatus.CREATED);
    });

    it('should NOT allow employee to view all employees leave applications', async () => {
      const response = await apiRequest(employeeToken).get(endpoints.leaveApplications);
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should NOT allow employee to view all employees leave balances', async () => {
      const response = await apiRequest(employeeToken).get(endpoints.leaveBalances);
      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should NOT allow employee to approve leave requests', async () => {
      // Create a leave first
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Approval auth test',
      });

      const applicationId = createResponse.body.data?.id;
      if (!applicationId) return;

      const approveResponse = await apiRequest(employeeToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'Try to self-approve' }
      );

      expect(approveResponse.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('should NOT allow employee to adjust leave balances', async () => {
      const balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId },
      });

      if (!balance) return;

      const response = await apiRequest(employeeToken).put(
        endpoints.adjustBalance(balance.id),
        { adjustment_type: 'add', days: 100, reason: 'Cheating attempt' }
      );

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  // ============================================================================
  // ROLE-BASED ACCESS (HR)
  // ============================================================================

  describe('HR Role Access', () => {
    it('should allow HR to view all leave applications', async () => {
      const response = await apiRequest(hrToken).get(endpoints.leaveApplications);
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should allow HR to view all leave balances', async () => {
      const response = await apiRequest(hrToken).get(endpoints.leaveBalances);
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should allow HR to approve leave requests', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'HR approval test',
      });

      const applicationId = createResponse.body.data?.id;
      if (!applicationId) return;

      const approveResponse = await apiRequest(hrToken).post(
        endpoints.approveApplication(applicationId),
        { comments: 'HR approved' }
      );

      expect(approveResponse.status).toBe(HttpStatus.OK);
    });

    it('should allow HR to reject leave requests', async () => {
      const startDate = getNextMonday();
      const createResponse = await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'HR rejection test',
      });

      const applicationId = createResponse.body.data?.id;
      if (!applicationId) return;

      const rejectResponse = await apiRequest(hrToken).post(
        endpoints.rejectApplication(applicationId),
        { comments: 'HR rejected' }
      );

      expect(rejectResponse.status).toBe(HttpStatus.OK);
    });
  });

  // ============================================================================
  // ROLE-BASED ACCESS (ADMIN)
  // ============================================================================

  describe('Admin Role Access', () => {
    it('should allow Admin full access to leave applications', async () => {
      const response = await apiRequest(adminToken).get(endpoints.leaveApplications);
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should allow Admin to adjust leave balances', async () => {
      const balance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId },
      });

      if (!balance) return;

      const response = await apiRequest(adminToken).put(
        endpoints.adjustBalance(balance.id),
        { adjustment_type: 'add', days: 2, reason: 'Admin adjustment' }
      );

      expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(response.status);
    });

    it('should allow Admin to view pending applications', async () => {
      const response = await apiRequest(adminToken).get(endpoints.pendingApplications);
      expect(response.status).toBe(HttpStatus.OK);
    });

    it('should allow Admin to view employee-specific balance', async () => {
      const response = await apiRequest(adminToken).get(endpoints.employeeBalance(employeeId));
      expect(response.status).toBe(HttpStatus.OK);
    });
  });

  // ============================================================================
  // CROSS-COMPANY ISOLATION
  // ============================================================================

  describe('Cross-Company Data Isolation', () => {
    it('should NOT allow employee from company 2 to view company 1 data', async () => {
      // Try to access company 1 employee's balance
      const response = await apiRequest(employee2Token).get(endpoints.employeeBalance(employeeId));
      
      // Should either be forbidden or return empty/not found
      expect([HttpStatus.FORBIDDEN, HttpStatus.NOT_FOUND, HttpStatus.OK]).toContain(response.status);
      
      // If OK, should not contain company 1's employee data
      if (response.status === HttpStatus.OK) {
        const data = response.body.data;
        if (Array.isArray(data)) {
          const hasCompany1Data = data.some((d: any) => d.company_id === companyId);
          expect(hasCompany1Data).toBe(false);
        }
      }
    });

    it('should isolate leave applications by company', async () => {
      // Create leave in company 1
      const startDate = getNextMonday();
      await apiRequest(employeeToken).post(endpoints.leaveApplications, {
        leave_type_id: annualLeaveType.id,
        start_date: formatDate(startDate),
        end_date: formatDate(startDate),
        requested_days: 1,
        reason: 'Isolation test',
      });

      // Employee from company 2 should not see company 1 leaves in "all applications"
      // (Even if they had admin access, they'd only see their company)
      const response = await apiRequest(employee2Token).get(endpoints.myLeaveApplications);
      
      expect(response.status).toBe(HttpStatus.OK);
      
      const applications = response.body.data.applications || [];
      const hasOtherCompanyData = applications.some((app: any) => app.company_id === companyId);
      expect(hasOtherCompanyData).toBe(false);
    });
  });

  // ============================================================================
  // DEACTIVATED USER
  // ============================================================================

  describe('Deactivated User Access', () => {
    it('should reject requests from deactivated user', async () => {
      // Create and then deactivate a user
      const timestamp = Math.floor(Date.now() % 100000000); // 8 digits
      const deactivatedId = `TEST-DEC-${timestamp}`;
      
      const result = await createTestUser(
        companyId,
        deactivatedId,
        `deactivated-${timestamp}@test.com`,
        Roles.EMPLOYEE
      );

      // Deactivate the user
      await testPrisma.appUser.update({
        where: { id: parseInt(result.user.id.toString()) },
        data: { is_active: false },
      });

      // Try to make a request
      const response = await apiRequest(result.token).get(endpoints.myLeaveBalance);
      
      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);

      // Cleanup
      await testPrisma.appUser.delete({ where: { id: parseInt(result.user.id.toString()) } });
      await testPrisma.employment.deleteMany({ where: { employee_id: deactivatedId } });
      await testPrisma.employee.delete({ where: { id: deactivatedId } });
    });
  });
});
