import { prisma } from "../app";
import { RoleNames, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";

/**
 * Manager Service
 * Handles manager-specific operations like team management
 */

/**
 * Check if an employee is a manager (has direct reports)
 */
export const isManager = async (
  employeeId: string,
  companyId: number
): Promise<boolean> => {
  try {
    // A user is a "manager" if they have direct reports
    const directReports = await prisma.employment.count({
      where: {
        manager_id: employeeId,
        company_id: companyId,
        is_active: true,
      },
    });

    return directReports > 0;
  } catch (error) {
    console.error("[ManagerService] Error checking if manager:", error);
    throw error;
  }
};

/**
 * Get team members for a manager (direct reports)
 */
export const getTeamMembers = async (
  managerId: string,
  companyId: number,
  recursive = false, // Added recursive flag
): Promise<any[]> => {
  try {
    let targetManagerIds = [managerId];

    if (recursive) {
      // Fetch all levels of subordinates
      const allSubordinateIds = await getAllSubordinateIds(managerId, companyId);
      targetManagerIds = [managerId, ...allSubordinateIds];
    }

    const teamMembers = await prisma.employment.findMany({
      where: {
        manager_id: { in: targetManagerIds },
        company_id: companyId,
        is_active: true,
        // Exclude the manager themselves from the subordinates list
        employee_id: { not: managerId },
        employee: {
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
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            profile_picture_url: true,
            gender: true,
            date_of_birth: true,
            place_of_work: true,
            phones: {
              where: { is_primary: true },
              take: 1,
            },
            appUsers: {
              select: { id: true, email: true },
              take: 1,
            },
          },
        },
        department: {
          select: {
            name: true,
          },
        },
        jobTitle: {
          select: {
            title: true,
            level: true,
          },
        },
      },
      orderBy: {
        employee: {
          full_name: "asc",
        },
      },
    });

    // Map email from appUsers to employee object
    return teamMembers.map((tm: any) => ({
      ...tm,
      employee: {
        ...tm.employee,
        id: tm.employee.id,
        user: tm.employee.appUsers?.[0] ? { id: tm.employee.appUsers[0].id } : null,
        email: tm.employee.appUsers?.[0]?.email || null,
        user_id: tm.employee.appUsers?.[0]?.id || null,
        appUsers: undefined, // Create clean response
      },
    }));
  } catch (error) {
    console.error("[ManagerService] Error getting team members:", error);
    throw error;
  }
};

/**
 * Helper to fetch all subordinate IDs recursively
 */
export async function getAllSubordinateIds(
  managerId: string,
  companyId: number,
  seen = new Set<string>(),
): Promise<string[]> {
  const directReports = await prisma.employment.findMany({
    where: {
      manager_id: managerId,
      company_id: companyId,
      is_active: true,
    },
    select: { employee_id: true },
  });

  const directIds = directReports
    .map((dr) => dr.employee_id)
    .filter((id) => !seen.has(id));

  let allIds = [...directIds];
  for (const id of directIds) {
    seen.add(id);
    const nested = await getAllSubordinateIds(id, companyId, seen);
    allIds = [...allIds, ...nested];
  }

  return Array.from(new Set(allIds));
}

/**
 * Get team member details (read-only)
 */
export const getTeamMemberDetails = async (
  managerId: string,
  employeeId: string,
  companyId: number
): Promise<any> => {
  try {
    // First verify this employee is actually a direct report
    const employment = await prisma.employment.findFirst({
      where: {
        employee_id: employeeId,
        manager_id: managerId,
        company_id: companyId,
        is_active: true,
      },
      include: {
        employee: {
          include: {
            phones: true,
            addresses: true,
            employments: {
              where: { is_active: true },
              include: {
                department: true,
                jobTitle: true,
              },
            },
          },
        },
        department: true,
        jobTitle: true,
      },
    });

    if (!employment) {
      throw new Error("Employee not found in your team");
    }

    return employment;
  } catch (error) {
    console.error("[ManagerService] Error getting team member details:", error);
    throw error;
  }
};

/**
 * Get team's leave applications
 */
export const getTeamLeaveApplications = async (
  managerId: string,
  companyId: number,
  filters: {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: "asc" | "desc";
    start_date?: string;
    end_date?: string;
  } = {}
): Promise<{ applications: any[]; total: number; page: number; totalPages: number }> => {
  try {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      company_id: companyId,
      employee: {
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
    };

    if (filters.status) {
      where.current_status = filters.status;
    }

    // Date filtering
    if (filters.start_date) {
      where.start_date = { gte: new Date(filters.start_date) };
    }
    if (filters.end_date) {
      where.end_date = { lte: new Date(filters.end_date) };
    }

    // Sorting
    let orderBy: any = { created_at: "desc" };

    if (filters.sortBy && filters.order) {
      if (filters.sortBy === "full_name") {
        orderBy = {
          employee: {
            full_name: filters.order
          }
        };
      } else if (filters.sortBy === "created_at") {
        orderBy = { created_at: filters.order };
      } else if (filters.sortBy === "start_date") {
        orderBy = { start_date: filters.order };
      }
    }

    const [applications, total] = await Promise.all([
      prisma.leaveApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              profile_picture_url: true,
              employments: {
                where: { is_active: true },
                select: {
                  department: { select: { name: true } },
                  jobTitle: { select: { title: true, level: true } },
                },
                take: 1,
              },
            },
          },
          leaveType: true,
          reliefOfficer: {
            select: {
              id: true,
              full_name: true,
            },
          },
          approvalLogs: {
            orderBy: { action_date: "desc" },
            include: {
              approver: {
                select: {
                  id: true,
                  full_name: true,
                },
              },
            },
          },
        },
      }),
      prisma.leaveApplication.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      applications,
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error("[ManagerService] Error getting team leave applications:", error);
    throw error;
  }
};

/**
 * Get team members on leave today
 */
export const getTeamOnLeaveToday = async (
  managerId: string,
  companyId: number,
  filters: {
    page?: number;
    limit?: number;
    search?: string;
    department_id?: string;
    job_title_id?: string;
    leave_type_id?: string;
    gender?: string;
    start_date?: string; // To inspect specific date if needed, default today
  } = {}
): Promise<{ employees: any[]; total: number; page: number; totalPages: number }> => {
  try {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If a specific date is requested for "On Leave", use that, else use today
    const targetDate = filters.start_date ? new Date(filters.start_date) : today;

    const where: any = {
      company_id: companyId,
      current_status: "APPROVED",
      start_date: { lte: targetDate },
      end_date: { gte: targetDate },
      employee: {
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
    };

    // Apply Search
    if (filters.search) {
      where.employee.OR = [
        { full_name: { contains: filters.search, mode: "insensitive" } },
        { employee_id: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Apply Filters
    if (filters.department_id) {
      // Need to ensure we filter specifically on the employment
      where.employee.employments = {
        some: {
          department_id: filters.department_id,
          is_active: true
        }
      };
    }

    if (filters.leave_type_id) {
      where.leave_type_id = parseInt(filters.leave_type_id);
    }

    const [employees, total] = await Promise.all([
      prisma.leaveApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          employee: { full_name: 'asc' }
        },
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              profile_picture_url: true,
              // photo is in EmployeeDocument, not Employee directly, so removing to fix lint
              employments: {
                where: { is_active: true },
                select: {
                  department: { select: { name: true } },
                  jobTitle: { select: { title: true } },
                },
                take: 1,
              },
            },
          },
          leaveType: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.leaveApplication.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Flatten logic for consistency
    const flattened = employees.map(app => ({
      ...app,
      // map to easier strcture if needed, but existing frontend uses raw structure mostly
      // Existing frontend expected: { employee: ..., leaveType: ... } 
      // The previous code returned `leaveApplication` objects, so this structure preserves that.
    }));

    return {
      employees: flattened,
      total,
      page,
      totalPages,
    };
  } catch (error) {
    console.error("[ManagerService] Error getting team on leave today:", error);
    throw error;
  }
};
