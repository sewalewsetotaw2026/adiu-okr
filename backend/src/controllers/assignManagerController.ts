import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";
import { RoleNames, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";

export const searchPotentialManagers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = (req as any).user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { query } = req.query;

    const where: any = {
      company_id: Number(companyId),
      appUsers: {
        some: {
          onboarding_status: { in: ["PENDING_APPROVAL", "COMPLETED"] },
        },
        none: {
          role: {
            name: {
              in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
            },
          },
        },
      },
    };

    if (query && typeof query === "string") {
      where.full_name = {
        contains: query,
        mode: "insensitive",
      };
    }
    const employees = await prisma.employee.findMany({
      where,
      take: 10,
      select: {
        id: true,
        full_name: true,
        appUsers: {
          select: {
            email: true,
          },
        },
        employments: {
          where: { is_active: true },
          select: {
            jobTitle: {
              select: { title: true },
            },
            department: {
              select: { name: true },
            },
          },
        },
      },
    });

    const formattedEmployees = await Promise.all(
      employees.map(async (emp) => {
        return {
          id: emp.id,
          full_name: emp.full_name,
          email: emp.appUsers[0]?.email,
          profile_picture: null, // Optimization: skip signing
          job_title: emp.employments[0]?.jobTitle?.title,
          department: emp.employments[0]?.department?.name,
        };
      }),
    );

    return res.status(200).json({
      status: "success",
      data: {
        employees: formattedEmployees,
      },
    });
  } catch (error) {
    console.error("Error in removeMember:", error);
    next(error);
  }
};

export const getExistingManagers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = (req as any).user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { query, department, job_title, job_level } = req.query;

    const where: any = {
      company_id: Number(companyId),
      managedEmployments: {
        some: {
          is_active: true,
        },
      },
      appUsers: {
        none: {
          role: {
            name: {
              in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
            },
          },
        },
      },
    };

    if (query && typeof query === "string") {
      where.full_name = {
        contains: query,
        mode: "insensitive",
      };
    }

    if (
      (department && typeof department === "string") ||
      (job_title && typeof job_title === "string") ||
      (job_level && typeof job_level === "string")
    ) {
      const conditions: any = { is_active: true };

      if (department && typeof department === "string") {
        conditions.department = {
          name: { contains: department, mode: "insensitive" },
        };
      }

      if (job_title && typeof job_title === "string") {
        conditions.jobTitle = {
          title: { contains: job_title, mode: "insensitive" },
        };
      }

      if (job_level && typeof job_level === "string") {
        conditions.jobTitle = {
          ...(conditions.jobTitle || {}),
          level: { contains: job_level, mode: "insensitive" },
        };
      }

      where.employments = {
        some: conditions,
      };
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [managers, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: {
          id: true,
          full_name: true,
          appUsers: {
            select: {
              email: true,
            },
          },
          employments: {
            where: { is_active: true },
            select: {
              jobTitle: { select: { title: true } },
              department: { select: { name: true } },
            },
          },
          _count: {
            select: {
              managedEmployments: { where: { is_active: true } },
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    const formattedManagers = managers.map((mgr: any) => ({
      id: mgr.id,
      full_name: mgr.full_name,
      email: mgr.appUsers[0]?.email,
      // profile_picture: null,
      job_title: mgr.employments[0]?.jobTitle?.title,
      department: mgr.employments[0]?.department?.name,
      team_size: mgr._count?.managedEmployments || 0,
    }));
    // Calculate total pages
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      status: "success",
      data: {
        managers: formattedManagers,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Error in removeMember:", error);
    next(error);
  }
};

export const removeTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = (req as any).user?.company_id;
    if (!companyId) {
      return res
        .status(400)
        .json({ status: "fail", message: "Company ID not found" });
    }

    const { employee_id } = req.body;
    if (!employee_id) {
      return res
        .status(400)
        .json({ status: "fail", message: "Employee ID is required" });
    }

    // Update ALL active employments for this employee to remove the manager
    const result = await prisma.employment.updateMany({
      where: {
        employee_id: employee_id,
        company_id: Number(companyId),
        is_active: true,
      },
      data: { manager_id: null },
    });

    if (result.count === 0) {
      return res.status(404).json({
        status: "fail",
        message:
          "No active employment found for this employee to remove from team.",
      });
    }

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_member:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_members_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:employees_search:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:analytics:*`)
      .catch(console.error);

    return res.status(200).json({
      status: "success",
      message: "Team member removed and unassigned successfully",
    });
  } catch (error) {
    console.error("Error in removeMember:", error);
    next(error);
  }
};

export const assignManagers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = (req as any).user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { manager_id, subordinate_ids } = req.body;

    if (!manager_id) {
      return res.status(400).json({
        status: "fail",
        message: "Manager ID is required",
      });
    }

    if (
      !subordinate_ids ||
      !Array.isArray(subordinate_ids) ||
      subordinate_ids.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "At least one subordinate ID is required",
      });
    }

    if (subordinate_ids.includes(manager_id)) {
      return res.status(400).json({
        status: "fail",
        message:
          "An employee cannot report to themselves. Please remove the manager from the subordinate list.",
      });
    }

    // 1. Verify Manager Exists & Check Circular Dependency
    const manager = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: manager_id,
          company_id: Number(companyId),
        },
      },
      include: {
        employments: {
          where: { is_active: true },
        },
      },
    });

    if (!manager) {
      return res.status(404).json({
        status: "fail",
        message: "Manager not found in this company",
      });
    }

    // 2. Validate Subordinates Onboarding Status
    const ineligibleSubordinates = await prisma.appUser.findMany({
      where: {
        employee_id: { in: subordinate_ids },
        company_id: Number(companyId),
        onboarding_status: { not: "COMPLETED" },
      },
      include: {
        employee: { select: { full_name: true } },
      },
    });

    if (ineligibleSubordinates.length > 0) {
      const names = ineligibleSubordinates
        .map((u) => u.employee?.full_name)
        .join(", ");
      return res.status(400).json({
        status: "fail",
        message: `The following employees have not completed onboarding and cannot be assigned to a team: ${names}`,
      });
    }

    // Check for circular dependency (A reports to B, and now B reports to A)
    const managersCurrentManagerId = manager.employments[0]?.manager_id;
    let clearManagerIdForNewManager = false;

    if (
      managersCurrentManagerId &&
      subordinate_ids.includes(managersCurrentManagerId)
    ) {
      // Circular detected: The New Manager (A) currently reports to one of the Subordinates (B).
      // To allow this "Swap/Promotion", we must remove B as A's manager.
      clearManagerIdForNewManager = true;
    }

    // 2. Perform Bulk Update
    const result = await prisma.$transaction(async (tx) => {
      // If we need to break a cycle, do it first
      if (clearManagerIdForNewManager && manager.employments[0]) {
        await tx.employment.update({
          where: { id: manager.employments[0].id },
          data: { manager_id: null }, // Clear their boss (they are now the boss)
        });
      }

      // Handle 'replace' strategy: Unassign anyone currently reporting to manager_id who is NOT in subordinate_ids
      let unassignedCount = 0;
      if (req.body.strategy === "replace") {
        const currentTeam = await tx.employment.findMany({
          where: {
            company_id: Number(companyId),
            is_active: true,
            manager_id: manager_id,
          },
          select: { id: true, employee_id: true },
        });

        // IDs to remove: Those in currentTeam/manager_id but NOT in subordinate_ids
        const idsToRemove = currentTeam
          .filter((e) => !subordinate_ids.includes(e.employee_id))
          .map((e) => e.id);

        if (idsToRemove.length > 0) {
          const removeResult = await tx.employment.updateMany({
            where: { id: { in: idsToRemove } },
            data: { manager_id: null },
          });
          unassignedCount = removeResult.count;
        }
      }

      // Fetch active employments for subordinates
      const activeEmployments = await tx.employment.findMany({
        where: {
          company_id: Number(companyId),
          is_active: true,
          employee_id: { in: subordinate_ids },
        },
        select: {
          id: true,
          employee_id: true,
          start_date: true,
          created_at: true,
        },
        orderBy: [{ start_date: "desc" }, { created_at: "desc" }],
      });

      if (activeEmployments.length === 0) {
        throw new Error(
          "No active employments found for the provided subordinates.",
        );
      }

      // Filter to get ONLY the latest active employment for each employee
      const latestEmploymentIds: number[] = [];
      const processedEmployeeIds = new Set<string>();

      for (const emp of activeEmployments) {
        if (!processedEmployeeIds.has(emp.employee_id)) {
          latestEmploymentIds.push(emp.id);
          processedEmployeeIds.add(emp.employee_id);
        }
      }

      // Bulk update only the LATEST active employments
      const updateResult = await tx.employment.updateMany({
        where: {
          id: { in: latestEmploymentIds },
        },
        data: {
          manager_id: manager_id,
        },
      });

      return {
        updatedCount: updateResult.count,
        unassignedCount,
        targetCount: subordinate_ids.length,
        cycleResolved: clearManagerIdForNewManager,
      };
    });

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_member:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_members_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:employees_search:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:analytics:*`)
      .catch(console.error);

    res.status(200).json({
      status: "success",
      message: `Successfully assigned ${result.updatedCount} members and removed ${result.unassignedCount} members`,
      data: result,
    });
  } catch (error: any) {
    if (
      error.message ===
      "No active employments found for the provided subordinates."
    ) {
      return res.status(400).json({
        status: "fail",
        message: error.message,
      });
    }
    console.error("Error in removeMember:", error);
    next(error);
  }
};

export const getManagerTeamMembers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { managerId } = req.params;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const existingManagers = await prisma.appUser.findMany({
      where: {
        role: { name: "Manager" },
        company_id: companyId,
        is_active: true,
        NOT: {
          role: {
            name: {
              in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
            },
          },
        },
      },
      include: {
        employee: {
          include: {
            employments: {
              where: { is_active: true },
              include: { jobTitle: true, department: true }, // Ensure these are valid relation names
              take: 1,
            },
          },
        },
      },
    });

    const managers = existingManagers.map((u: any) => {
      // Cast to any because types seem misaligned
      const emp = u.employee;
      const employment = emp?.employments?.[0];
      return {
        id: emp?.id,
        full_name: emp?.full_name,
        email: u.email,
        profile_picture: u.profile_picture,
        job_title: employment?.jobTitle?.title,
        department: employment?.department?.name,
      };
    });

    const [teamMembers, total] = await Promise.all([
      prisma.employee.findMany({
        where: {
          company_id: Number(companyId),
          employments: {
            some: {
              manager_id: managerId,
              is_active: true,
            },
          },
          appUsers: {
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
        },
        select: {
          id: true,
          full_name: true,
          gender: true,
          place_of_work: true,
          tin_number: true,
          pension_number: true,
          appUsers: {
            select: {
              email: true,
              onboarding_status: true,
              // profile_picture: true,
              role: {
                select: { name: true },
              },
            },
          },
          phones: {
            where: { is_primary: true },
            select: { phone_number: true },
          },
          employments: {
            where: { is_active: true },
            select: {
              employment_type: true,
              start_date: true,
              department: {
                select: { name: true },
              },
              jobTitle: {
                select: {
                  title: true,
                  level: true,
                },
              },
            },
          },
        },
      }),
      prisma.employee.count({
        where: {
          company_id: Number(companyId),
          employments: {
            some: {
              manager_id: managerId,
              is_active: true,
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        employees: teamMembers,
        pagination: {
          total,
        },
      },
    });
  } catch (error) {
    console.error("Error in getManagerTeamMembers:", error);
    next(error);
  }
};
