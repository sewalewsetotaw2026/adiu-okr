import { Request, Response, NextFunction } from "express";
import { prisma } from "../app";
import { getUserPermissionMatrix } from "../utils/permissionUtils";
import { redisService } from "src/services/redisService";

/**
 * Get all roles for the authenticated user's company
 */
export const getRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const roles = await prisma.appRole.findMany({
      where: { company_id: companyId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { appUsers: true },
        },
      },
    });

    res.status(200).json({
      status: "success",
      data: roles,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get details for a specific role, including permissions grouped by resource
 */
export const getRoleDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const roleId = parseInt(req.params.id);

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const role = await prisma.appRole.findFirst({
      where: { id: roleId, company_id: companyId },
      include: {
        permissions: {
          include: {
            resource: true,
          },
        },
        appUsers: {
          select: {
            id: true,
            email: true,
            employee: {
              select: {
                id: true,
                full_name: true,
              }
            }
          }
        }
      },
    });

    if (!role) {
      return res.status(404).json({
        status: "fail",
        message: "Role not found",
      });
    }

    // Use utility to generate matrix
    const permissionMatrix = await getUserPermissionMatrix(roleId);
    const allResources = await prisma.appResource.findMany({
      where: { code: { not: "COMPANY" } },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      status: "success",
      data: {
        role,
        matrix: permissionMatrix,
        resources: allResources,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new role
 */
export const createRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const { name, description } = req.body;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    if (!name) {
      return res.status(400).json({
        status: "fail",
        message: "Role name is required",
      });
    }

    const existingRole = await prisma.appRole.findFirst({
      where: { company_id: companyId, name: { equals: name, mode: "insensitive" } },
    });

    if (existingRole) {
      return res.status(400).json({
        status: "fail",
        message: "Role with this name already exists",
      });
    }

    const newRole = await prisma.appRole.create({
      data: {
        company_id: companyId,
        name,
        description,
      },
    });

    console.log(`[Role] Created new role: ${newRole.name} (${newRole.id})`);

    res.status(201).json({
      status: "success",
      data: newRole,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a role
 */
export const deleteRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const roleId = parseInt(req.params.id);

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found",
      });
    }

    // Check if role exists and belongs to company
    const role = await prisma.appRole.findFirst({
      where: { id: roleId, company_id: companyId },
      include: {
        _count: {
          select: { appUsers: true }
        }
      }
    });

    if (!role) {
      return res.status(404).json({
        status: "fail",
        message: "Role not found",
      });
    }

    // Prevent deletion if users are assigned
    if (role._count.appUsers > 0) {
      return res.status(400).json({
        status: "fail",
        message: `Cannot delete role. It is assigned to ${role._count.appUsers} users.`,
      });
    }

    // Prevent deletion of system roles (optional, robust check matches by name usually)
    const systemRoles = ["Admin", "Employee", "HR", "Manager"];
    if (systemRoles.includes(role.name)) {
      return res.status(400).json({
        status: "fail",
        message: "Cannot delete system default roles.",
      });
    }

    await prisma.appRole.delete({
      where: { id: roleId },
    });

    // Invalidate the cache for the deleted role
    await redisService.del(`role_permissions:${roleId}`).catch(console.error);

    console.log(`[Role] Deleted role: ${role.name} (${role.id})`);

    res.status(200).json({
      status: "success",
      message: "Role deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a specific permission for a role
 * Expectations:
 * Body: { resourceCode: "EMPLOYEES", action: "read", scope: "team" }
 * If scope is "N/A" or empty, the permission should be removed.
 */
export const updatePermission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const roleId = parseInt(req.params.id);
    const { resourceCode, action, scope } = req.body;

    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "No Company ID" });
    }

    if (!resourceCode || !action) {
      return res.status(400).json({ status: "fail", message: "Resource code and action are required" });
    }

    // Verify role ownership
    const role = await prisma.appRole.findFirst({
      where: { id: roleId, company_id: companyId },
    });

    if (!role) {
      return res.status(404).json({ status: "fail", message: "Role not found" });
    }

    // Find Resource ID
    const resource = await prisma.appResource.findUnique({
      where: { code: resourceCode },
    });

    if (!resource) {
      return res.status(404).json({ status: "fail", message: `Resource '${resourceCode}' not found` });
    }

    // Construct the DB action string (e.g., "read:team")
    // We need to handle "N/A" -> Delete permission
    const normalizedScope = scope?.toLowerCase() || "n/a";
    const normalizedAction = action.toLowerCase();

    // We need to find if there is an existing permission for this Role + Resource + ActionType (prefix)
    // The database constraint is unique([role_id, resource_id, action])
    // The 'action' column stores the full string "read:team".
    // So if we want to change "read:team" to "read:own", we are technically changing the 'action' field value.
    // However, Prisma doesn't support "startsWith" in deleteMany easily combined with other logic usually meant for precise matches.
    // Actually, distinct permissions like "read:team" and "read:own" would be checked.
    // But logically, a role should only have ONE scope per action type. (You can't have Read Own AND Read Team, Read Team implies Own).
    // So we must ensure we delete any existing permission that starts with `${normalizedAction}:` for this resource.

    // 1. Find existing permissions for this role & resource
    const existingPerms = await prisma.appPermission.findMany({
      where: {
        role_id: roleId,
        resource_id: resource.id,
      }
    });

    // 2. Identify all permissions that match the action type (e.g. "read" part of "read:team")
    const permsToDelete = existingPerms.filter(p => p.action.split(":")[0] === normalizedAction);

    // 3. Delete them if found
    if (permsToDelete.length > 0) {
      await prisma.appPermission.deleteMany({
        where: { id: { in: permsToDelete.map(p => p.id) } }
      });
    }

    // 4. If new scope is NOT "n/a", create the new permission
    if (normalizedScope !== "n/a" && normalizedScope !== "") {
      const newActionValue = `${normalizedAction}:${normalizedScope}`;
      await prisma.appPermission.create({
        data: {
          role_id: roleId,
          resource_id: resource.id,
          action: newActionValue
        }
      });
    }

    // 5. Invalidate the cached permission matrix for this role
    await redisService.del(`role_permissions:${roleId}`).catch(console.error);

    // 6. Invalidate all resource caches for this company
    // Because GET requests cache data that is filtered by permissions,
    // changing permissions means cached responses might contain data users shouldn't see
    // or lack data they should now see.
    console.log(`[Role Update] Invalidating all company cache due to permission update on role ${roleId}`);
    await redisService.delByPattern(`company:${companyId}:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Permission updated successfully",
    });

  } catch (error) {
    next(error);
  }
};
/**
 * Assign multiple users to a specific role
 */
export const assignUsersToRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const roleId = parseInt(req.params.id);
    const { userIds } = req.body;

    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "No Company ID" });
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ status: "fail", message: "userIds array is required" });
    }

    // Verify role ownership
    const role = await prisma.appRole.findFirst({
      where: { id: roleId, company_id: companyId },
    });

    if (!role) {
      return res.status(404).json({ status: "fail", message: "Role not found" });
    }

    // Update users
    await prisma.appUser.updateMany({
      where: {
        id: { in: userIds.map(id => parseInt(id.toString())) },
        company_id: companyId,
      },
      data: { role_id: roleId },
    });

    // Invalidate caches for all updated users
    for (const userId of userIds) {
      await redisService.del(`role_permissions:${roleId}`).catch(console.error); // Note: Should ideally invalidate user session/perms if cached per user
    }

    console.log(`[Role Mapping] Assigned ${userIds.length} users to role: ${role.name}`);

    res.status(200).json({
      status: "success",
      message: `Successfully assigned ${userIds.length} users to role ${role.name}`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a user from their current role (resets to default 'Employee' role)
 */
export const removeUserFromRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const { userId } = req.body;

    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "No Company ID" });
    }

    if (!userId) {
      return res.status(400).json({ status: "fail", message: "userId is required" });
    }

    // Find the default "Employee" role for the company
    const employeeRole = await prisma.appRole.findFirst({
      where: { company_id: companyId, name: "Employee" },
    });

    if (!employeeRole) {
      return res.status(404).json({ status: "fail", message: "Default Employee role not found for company" });
    }

    // Update user back to employee role
    await prisma.appUser.update({
      where: { id: parseInt(userId.toString()), company_id: companyId },
      data: { role_id: employeeRole.id },
    });

    console.log(`[Role Mapping] Reset user ${userId} to default Employee role`);

    res.status(200).json({
      status: "success",
      message: "User reverted to default Employee role",
    });
  } catch (error) {
    next(error);
  }
};
