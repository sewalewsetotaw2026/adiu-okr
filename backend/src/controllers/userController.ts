import { Request, Response, NextFunction } from "express";
import { OnboardingStatus } from "@prisma/client";
import { prisma } from "src/app";
import { hashPassword } from "src/utils/auth";
import { isSuperAdminRole, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";
import { sendEmail } from "src/utils/email";
import { UserService } from "src/services/userService";
import { getUserPermissionMatrix } from "src/utils/permissionUtils";
import { redisService } from "src/services/redisService";

export const countUsers = async (
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

    const count = await prisma.appUser.count({
      where: { company_id: companyId },
    });
    return res.status(200).json({
      status: "success",
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchAllUsers = async (
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

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filtering
    const roleId = req.query.role_id as string;
    const isActive = req.query.is_active as string;
    const search = req.query.search as string;

    const where: any = {
      company_id: companyId,
    };

    if (roleId) {
      where.role_id = parseInt(roleId);
    }

    if (isActive !== undefined) {
      where.is_active = isActive === "true";
    }

    if (search) {
      where.email = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Sorting
    const sortBy = (req.query.sortBy as string) || "created_at";
    const order = (req.query.order as string) || "desc";
    const orderBy = { [sortBy]: order };

    // Fetch users with count
    const [users, total] = await Promise.all([
      prisma.appUser.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          role_id: true,
          is_active: true,
          created_at: true,
          updated_at: true,
          employee: {
            select: {
              id: true,
              full_name: true,
              gender: true,
            },
          },
          role: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      }),
      prisma.appUser.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Users fetched successfully",
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const user = await prisma.appUser.findUnique({
      where: {
        company_id_employee_id: {
          company_id: companyId,
          employee_id: id,
        },
      },
      select: {
        id: true,
        email: true,
        role_id: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        employee: {
          select: {
            id: true,
            full_name: true,
            gender: true,
            date_of_birth: true,
            profile_picture_url: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            permissions: {
              include: {
                resource: true,
              },
            },
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            company_code: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "User fetched successfully",
      data: {
        user: {
          ...user,
          company_code: user.company?.company_code
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (
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

    const { email, role_id, role, employee_id } = req.body;

    const pick = <T = any>(
      ...values: Array<T | undefined | null>
    ): T | undefined => {
      for (const v of values) {
        if (v !== undefined && v !== null) return v as T;
      }
      return undefined;
    };

    // Accept a few common payload shapes from different frontends
    const rawEmployee = pick<any>(
      req.body?.employee,
      req.body?.employeeData,
      req.body?.employee_data
    );

    const rawEmployment = pick<any>(
      rawEmployee?.employment,
      rawEmployee?.employment_details,
      rawEmployee?.employmentDetails,
      req.body?.employment,
      req.body?.employment_details,
      req.body?.employmentDetails
    );

    const rawAllowances = pick<any>(
      req.body?.allowances,
      rawEmployee?.allowances,
      rawEmployment?.allowances
    );

    // Build allowances in the format expected by the service (ignore effective_date from frontend payload)
    const normalizedAllowances:
      | Array<{
        allowance_type_id: number | string;
        amount: number;
        currency?: string;
      }>
      | undefined = Array.isArray(rawAllowances)
        ? rawAllowances
          .filter(Boolean)
          .map((a: any) => {
            const allowance_type_id = pick<number | string>(
              a.allowance_type_id,
              a.allowanceTypeId,
              a.allowance_type?.id
            );
            const amount = Number(a.amount);
            const currency = pick<string>(a.currency);
            return { allowance_type_id, amount, currency };
          })
          .filter(
            (a) =>
              a.allowance_type_id !== undefined && Number.isFinite(a.amount)
          )
          .map((a) => ({
            allowance_type_id: a.allowance_type_id as number | string,
            amount: Number(a.amount),
            ...(a.currency ? { currency: a.currency } : {}),
          }))
        : undefined;

    // Build employee payload in the format expected by the service
    let normalizedEmployee:
      | {
        employeeId?: string;
        fullName: string;
        employment?: {
          departmentId?: number | string;
          jobTitleId?: number | string;
          jobLevel?: string;
          managerId?: string;
          employmentType?: string;
          startDate?: string;
          grossSalary?: number;
          basicSalary?: number;
        };
      }
      | undefined;

    if (rawEmployee) {
      const fullName = pick<string>(
        rawEmployee.fullName,
        rawEmployee.full_name,
        req.body?.fullName,
        req.body?.full_name
      );
      if (!fullName) {
        return res.status(400).json({
          status: "fail",
          message: "Please provide employee.fullName",
        });
      }

      normalizedEmployee = {
        employeeId: pick<string>(
          rawEmployee.employeeId,
          rawEmployee.employee_id,
          employee_id
        ),
        fullName,
        employment: rawEmployment
          ? {
            departmentId: pick<number | string>(
              rawEmployment.departmentId,
              rawEmployment.department_id
            ),
            jobTitleId: pick<number | string>(
              rawEmployment.jobTitleId,
              rawEmployment.job_title_id
            ),
            jobLevel: pick<string>(
              rawEmployment.jobLevel,
              rawEmployment.job_level,
              rawEmployment.level
            ),
            managerId: pick<string>(
              rawEmployment.managerId,
              rawEmployment.manager_id
            ),
            employmentType: pick<string>(
              rawEmployment.employmentType,
              rawEmployment.employment_type
            ),
            startDate: pick<string>(
              rawEmployment.startDate,
              rawEmployment.start_date
            ),
            grossSalary:
              rawEmployment.grossSalary === undefined &&
                rawEmployment.gross_salary === undefined
                ? undefined
                : Number(
                  pick<any>(
                    rawEmployment.grossSalary,
                    rawEmployment.gross_salary
                  )
                ),
            basicSalary:
              rawEmployment.basicSalary === undefined &&
                rawEmployment.basic_salary === undefined
                ? undefined
                : Number(
                  pick<any>(
                    rawEmployment.basicSalary,
                    rawEmployment.basic_salary
                  )
                ),
          }
          : undefined,
      };
    }

    // Validation
    if (!email || (!role_id && !role)) {
      return res.status(400).json({
        status: "fail",
        message:
          "Please provide all required fields: email, and either role_id (number) or role (string)",
      });
    }

    // If employee payload is provided, validate required employment fields when employment/allowances are present
    if (normalizedEmployee) {
      const employment = normalizedEmployee.employment;
      if (
        employment ||
        (normalizedAllowances && normalizedAllowances.length > 0)
      ) {
        if (!employment) {
          return res.status(400).json({
            status: "fail",
            message:
              "Please provide employee.employment when creating allowances or employment details",
          });
        }

        const missing: string[] = [];
        if (!employment.departmentId)
          missing.push("employee.employment.departmentId");
        if (!employment.jobTitleId)
          missing.push("employee.employment.jobTitleId");
        if (!employment.employmentType)
          missing.push("employee.employment.employmentType");
        if (!employment.startDate)
          missing.push("employee.employment.startDate");

        if (missing.length > 0) {
          return res.status(400).json({
            status: "fail",
            message: `Missing required fields: ${missing.join(", ")}`,
          });
        }
      }
    }

    const result = await UserService.createUser(companyId, {
      email,
      role_id,
      role,
      employee_id,
      employee: normalizedEmployee,
      allowances: normalizedAllowances,
    });

    const response: any = {
      status: "success",
      message:
        "User account created successfully. An email invitation has been sent.",
      data: {
        user: result.user,
      },
    };

    if (result.employee) {
      response.message =
        "User account and employee created successfully; welcome email will be sent if email is configured";
      response.data.employee_created = true;
      response.data.employee = { id: result.employee.id };
    }

    if ((result as any).employment) {
      response.data.employment = (result as any).employment;
    }

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(201).json(response);
  } catch (error: any) {
    const message = String(error?.message || "");

    if (
      error?.code === "P2002" ||
      message.includes("Email already in use") ||
      message.includes("already assigned to another user") ||
      message.includes("already exists")
    ) {
      return res.status(409).json({
        status: "fail",
        message: message || "Conflict",
      });
    }

    next(error);
  }
};

export const listPendingUsers = async (
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

    const pendingUsers = await UserService.getPendingUsers(companyId);

    return res.status(200).json({
      status: "success",
      data: { users: pendingUsers },
    });
  } catch (error) {
    next(error);
  }
};

export const listSubmittedUsers = async (
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

    const pendingApprovalUsers = await UserService.getPendingApprovalUsers(
      companyId
    );

    return res.status(200).json({
      status: "success",
      data: { users: pendingApprovalUsers },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id;
    const companyId = req.user?.company_id;

    if (!userId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "User session missing user_id or company_id",
      });
    }

    const user = await prisma.appUser.findFirst({
      where: { id: Number(userId), company_id: companyId },
      select: {
        id: true,
        company_id: true,
        employee_id: true,
        email: true,
        role_id: true,
        is_active: true,
        onboarding_status: true,
        created_at: true,
        updated_at: true,
        company: {
          select: {
            company_code: true,
            primary_color: true,
            secondary_color: true,
            logo_url: true
          }
        },
        role: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            company_id: true,
            full_name: true,
            gender: true,
            date_of_birth: true,
            tin_number: true,
            pension_number: true,
            place_of_work: true,
            profile_picture_url: true,
            signature_url: true,
            documents: true,
            created_at: true,
            updated_at: true,
            employments: {
              where: { is_active: true },
              select: {
                department_id: true,
                manager: {
                  select: { full_name: true },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    const primaryDeptId = user.employee?.employments?.[0]?.department_id || null;

    return res.status(200).json({
      status: "success",
      data: {
        user: {
          ...user,
          department_id: primaryDeptId,
          employee: user.employee ? {
            ...user.employee,
            signature_url: user.employee.signature_url || "",
            documents: user.employee.documents || {
              cv: [],
              certificates: [],
              photo: [],
              experienceLetters: [],
              taxForms: [],
              pensionForms: [],
              guarantee_letter: [],
              medical_certificate: [],
              national_id: [],
              police_certificate: [],
              attendance_logs: [],
            }
          } : null,
          company_code: (user as any).company?.company_code,
          company: (user as any).company,
          permissions: await getUserPermissionMatrix(user.role_id)
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id;
    const companyId = req.user?.company_id;

    if (!userId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "User session missing user_id or company_id",
      });
    }

    const {
      email,
      full_name,
      gender,
      date_of_birth,
      place_of_work,
      tin_number,
      pension_number,
    } = req.body;

    if (tin_number && !/^\d{10}$/.test(tin_number)) {
      return res.status(400).json({
        status: "fail",
        message: "TIN Number must be exactly 10 digits",
      });
    }

    const hasAnyUpdateField =
      email !== undefined ||
      full_name !== undefined ||
      gender !== undefined ||
      date_of_birth !== undefined ||
      place_of_work !== undefined ||
      tin_number !== undefined ||
      pension_number !== undefined;

    if (!hasAnyUpdateField) {
      return res.status(400).json({
        status: "fail",
        message: "No updatable fields provided",
      });
    }

    const userRecord = await prisma.appUser.findFirst({
      where: { id: Number(userId), company_id: companyId },
      include: { employee: true },
    });

    if (!userRecord) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim();
      if (!normalizedEmail) {
        return res.status(400).json({
          status: "fail",
          message: "Email cannot be empty",
        });
      }

      if (normalizedEmail !== userRecord.email) {
        const duplicateEmail = await prisma.appUser.findUnique({
          where: { email: normalizedEmail },
        });

        if (duplicateEmail) {
          return res.status(400).json({
            status: "fail",
            message: "Email is already in use by another user",
          });
        }

        await prisma.appUser.update({
          where: { id: userRecord.id },
          data: { email: normalizedEmail },
        });
      }
    }

    // Ensure an employee record exists (fallback behavior matches submitOnboarding)
    let employeeId = userRecord.employee_id;
    if (!employeeId) {
      const lastEmployee = await prisma.employee.findFirst({
        where: { company_id: companyId },
        orderBy: { created_at: "desc" },
      });

      let nextIdNumber = 1;
      if (lastEmployee && lastEmployee.id.startsWith("EMP-")) {
        const parts = lastEmployee.id.split("-");
        if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
          nextIdNumber = parseInt(parts[1]) + 1;
        }
      }
      employeeId = `EMP-${String(nextIdNumber).padStart(4, "0")}`;

      await prisma.appUser.update({
        where: { id: userRecord.id },
        data: { employee_id: employeeId },
      });
    }

    const updatedEmployee = await prisma.employee.upsert({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
      update: {
        ...(full_name !== undefined && { full_name }),
        ...(gender !== undefined && { gender }),
        ...(date_of_birth !== undefined && {
          date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        }),
        ...(place_of_work !== undefined && { place_of_work }),
        ...(tin_number !== undefined && { tin_number: tin_number || null }),
        ...(pension_number !== undefined && {
          pension_number: pension_number || null,
        }),
      },
      create: {
        id: employeeId,
        company_id: companyId,
        full_name: full_name ?? "Unknown",
        gender: gender ?? null,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        place_of_work: place_of_work ?? "Head Office",
        tin_number: tin_number || null,
        pension_number: pension_number || null,
      },
    });

    const updatedUser = await prisma.appUser.findFirst({
      where: { id: Number(userId), company_id: companyId },
      select: {
        id: true,
        company_id: true,
        employee_id: true,
        email: true,
        role_id: true,
        is_active: true,
        onboarding_status: true,
        created_at: true,
        updated_at: true,
        role: { select: { id: true, name: true } },
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    return res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        user: updatedUser,
        employee: updatedEmployee,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const submitOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.user_id;
    const companyId = req.user?.company_id;

    if (!userId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "User session missing user_id or company_id",
      });
    }

    const {
      full_name,
      gender,
      date_of_birth,
      place_of_work,
      tin_number,
      pension_number,
    } = req.body;

    if (!full_name || !gender || !date_of_birth) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide full_name, gender, and date_of_birth",
      });
    }

    if (tin_number && !/^\d{10}$/.test(tin_number)) {
      return res.status(400).json({
        status: "fail",
        message: "TIN Number must be exactly 10 digits",
      });
    }

    const userRecord = await prisma.appUser.findFirst({
      where: { id: Number(userId), company_id: companyId },
      include: { employee: true },
    });

    if (!userRecord) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Ensure an employee record exists
    let employeeId = userRecord.employee_id;
    if (!employeeId) {
      // generate a fallback employee ID
      const lastEmployee = await prisma.employee.findFirst({
        where: { company_id: companyId },
        orderBy: { created_at: "desc" },
      });

      let nextIdNumber = 1;
      if (lastEmployee && lastEmployee.id.startsWith("EMP-")) {
        const parts = lastEmployee.id.split("-");
        if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
          nextIdNumber = parseInt(parts[1]) + 1;
        }
      }

      employeeId = `EMP-${String(nextIdNumber).padStart(4, "0")}`;
    }

    // Upsert employee record
    const employee = await prisma.employee.upsert({
      where: {
        id_company_id: { id: employeeId, company_id: companyId },
      },
      update: {
        full_name,
        gender,
        date_of_birth: new Date(date_of_birth),
        place_of_work: place_of_work || "Head Office",
        tin_number: tin_number || null,
        pension_number: pension_number || null,
      },
      create: {
        id: employeeId,
        company_id: companyId,
        full_name,
        gender,
        date_of_birth: new Date(date_of_birth),
        place_of_work: place_of_work || "Head Office",
        tin_number: tin_number || null,
        pension_number: pension_number || null,
      },
    });

    await prisma.appUser.update({
      where: { id: userRecord.id },
      data: {
        employee_id: employee.id,
        onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    return res.status(200).json({
      status: "success",
      message: "Onboarding details submitted for review",
      data: {
        employee,
        onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const approvePendingUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const updatedUser = await UserService.approveUser(companyId, id);

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    return res.status(200).json({
      status: "success",
      message: "User approved and activated",
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePendingUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { tin_number } = req.body;
    if (tin_number && !/^\d{10}$/.test(tin_number)) {
      return res.status(400).json({
        status: "fail",
        message: "TIN Number must be exactly 10 digits",
      });
    }

    const updatedEmployee = await UserService.updatePendingUser(
      companyId,
      Number(id),
      req.body
    );

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    return res.status(200).json({
      status: "success",
      message: "Pending user details updated",
      data: { employee: updatedEmployee },
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { email, role_id, role, is_active } = req.body; // Accept role name as alternative

    // Check if user exists
    const existingUser = await prisma.appUser.findFirst({
      where: {
        id: parseInt(id),
        company_id: companyId,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Check for duplicate email if being updated
    if (email && email !== existingUser.email) {
      const duplicateEmail = await prisma.appUser.findUnique({
        where: { email },
      });

      if (duplicateEmail) {
        return res.status(400).json({
          status: "fail",
          message: "Email is already in use by another user",
        });
      }
    }

    // Resolve role: accept either role_id (number) or role (string name)
    let resolvedRoleId: number | null = null;
    let roleToCheck = null;

    if (role_id || role) {
      if (role_id) {
        // If role_id is provided, use it directly
        resolvedRoleId = parseInt(role_id);
        roleToCheck = await prisma.appRole.findFirst({
          where: {
            id: resolvedRoleId,
            company_id: companyId,
          },
        });
      } else if (role) {
        // If role name is provided, find the role by name
        roleToCheck = await prisma.appRole.findFirst({
          where: {
            name: { equals: role, mode: "insensitive" },
            company_id: companyId,
          },
        });

        if (roleToCheck) {
          resolvedRoleId = roleToCheck.id;
        }
      }

      if (!roleToCheck || !resolvedRoleId) {
        return res.status(404).json({
          status: "fail",
          message: role
            ? `Role "${role}" not found in this company`
            : "Role not found",
        });
      }

      // Enforce: Only one SuperAdmin can exist in the system
      if (isSuperAdminRole(roleToCheck.name)) {
        // Check if SuperAdmin already exists (and it's not the current user being updated)
        // Find all SuperAdmin roles (case-insensitive)
        const superAdminRoles = await prisma.appRole.findMany({
          where: {
            OR: SUPERADMIN_VARIANTS.map((variant) => ({
              name: { equals: variant, mode: "insensitive" },
            })),
          },
          select: { id: true },
        });

        if (superAdminRoles.length > 0) {
          const superAdminRoleIds = superAdminRoles.map((r) => r.id);
          const existingSuperAdmin = await prisma.appUser.findFirst({
            where: {
              role_id: { in: superAdminRoleIds },
              is_active: true,
              id: { not: parseInt(id) }, // Exclude the current user
            },
          });

          if (existingSuperAdmin) {
            return res.status(400).json({
              status: "fail",
              message:
                "Cannot assign SuperAdmin role: A SuperAdmin already exists in the system. There can only be one SuperAdmin.",
            });
          }
        }
      }
    }

    // Update user
    const updatedUser = await prisma.appUser.update({
      where: {
        id: parseInt(id),
      },
      data: {
        ...(email && { email }),
        ...(resolvedRoleId && { role_id: resolvedRoleId }),
        ...(is_active !== undefined && { is_active }),
      },
      select: {
        id: true,
        email: true,
        role_id: true,
        is_active: true,
        employee: {
          select: {
            id: true,
            full_name: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "User updated successfully",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Check if user exists
    const existingUser = await prisma.appUser.findFirst({
      where: {
        id: parseInt(id),
        company_id: companyId,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Prevent deleting own account
    if (existingUser.id === parseInt(req.user?.user_id || "0")) {
      return res.status(400).json({
        status: "fail",
        message: "Cannot delete your own user account",
      });
    }

    // Soft delete by setting is_active to false
    await prisma.appUser.update({
      where: {
        id: parseInt(id),
      },
      data: {
        is_active: false,
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "User deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide new_password",
      });
    }

    // Validate password strength
    if (new_password.length < 8) {
      return res.status(400).json({
        status: "fail",
        message: "Password must be at least 8 characters long",
      });
    }

    // Check if user exists
    const existingUser = await prisma.appUser.findFirst({
      where: {
        id: parseInt(id),
        company_id: companyId,
      },
    });

    if (!existingUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(new_password);

    // Update password
    await prisma.appUser.update({
      where: {
        id: parseInt(id),
      },
      data: {
        password_hash: hashedPassword,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};
/**
 * Search users specifically for role mapping
 * Returns top 5 by default or searches by name/email
 */
export const searchUsersForMapping = async (
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

    const { query } = req.query as { query?: string };

    const where: any = {
      company_id: companyId,
    };

    if (query) {
      where.OR = [
        { email: { contains: query, mode: "insensitive" } },
        {
          employee: {
            full_name: { contains: query, mode: "insensitive" }
          }
        }
      ];
    }

    const users = await prisma.appUser.findMany({
      where,
      take: query ? 20 : 5, // Return top 5 if no query, else 20
      select: {
        id: true,
        email: true,
        role: {
          select: {
            id: true,
            name: true,
          }
        },
        employee: {
          select: {
            id: true,
            full_name: true,
          }
        }
      },
      orderBy: {
        employee: {
          full_name: 'asc'
        }
      }
    });

    res.status(200).json({
      status: "success",
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};
