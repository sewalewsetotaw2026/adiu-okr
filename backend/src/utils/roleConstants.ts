/**
 * Role Constants
 *
 * Centralized role name constants for consistency across the application.
 * These constants should match the role names in the database.
 */

export const RoleNames = {
  SUPERADMIN: "SuperAdmin",
  ADMIN: "Admin",
  HR: "HR",
  EMPLOYEE: "Employee",
} as const;

/**
 * SuperAdmin role name variants (case-insensitive)
 * Used for checking if a role is SuperAdmin
 */
export const SUPERADMIN_VARIANTS = [
  "SuperAdmin",
  "Superadmin",
  "superadmin",
  "Super Admin",
  "super admin",
  "SUPERADMIN",
] as const;

/**
 * Check if a role name is SuperAdmin (case-insensitive)
 */
export const isSuperAdminRole = (roleName: string): boolean => {
  const normalized = roleName.toLowerCase().trim();
  return (
    normalized === "superadmin" ||
    normalized === "super admin" ||
    SUPERADMIN_VARIANTS.some((variant) => variant.toLowerCase() === normalized)
  );
};

/**
 * Role name to ID mapping helper
 * This can be used to resolve role names to IDs when needed
 */
export type RoleName = (typeof RoleNames)[keyof typeof RoleNames];
