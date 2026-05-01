/**
 * Global Test Setup and Teardown
 * 
 * This file handles database connections, test data cleanup,
 * and global test configuration.
 */

import { PrismaClient } from '@prisma/client';

// Create a test-specific Prisma client
export const testPrisma = new PrismaClient({
  log: ['warn', 'error'],
});

// Test company ID used across all tests
export const TEST_COMPANY_ID = 1; // Will be set dynamically in setup

/**
 * Global setup before all tests
 */
beforeAll(async () => {
  // Connect to database
  await testPrisma.$connect();
  console.log('🔌 Connected to test database');
});

/**
 * Global teardown after all tests
 */
afterAll(async () => {
  // Disconnect from database
  await testPrisma.$disconnect();
  console.log('🔌 Disconnected from test database');
});

/**
 * Clean up test data between test suites
 * Call this in beforeEach or beforeAll of your test files
 */
export async function cleanupTestLeaveData(companyId: number) {
  // Delete in order to respect foreign key constraints
  await testPrisma.leaveApprovalLog.deleteMany({
    where: {
      application: {
        company_id: companyId,
        employee_id: { startsWith: 'TEST-' },
      },
    },
  });

  await testPrisma.leaveRecall.deleteMany({
    where: {
      leaveApplication: {
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

  await testPrisma.leaveBalance.deleteMany({
    where: {
      company_id: companyId,
      employee_id: { startsWith: 'TEST-' },
    },
  });

  await testPrisma.leaveCashOut.deleteMany({
    where: {
      company_id: companyId,
      employee_id: { startsWith: 'TEST-' },
    },
  });

  console.log('🧹 Cleaned up test leave data');
}

/**
 * Clean up test employees and users
 */
export async function cleanupTestEmployees(companyId: number) {
  await testPrisma.appUser.deleteMany({
    where: {
      company_id: companyId,
      employee_id: { startsWith: 'TEST-' },
    },
  });

  await testPrisma.employment.deleteMany({
    where: {
      company_id: companyId,
      employee_id: { startsWith: 'TEST-' },
    },
  });

  await testPrisma.employee.deleteMany({
    where: {
      company_id: companyId,
      id: { startsWith: 'TEST-' },
    },
  });

  console.log('🧹 Cleaned up test employees');
}

/**
 * Full cleanup - use with caution
 */
export async function fullTestCleanup(companyId: number) {
  await cleanupTestLeaveData(companyId);
  await cleanupTestEmployees(companyId);
}
