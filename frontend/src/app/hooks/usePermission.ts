import { useSelector } from "react-redux";
import { selectAuthUser } from "../slice/authSlice/selectors";

/**
 * A hook to check if the current user has the required permission for a specific resource.
 * Example: `const canCreateEmployee = usePermission("EMPLOYEE", "create", "any");`
 * 
 * Hierarchy: any > team > own > n/a
 */
export const usePermission = () => {
  const user = useSelector(selectAuthUser);

  const hasPermission = (resource: string, action = "read", minScope = "own") => {
    // Fail-secure: If user or permissions are not loaded, deny access.
    if (!user || !user.permissions) return false;

    const perm = user.permissions[resource];
    if (!perm) return false;

    const scope = perm[action];
    if (!scope || scope === "N/A" || scope === "n/a") return false;

    const hierarchy: Record<string, number> = { any: 3, team: 2, own: 1, "n/a": 0 };
    return hierarchy[scope.toLowerCase()] >= hierarchy[minScope.toLowerCase()];
  };

  return { hasPermission };
};
