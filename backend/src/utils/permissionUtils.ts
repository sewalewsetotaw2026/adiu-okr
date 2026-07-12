
import { prisma } from "../app";
import { Resources, Actions, Scopes } from "./constants";

import { redisService } from "src/services/redisService";

/**
 * Cached version to get a role's permission matrix.
 */
export async function getCachedRolePermissionMatrix(roleId: number): Promise<Record<string, Record<string, string>>> {
  const cacheKey = `role_permissions:${roleId}`;

  // Try to get from cache
  const cached = await redisService.get(cacheKey);
  if (cached && Object.keys(cached).length > 0) {
    return cached as Record<string, Record<string, string>>;
  }

  // Fallback to generating it
  const matrix = await getUserPermissionMatrix(roleId);

  // Cache for 24 hours (86400s), manually invalidated on permission changes
  await redisService.set(cacheKey, matrix, 86400).catch(console.error);

  return matrix;
}

/**
 * Checks if a user has permission to read a specific resource for a target employee,
 * using a pre-loaded permission matrix to avoid DB queries where possible.
 */
export async function hasReadPermissionFromMatrix(
  matrix: Record<string, Record<string, string>>,
  resourceCode: string,
  userEmployeeId: string | null,
  targetEmployeeId: string
): Promise<boolean> {
  const perms = matrix[resourceCode];
  if (!perms) return false;

  const readScope = (perms.read || "n/a").toLowerCase();

  if (readScope === "any") return true;

  if (readScope === "team" && userEmployeeId) {
    if (userEmployeeId === targetEmployeeId) return true;

    // We still have to do 1 DB query here for manager check, but ONLY if they are 'team' scope and it's not their own record.
    const isManager = await prisma.employment.findFirst({
      where: {
        employee_id: targetEmployeeId,
        manager_id: userEmployeeId,
        is_active: true,
      },
    });
    if (isManager) return true;
  }

  if (readScope === "own" && userEmployeeId) {
    if (userEmployeeId === targetEmployeeId) return true;
  }

  return false;
}

/**
 * Filters sensitive fields from an employee object based on user permissions.
 */
export async function filterEmployeeSensitiveData(
  user: any,
  employee: any
): Promise<any> {
  if (!user || !user.role_id || !employee) return employee;

  const targetEmployeeId = employee.id || employee.employee_id;
  if (!targetEmployeeId) return employee;

  const filteredEmployee = { ...employee };

  // Sub-resources to check
  const checks = [
    { resource: Resources.EMPLOYEE_PHONE, field: "phones", flatFields: ["phone", "phoneNumber"] },
    { resource: Resources.EMPLOYEE_ADDRESS, field: "addresses", flatFields: ["address", "currentAddress"] },
    { resource: Resources.EMERGENCY_CONTACT, field: "emergencyContacts" },
    { resource: Resources.FINANCIAL_DETAIL, field: "financialDetails", flatFields: ["bankAccount", "bankName"] },
    { resource: Resources.EMPLOYEE_EDUCATION, field: "educations" },
    { resource: Resources.EMPLOYEE_EXPERIENCE, field: "employmentHistories" },
    { resource: Resources.EMPLOYEE_CERTIFICATE, field: "licensesAndCertifications" },
    { resource: Resources.CAREER_EVENT, field: "careerEvents" },
    { resource: Resources.EMPLOYMENT, field: "employments" },
    { resource: Resources.EMPLOYEE_DOCUMENT, field: "documents" },
    { resource: Resources.EMPLOYEE_COST_SHARING, field: "costSharings" },
    { resource: Resources.USER, field: "appUsers", flatFields: ["email"] },
  ];

  // GET MATRIX ONCE
  const matrix = await getCachedRolePermissionMatrix(user.role_id);

  for (const check of checks) {
    const hasData = filteredEmployee[check.field] || (check.flatFields && check.flatFields.some(f => filteredEmployee[f]));

    if (hasData) {
      const hasAccess = await hasReadPermissionFromMatrix(
        matrix,
        check.resource,
        user.employee_id,
        targetEmployeeId
      );

      if (!hasAccess) {
        const identity = user.email || user.employee_id || `user_id:${user.id}`;
        console.log(`[SECURITY] Stripping ${check.resource} for ${identity} on employee ${targetEmployeeId}`);

        // Remove the array/object
        filteredEmployee[check.field] = null;

        // Remove flat fields
        if (check.flatFields) {
          check.flatFields.forEach(f => {
            if (filteredEmployee[f]) filteredEmployee[f] = null;
          });
        }
      }
    }
  }

  // --- DEEP FILTERING FOR NESTED RESOURCES ---

  // 1. Cost Sharing in Educations
  if (filteredEmployee.educations && Array.isArray(filteredEmployee.educations)) {
    const hasAccess = await hasReadPermissionFromMatrix(
      matrix,
      Resources.EMPLOYEE_COST_SHARING,
      user.employee_id,
      targetEmployeeId
    );

    if (!hasAccess) {
      filteredEmployee.educations = filteredEmployee.educations.map((edu: any) => ({
        ...edu,
        costSharings: null,
        costSharingDocument: null,
        costSharingDocumentUrl: null,
        hasCostSharing: false, // Privacy: hide the fact they even have it
      }));
    }
  }

  // 2. Cost Sharing in Employments
  if (filteredEmployee.employments && Array.isArray(filteredEmployee.employments)) {
    const hasAccess = await hasReadPermissionFromMatrix(
      matrix,
      Resources.EMPLOYEE_COST_SHARING,
      user.employee_id,
      targetEmployeeId
    );

    if (!hasAccess) {
      filteredEmployee.employments = filteredEmployee.employments.map((emp: any) => ({
        ...emp,
        cost_sharing_status: null,
        cost_sharing_amount: null,
        cost_sharing_document_urls: [],
      }));
    }
  }

  return filteredEmployee;
}

/**
 * Generates a complete permission matrix for a role.
 */
export async function getUserPermissionMatrix(roleId: number): Promise<Record<string, Record<string, string>>> {
  const role = await prisma.appRole.findUnique({
    where: { id: roleId },
    include: {
      permissions: {
        include: {
          resource: true,
        },
      },
    },
  });

  if (!role) return {};

  const allResources = await prisma.appResource.findMany();

  const matrix: Record<string, Record<string, string>> = {};

  // Initialize with N/A
  allResources.forEach((resource) => {
    matrix[resource.code] = {
      create: "N/A",
      read: "N/A",
      update: "N/A",
      delete: "N/A",
    };
  });

  // Fill in permissions
  role.permissions.forEach((perm) => {
    const resourceCode = perm.resource.code;
    if (!perm.action) return;

    const [action, scope] = perm.action.split(":");
    const normalizedAction = action.toLowerCase();
    const normalizedScope = scope ? scope.toLowerCase() : "any";

    const hierarchy: Record<string, number> = { any: 3, team: 2, own: 1, "n/a": 0 };
    const currentScope = (matrix[resourceCode]?.[normalizedAction] || "n/a").toLowerCase();

    if (
      matrix[resourceCode] &&
      hierarchy[normalizedScope] > (hierarchy[currentScope] ?? -1)
    ) {
      matrix[resourceCode][normalizedAction] = normalizedScope;
    }
  });

  return matrix;
}
