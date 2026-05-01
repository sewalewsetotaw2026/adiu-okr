import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { Scopes, Resources } from "src/utils/constants";
import { getCachedRolePermissionMatrix } from "src/utils/permissionUtils";

export const verifyAccessControl = (
  resourceCode: string,
  actionType: string,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || !user.role_id) {
        return res.status(401).json({
          status: "fail",
          message: "User not authenticated or role missing",
        });
      }

      // 1. Get user's permission matrix from cache
      const matrix = await getCachedRolePermissionMatrix(user.role_id);

      const permissions = matrix[resourceCode];

      if (!permissions) {
        console.error(`[DEBUG] Resource ${resourceCode} not found in matrix`);
        return res.status(500).json({
          status: "error",
          message: `Resource ${resourceCode} not found`,
        });
      }

      // 2. Parse requested action (e.g., "create:any")
      const [action, scope] = actionType.split(":");
      const normalizedAction = action.toLowerCase();
      const normalizedReqScope = scope.toLowerCase();

      // Get user's scope for this action
      const userScopeForAction = (
        permissions[normalizedAction] || "n/a"
      ).toLowerCase();

      if (userScopeForAction === "n/a") {
        return res.status(403).json({
          status: "fail",
          message: `You do not have permission to ${action} this resource`,
        });
      }

      // 3. Strict check: if the route explicitly requires ANY scope (e.g. read:any),
      // checking for OWN permission later is insufficient. The user MUST have ANY.
      if (normalizedReqScope === Scopes.ANY) {
        if (userScopeForAction === "any") {
          return next();
        }
        // If scope is ANY but user doesn't have it, fail immediately (do not check OWN/TEAM)
        return res.status(403).json({
          status: "fail",
          message: `You do not have permission to ${action} this resource (requires ${Scopes.ANY} access)`,
        });
      }

      // If user has ANY for this action, they are always allowed.
      if (userScopeForAction === "any") {
        return next();
      }

      // Short-circuit: for resources that are always scoped to the requesting user,
      // we skip the complex ownership logic and let the controller filter by req.user.
      const USER_SCOPED_RESOURCES = [
        Resources.USER,
        Resources.NOTIFICATION,
        Resources.CELEBRATION,
        Resources.PUBLIC_HOLIDAY,
        Resources.LEAVE_RECALL,
        Resources.LEAVE_APPLICATION,
        Resources.LEAVE_BALANCE,
      ];
      if (
        USER_SCOPED_RESOURCES.includes(resourceCode) &&
        normalizedReqScope !== Scopes.ANY
      ) {
        return next();
      }

      const getTargetEmployeeId = async (): Promise<string | undefined> => {
        const directId =
          req.params?.employeeId ||
          req.body?.employee_id ||
          (req.query?.employee_id as string | undefined);

        if (directId) {
          return String(directId);
        }

        const idInPath = req.params?.id;
        if (!idInPath) {
          return undefined;
        }

        if (resourceCode === Resources.EMPLOYEE) {
          return String(idInPath);
        }

        try {
          const numericId = Number(idInPath);
          if (isNaN(numericId)) {
            return undefined;
          }

          switch (resourceCode) {
            case Resources.EMPLOYMENT: {
              const result = await prisma.employment.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.LEAVE_APPLICATION: {
              const result = await prisma.leaveApplication.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.LEAVE_RECALL: {
              const result = await prisma.leaveRecall.findUnique({
                where: { id: numericId },
                include: {
                  leaveApplication: { select: { employee_id: true } },
                },
              });
              return result?.leaveApplication?.employee_id;
            }
            case Resources.EMPLOYEE_ADDRESS: {
              const result = await prisma.employeeAddress.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.EMPLOYEE_PHONE: {
              const result = await prisma.employeePhone.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id ?? undefined;
            }
            case Resources.EMERGENCY_CONTACT: {
              const result = await prisma.emergencyContact.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.EMPLOYEE_EDUCATION: {
              const result = await prisma.employeeEducation.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id ?? undefined;
            }
            case Resources.EMPLOYEE_EXPERIENCE: {
              const result = await prisma.employmentHistory.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.EMPLOYEE_CERTIFICATE: {
              const result =
                await prisma.employeeLicensesAndCertifications.findUnique({
                  where: { id: numericId },
                  select: { employee_id: true },
                });
              return result?.employee_id ?? undefined;
            }
            case Resources.EMPLOYEE_ALLOWANCE: {
              const result = await prisma.employeeAllowance.findUnique({
                where: { id: numericId },
                include: { employment: { select: { employee_id: true } } },
              });
              return result?.employment?.employee_id;
            }
            case Resources.EMPLOYEE_RESIGNATION: {
              const result = await prisma.employeeResignation.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id ?? undefined;
            }
            case Resources.FINANCIAL_DETAIL: {
              const result = await prisma.financialDetail.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.CAREER_EVENT: {
              const result = await prisma.employeeCareerEvent.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id ?? undefined;
            }
            case Resources.EMPLOYEE_DOCUMENT: {
              const result = await prisma.employeeDocument.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.LEAVE_BALANCE: {
              const result = await prisma.leaveBalance.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.LEAVE_CASH_OUT: {
              const result = await prisma.leaveCashOut.findUnique({
                where: { id: numericId },
                select: { employee_id: true },
              });
              return result?.employee_id;
            }
            case Resources.NOTIFICATION: {
              const result = await prisma.notification.findUnique({
                where: { id: numericId },
                select: { recipient_id: true },
              });
              return result?.recipient_id;
            }
            default:
              return undefined;
          }
        } catch (error) {
          console.error(
            `[DEBUG] Error resolving target employee for ${resourceCode}:`,
            error,
          );
          return undefined;
        }
      };

      if (
        userScopeForAction === Scopes.OWN ||
        userScopeForAction === Scopes.TEAM
      ) {
        const targetEmployeeId = await getTargetEmployeeId();

        if (
          !targetEmployeeId &&
          (normalizedAction === "create" || normalizedAction === "update")
        ) {
          return res.status(403).json({
            status: "fail",
            message: `Target employee ID is required for ${normalizedAction} operations with restricted permissions`,
          });
        }

        // Collection reads and operations where target is resolved in controller scope
        if (!targetEmployeeId) {
          return next();
        }

        // OWN always allows acting on self
        if (
          user.employee_id &&
          String(targetEmployeeId) === String(user.employee_id)
        ) {
          return next();
        }

        // TEAM includes direct reports
        if (userScopeForAction === Scopes.TEAM && user.employee_id) {
          const employment = await prisma.employment.findFirst({
            where: {
              employee_id: String(targetEmployeeId),
              manager_id: user.employee_id,
              is_active: true,
            },
          });

          if (employment) {
            return next();
          }
        }
      }

      // Fallback deny
      return res.status(403).json({
        status: "fail",
        message: `You do not have permission to ${action} this resource`,
      });
    } catch (error) {
      next(error);
    }
  };
};
