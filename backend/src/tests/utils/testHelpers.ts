/**
 * Test Helper Utilities
 * 
 * Provides authentication helpers, API request wrappers,
 * and common test utilities.
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { testPrisma } from '../setup';
import app from '../../app';

// JWT secret for test tokens
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

/**
 * Role names as defined in the system
 */
export const Roles = {
  ADMIN: 'Admin',
  HR: 'HR',
  EMPLOYEE: 'Employee',
  SUPERADMIN: 'SuperAdmin',
} as const;

/**
 * Generate a valid JWT token for testing
 */
export function generateAuthToken(userId: number, expiresInSeconds: number = 3600): string {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: expiresInSeconds });
}

/**
 * Create a test user with specified role
 */
export async function createTestUser(
  companyId: number,
  employeeId: string,
  email: string,
  roleName: string,
  options: {
    fullName?: string;
    gender?: string;
    isActive?: boolean;
  } = {}
) {
  const { fullName = 'Test User', gender = 'Male', isActive = true } = options;

  // Get or create the role
  let role = await testPrisma.appRole.findFirst({
    where: { company_id: companyId, name: roleName },
  });

  if (!role) {
    role = await testPrisma.appRole.create({
      data: {
        company_id: companyId,
        name: roleName,
        description: `Test ${roleName} role`,
      },
    });
  }

  // Create employee
  const employee = await testPrisma.employee.create({
    data: {
      id: employeeId,
      company_id: companyId,
      full_name: fullName,
      gender,
      date_of_birth: new Date('1990-01-15'),
    },
  });

  // Create employment record
  const department = await testPrisma.department.findFirst({
    where: { company_id: companyId },
  });

  if (department) {
    await testPrisma.employment.create({
      data: {
        employee_id: employeeId,
        company_id: companyId,
        department_id: department.id,
        employment_type: 'Full Time',
        start_date: new Date('2023-01-01'),
        is_active: true,
      },
    });
  }

  // Create app user
  const hashedPassword = await bcrypt.hash('testpassword123', 12);
  const user = await testPrisma.appUser.create({
    data: {
      company_id: companyId,
      employee_id: employeeId,
      email,
      password_hash: hashedPassword,
      role_id: role.id,
      is_active: isActive,
      onboarding_status: 'COMPLETED',
    },
  });

  // Generate auth token
  const token = generateAuthToken(user.id);

  return {
    user,
    employee,
    token,
    role,
  };
}

/**
 * Create test user with manager relationship
 */
export async function createTestUserWithManager(
  companyId: number,
  employeeId: string,
  managerId: string,
  email: string
) {
  const result = await createTestUser(companyId, employeeId, email, Roles.EMPLOYEE);

  // Update employment with manager
  await testPrisma.employment.updateMany({
    where: {
      employee_id: employeeId,
      company_id: companyId,
    },
    data: {
      manager_id: managerId,
    },
  });

  return result;
}

/**
 * Authenticated API request helper
 */
export function apiRequest(token: string) {
  return {
    get: (url: string) =>
      request(app)
        .get(url)
        .set('Authorization', `Bearer ${token}`),
    
    post: (url: string, body?: any) =>
      request(app)
        .post(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    
    put: (url: string, body?: any) =>
      request(app)
        .put(url)
        .set('Authorization', `Bearer ${token}`)
        .send(body),
    
    delete: (url: string) =>
      request(app)
        .delete(url)
        .set('Authorization', `Bearer ${token}`),
  };
}

/**
 * Get date string in YYYY-MM-DD format
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get next Monday from a date
 */
export function getNextMonday(from: Date = new Date()): Date {
  const date = new Date(from);
  const day = date.getDay();
  const diff = day === 0 ? 1 : 8 - day; // If Sunday, +1; otherwise, days until next Monday
  date.setDate(date.getDate() + diff);
  return date;
}

/**
 * Get a weekday (Mon-Fri) that's N business days from now
 */
export function getFutureWeekday(businessDaysFromNow: number): Date {
  let date = new Date();
  let daysAdded = 0;
  
  while (daysAdded < businessDaysFromNow) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }
  
  return date;
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if response has expected status
 */
export function hasStatus(response: request.Response, statusCode: number): boolean {
  return response.status === statusCode;
}

/**
 * Check if response is successful
 */
export function isSuccess(response: request.Response): boolean {
  return response.status >= 200 && response.status < 300;
}
