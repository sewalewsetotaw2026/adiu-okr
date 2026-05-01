import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";
import { RoleNames, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";
import { Resources, Scopes } from "src/utils/constants";
import { getCachedRolePermissionMatrix } from "src/utils/permissionUtils";

export const countDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const count = await prisma.department.count({
      where: {
        company_id: companyId,
      },
    });

    res.status(200).json({
      status: "success",
      data: {
        count,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { name } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide all required fields: name",
      });
    }

    // Verify Employee Exists
    let department = await prisma.department.findUnique({
      where: {
        company_id_name: {
          company_id: companyId,
          name: name,
        },
      },
    });

    if (department) {
      return res.status(409).json({
        status: "fail",
        message: "department already exists",
      });
    }

    // Generate Department Code
    const lastDepartment = await prisma.department.findFirst({
      where: { company_id: companyId },
      orderBy: { id: "desc" },
    });

    let newCode = "DEP-001";
    if (lastDepartment && lastDepartment.department_code) {
      const lastCodeNum = parseInt(
        lastDepartment.department_code.split("-")[1],
      );
      if (!isNaN(lastCodeNum)) {
        newCode = `DEP-${String(lastCodeNum + 1).padStart(3, "0")}`;
      }
    }

    department = await prisma.department.create({
      data: {
        company_id: companyId,
        name: name,
        department_code: newCode,
      },
    });

    // Invalidate Cache
    const patterns = [
      `company:${companyId}:employees:*`,
      `company:${companyId}:managers:*`,
      `company:${companyId}:teams:*`,
      `company:${companyId}:team_member:*`,
      `company:${companyId}:team_members_list:*`,
      `company:${companyId}:employees_search:*`,
      `company:${companyId}:analytics:*`,
    ];
    Promise.all(patterns.map((p) => redisService.delByPattern(p))).catch(
      console.error,
    );

    res.status(201).json({
      status: "success",
      message: "department created created successfully",
      data: {
        department,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDepartments = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const whereClause: any = { company_id: companyId };

    const [department, total] = await Promise.all([
      prisma.department.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          company_id: true,
          department_code: true,
          head_user_id: true,
          head: {
            select: {
              id: true,
              employee: {
                select: { full_name: true },
              },
            },
          },
        },

        orderBy: { id: "desc" },
      }),
      prisma.department.count({ where: whereClause }),
    ]);

    res.status(200).json({
      status: "success",
      results: department.length,
      data: {
        department,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;
    const { name } = req.body;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    if (!name) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide department name",
      });
    }

    const existing = await prisma.department.findFirst({
      where: { id: Number(id), company_id: companyId },
    });

    if (!existing) {
      return res.status(404).json({
        status: "fail",
        message: "Department not found",
      });
    }

    const department = await prisma.department.update({
      where: { id: existing.id },
      data: { name },
    });

    // Invalidate Cache
    const patterns = [
      `company:${companyId}:employees:*`,
      `company:${companyId}:managers:*`,
      `company:${companyId}:teams:*`,
      `company:${companyId}:team_member:*`,
      `company:${companyId}:team_members_list:*`,
      `company:${companyId}:employees_search:*`,
      `company:${companyId}:analytics:*`,
    ];
    Promise.all(patterns.map((p) => redisService.delByPattern(p))).catch(
      console.error,
    );

    res.status(200).json({
      status: "success",
      message: "Department updated successfully",
      data: { department },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const { id } = req.params;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const existing = await prisma.department.findFirst({
      where: { id: Number(id), company_id: companyId },
    });

    if (!existing) {
      return res.status(404).json({
        status: "fail",
        message: "Department not found",
      });
    }

    await prisma.department.delete({
      where: { id: existing.id },
    });

    // Invalidate Cache
    const patterns = [
      `company:${companyId}:employees:*`,
      `company:${companyId}:managers:*`,
      `company:${companyId}:teams:*`,
      `company:${companyId}:team_member:*`,
      `company:${companyId}:team_members_list:*`,
      `company:${companyId}:employees_search:*`,
      `company:${companyId}:analytics:*`,
    ];
    Promise.all(patterns.map((p) => redisService.delByPattern(p))).catch(
      console.error,
    );

    res.status(200).json({
      status: "success",
      message: "Department deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentTree = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user;
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    if (!user?.role_id) {
      return res.status(401).json({
        status: "fail",
        message: "User role not found in session",
      });
    }

    const requestedDepartmentIdRaw = req.query.department_id as
      | string
      | undefined;
    const parsedDepartmentId = requestedDepartmentIdRaw
      ? Number(requestedDepartmentIdRaw)
      : undefined;

    if (
      requestedDepartmentIdRaw !== undefined &&
      (parsedDepartmentId === undefined ||
        !Number.isInteger(parsedDepartmentId) ||
        parsedDepartmentId <= 0)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid department_id query parameter",
      });
    }
    const requestedDepartmentId = parsedDepartmentId;

    const matrix = await getCachedRolePermissionMatrix(user.role_id);
    const readScope = (
      matrix[Resources.DEPARTMENT]?.read || "n/a"
    ).toLowerCase();

    if (readScope === "n/a") {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to view department tree",
      });
    }

    // Product requirement: managers (team scope) can view all departments in this tree.
    const canViewAllDepartments =
      readScope === Scopes.ANY || readScope === Scopes.TEAM;

    // Fetch all active employees with their manager and job info
    const employeesWhere: any = {
      company_id: companyId,
      is_active: true,
      employee: {
        appUsers: {
          some: {
            onboarding_status: "COMPLETED",
            is_active: true,
          },
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

    let teamDepartmentId: number | null = null;

    if (requestedDepartmentId) {
      employeesWhere.department_id = requestedDepartmentId;
    } else if (readScope === Scopes.OWN && user.employee_id) {
      employeesWhere.employee_id = user.employee_id;
    }

    const employees = await prisma.employment.findMany({
      where: employeesWhere,
      select: {
        employee: {
          select: {
            id: true,
            full_name: true,
            profile_picture_url: true,
            gender: true,
          },
        },
        jobTitle: {
          select: { title: true },
        },
        department_id: true,
        manager_id: true,
      },
      // You might want to format this data for the frontend
    });

    const employeeDepartmentIds = Array.from(
      new Set(
        employees
          .map((emp) => emp.department_id)
          .filter((departmentId): departmentId is number => !!departmentId),
      ),
    );

    const departments = await prisma.department.findMany({
      where: {
        company_id: companyId,
        ...(canViewAllDepartments
          ? {}
          : {
            id: {
              in: requestedDepartmentId
                ? [requestedDepartmentId]
                : employeeDepartmentIds,
            },
          }),
      },
      select: {
        id: true,
        name: true,
        department_code: true,
        head_user_id: true,
        head: {
          select: {
            id: true,
            employee: {
              select: { full_name: true },
            },
          },
        },
      },

    });

    // Format for frontend (React Flow / Dagre friendly)
    // We return flat list; frontend builds the tree
    const flatData = employees.map((emp) => ({
      id: emp.employee.id,
      name: emp.employee.full_name,
      title: emp.jobTitle?.title || "No Title",
      department_id: emp.department_id,
      department_name:
        departments.find((d) => d.id === emp.department_id)?.name ||
        "Unassigned",
      manager_id: emp.manager_id,
      avatar: emp.employee.profile_picture_url,
      gender: emp.employee.gender,
    }));

    res.status(200).json({
      status: "success",
      data: {
        departments,
        employees: flatData,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const assignDepartmentHead = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const { id: departmentId } = req.params;
    const { head_user_id } = req.body;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    if (!head_user_id) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide head_user_id",
      });
    }

    // 1. Verify Department exists in company
    const department = await prisma.department.findFirst({
      where: { id: Number(departmentId), company_id: companyId },
    });

    if (!department) {
      return res.status(404).json({
        status: "fail",
        message: "Department not found",
      });
    }

    // 2. Verify User belongs to this department
    const user = await prisma.appUser.findFirst({
      where: { id: Number(head_user_id), company_id: companyId },
      include: {
        role: true,
        employee: {
          include: {
            employments: {
              where: { is_active: true },
            },
          },
        },
      },
    });

    if (!user || !user.employee) {
      return res.status(404).json({
        status: "fail",
        message: "User not found or has no employee profile",
      });
    }

    const isMember = user.employee.employments.some(
      (emp) => emp.department_id === Number(departmentId),
    );

    if (!isMember) {
      return res.status(400).json({
        status: "fail",
        message: "The selected user must be a member of this department.",
      });
    }

    // 3. Verify User is not already heading another department
    const existingHeading = await prisma.department.findFirst({
      where: { head_user_id: Number(head_user_id), id: { not: Number(departmentId) } },
    });

    if (existingHeading) {
      return res.status(400).json({
        status: "fail",
        message: `This user is already the head of the "${existingHeading.name}" department.`,
      });
    }

    // 4. Perform assignment and subordinate updates in a transaction
    const updatedDepartment = await prisma.$transaction(async (tx) => {
      // a. Promote user to Manager role if they are just an Employee
      const managerRole = await tx.appRole.findFirst({
        where: { name: "Manager" },
      });

      if (managerRole && user.role?.name === RoleNames.EMPLOYEE) {
        await tx.appUser.update({
          where: { id: user.id },
          data: { role_id: managerRole.id },
        });
      }

      // b. Update Department Head
      const dept = await tx.department.update({
        where: { id: Number(departmentId) },
        data: { head_user_id: Number(head_user_id) },
        include: {
          head: {
            select: {
              id: true,
              employee: {
                select: { id: true, full_name: true },
              },
            },
          },
        },
      });

      // c. Bulk update subordinates' manager_id
      // Assign everyone in this department to report to the new head
      if (dept.head?.employee?.id) {
        await tx.employment.updateMany({
          where: {
            department_id: Number(departmentId),
            company_id: companyId,
            is_active: true,
            employee_id: { not: dept.head.employee.id },
          },
          data: {
            manager_id: dept.head.employee.id,
          },
        });
      }

      return dept;
    });

    // Invalidate Cache rigorously
    const patterns = [
      `company:${companyId}:employees:*`,
      `company:${companyId}:managers:*`,
      `company:${companyId}:teams:*`,
      `company:${companyId}:analytics:*`,
      `company:${companyId}:team_member:*`,
      `company:${companyId}:team_members_list:*`,
      `company:${companyId}:employees_search:*`,
    ];
    Promise.all(patterns.map((p) => redisService.delByPattern(p))).catch(
      console.error,
    );

    res.status(200).json({
      status: "success",
      message: "Department head assigned and team structure updated successfully",
      data: { department: updatedDepartment },
    });
  } catch (error) {
    next(error);
  }
};

