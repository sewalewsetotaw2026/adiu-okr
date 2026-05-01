/**
 * E2E Reproduction: Update Start Date Bug
 * 
 * Tests if updating employee start date correctly recalculates leave balances/carry-over.
 */

import { testPrisma, cleanupTestLeaveData, cleanupTestEmployees } from './setup';
import { createTestUser, Roles, apiRequest } from './utils/testHelpers';
import { LeaveTypeFactory, LeaveBalanceFactory } from './utils/factories';
import { endpoints, HttpStatus } from './fixtures/testData';
import { getFiscalYear } from '../utils/leaveUtils';
import { Decimal } from '@prisma/client/runtime/library';

describe('E2E Reproduction: Update Start Date Bug', () => {
  let companyId: number;
  let adminToken: string;
  let adminId: string;
  let employeeId: string;
  let employeeToken: string;
  let annualLeaveType: any;
  let fiscalYear: number;
  let employmentId: number;

  const employmentsEndpoint = '/api/v1/employments'; // Add this since it's missing in endpoints

  beforeAll(async () => {
    // 1. Setup Company and Admin
    const company = await testPrisma.company.findFirst({
      where: { company_code: 'TEST01' },
    });
    if (!company) throw new Error('Test company not found');
    companyId = company.id;

    fiscalYear = await getFiscalYear(companyId);
    annualLeaveType = await LeaveTypeFactory.getAnnualLeave(companyId);

    const timestamp = Math.floor(Date.now() % 100000000);

    adminId = `TEST-ADM-R-${timestamp}`;
    const adminResult = await createTestUser(companyId, adminId, `admin-repro-${timestamp}@test.com`, Roles.ADMIN);
    adminToken = adminResult.token;

    // 2. Create Employee
    employeeId = `TEST-EMP-R-${timestamp}`;
    const employeeResult = await createTestUser(companyId, employeeId, `emp-repro-${timestamp}@test.com`, Roles.EMPLOYEE);
    employeeToken = employeeResult.token;

    // 3. Set initial start date to 2024-01-01 (Assuming current year is 2026, so 2 years service)
    // Actually, createTestUser likely created an employment. Let's find it.
    const employment = await testPrisma.employment.findFirst({
        where: { employee_id: employeeId, company_id: companyId }
    });
    
    if (employment) {
        employmentId = employment.id;
        await testPrisma.employment.update({
            where: { id: employment.id },
            data: { start_date: new Date('2024-01-01') }
        });
    } else {
        // Create employment if not exists (shouldn't happen with createTestUser but safety check)
        const emp = await testPrisma.employment.create({
            data: {
                employee_id: employeeId,
                company_id: companyId,
                employment_type: 'Full Time',
                start_date: new Date('2024-01-01'),
                is_active: true
            }
        });
        employmentId = emp.id;
    }

    // 4. Create Initial Leave Balance
    // Assuming 2 years of service:
    // Base 16. Bonus = 1 day per 2 years.
    // Years of service = 2026 - 2024 = 2.
    // Bonus = 1 day.
    // Total should be 17.
    // BUT, we will manually create what the system would calculate for 2024 start date.
    // Let's assume the system calculated 17 days.
    await LeaveBalanceFactory.create(employeeId, companyId, annualLeaveType.id, {
      fiscalYear,
      totalEntitlement: 17
    });
  });

  afterAll(async () => {
    await cleanupTestLeaveData(companyId);
    await cleanupTestEmployees(companyId);
  });

  it('should update leave entitlement when start date is changed to 2020', async () => {
    // 1. Initial Check
    const initialBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id, fiscal_year: fiscalYear }
    });
    expect(Number(initialBalance?.total_entitlement)).toBe(17);

    // 2. Action: Update Employment Start Date to 2020-01-01
    // This gives 6 years of service (2026 - 2020).
    // Bonus: 6 / 2 = 3 increments.
    // If incremental_days_per_year is 1, then bonus is 3 days.
    // Total Entitlement should be 16 + 3 = 19 days.
    // Or if we go by "carry over", it should have plenty of carry over if configured, but let's test specific entitlement recalculation first.
    
    // We send PUT request to update employment
    const response = await apiRequest(adminToken).put(`${employmentsEndpoint}/${employeeId}`).send({
        start_date: '2020-01-01'
    });

    expect(response.status).toBe(HttpStatus.OK);
    
    // 3. Verification: Check Leave Balance
    const updatedBalance = await testPrisma.leaveBalance.findFirst({
        where: { employee_id: employeeId, company_id: companyId, leave_type_id: annualLeaveType.id, fiscal_year: fiscalYear }
    });
    
    // The entitlement should have increased due to recalculation based on new tenure
    // Expected: 19 (16 base + 3 bonus)
    // Actual (if bug exists): 17 (unchanged)
    console.log(`Old Entitlement: ${initialBalance?.total_entitlement}, New Entitlement: ${updatedBalance?.total_entitlement}`);
    
    expect(Number(updatedBalance?.total_entitlement)).not.toBe(Number(initialBalance?.total_entitlement));
    expect(Number(updatedBalance?.total_entitlement)).toBeGreaterThan(Number(initialBalance?.total_entitlement));
  });
});
