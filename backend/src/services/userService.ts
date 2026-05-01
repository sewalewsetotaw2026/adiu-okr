import { prisma } from "src/app";
import { OnboardingStatus, Prisma } from "@prisma/client";
import { hashPassword, createPasswordResetToken } from "src/utils/auth";
import { sendActivationEmail, sendEmail } from "src/services/emailService";
import { getOnboardingApprovedEmailHtml } from "src/utils/emailTemplates";
import { initializeLeaveBalancesForEmployee } from "src/utils/leaveUtils";
import {
  isSuperAdminRole,
  SUPERADMIN_VARIANTS,
  RoleNames,
} from "src/utils/roleConstants";
import crypto from "crypto";

export class UserService {
  static async createUser(
    companyId: number,
    data: {
      email: string;
      role_id?: number;
      role?: string;
      employee_id?: string;
      employee?: {
        // Simplified employee data
        employeeId?: string; // Add this field
        fullName: string;
        // Employment data
        employment?: {
          departmentId?: number | string; // Can be ID or Name
          jobTitleId?: number | string; // Can be ID or Name
          jobLevel?: string; // Explicit Job Level
          managerId?: string;
          employmentType?: string;
          startDate?: string;
          // Compensation
          grossSalary?: number;
          basicSalary?: number;
        };
      };
      allowances?: Array<{
        allowance_type_id: number | string;
        amount: number;
        currency?: string;
      }>;
    },
  ) {
    let { employee_id, email, role_id, role, employee, allowances } = data;

    const normalizedEmail = data.email.toLowerCase();

    // 1. Basic Salary Consistency Verification (only when both provided)
    if (data.employee?.employment) {
      const { grossSalary, basicSalary } = data.employee.employment;
      if (
        grossSalary !== undefined &&
        basicSalary !== undefined &&
        !Number.isNaN(Number(grossSalary)) &&
        !Number.isNaN(Number(basicSalary)) &&
        Number(basicSalary) > Number(grossSalary)
      ) {
        throw new Error(
          `Inconsistent salary: Basic salary (${basicSalary}) cannot exceed Gross salary (${grossSalary})`,
        );
      }
    }

    let retryCount = 0;
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    // 0. Compensation Validation (only when both salaries are provided)
    if (employee?.employment) {
      const { grossSalary, basicSalary } = employee.employment;
      if (
        grossSalary !== undefined &&
        basicSalary !== undefined &&
        !Number.isNaN(Number(grossSalary)) &&
        !Number.isNaN(Number(basicSalary))
      ) {
        const totalAllowances = (allowances || []).reduce(
          (sum, a) => sum + Number(a.amount),
          0,
        );
        const calculatedGross = Number(basicSalary) + totalAllowances;

        // Allow for small floating point differences
        if (Math.abs(calculatedGross - Number(grossSalary)) > 0.01) {
          throw new Error(
            `Compensation mismatch: Basic Salary (${basicSalary}) + Allowances (${totalAllowances}) = ${calculatedGross}, but Gross Salary provided is ${grossSalary}`,
          );
        }
      }
    }

    // 1. Resolve Role
    let resolvedRoleId = role_id;
    if (!resolvedRoleId && role) {
      const roleRecord = await prisma.appRole.findFirst({
        where: {
          company_id: companyId,
          name: { equals: role, mode: "insensitive" },
        },
      });
      if (roleRecord) resolvedRoleId = roleRecord.id;
    }

    if (!resolvedRoleId) {
      throw new Error("Invalid role specified");
    }

    // Check for Super Admin restriction
    const roleRecord = await prisma.appRole.findUnique({
      where: { id: resolvedRoleId },
    });

    if (
      roleRecord &&
      isSuperAdminRole(roleRecord.name as any) &&
      (SUPERADMIN_VARIANTS as any).includes(roleRecord.name)
    ) {
      const existingSuperAdmin = await prisma.appUser.findFirst({
        where: {
          company_id: companyId,
          role: {
            name: { in: SUPERADMIN_VARIANTS as any, mode: "insensitive" },
          },
        },
      });
      if (existingSuperAdmin) {
        throw new Error("Super Admin already exists for this company");
      }
    }

    // 2. Check if user exists
    const existingUser = await prisma.appUser.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new Error("Email already in use");
    }

    const userProvidedEmployeeId = Boolean(employee_id || employee?.employeeId);

    const parseEmpNumber = (id?: string | null): number | null => {
      if (!id || !id.startsWith("EMP-")) return null;
      const parts = id.split("-");
      if (parts.length !== 2) return null;
      const n = parseInt(parts[1]);
      return Number.isNaN(n) ? null : n;
    };

    const getNextEmployeeNumber = async (): Promise<number> => {
      const [lastEmployee, lastUserWithEmployeeId] = await Promise.all([
        prisma.employee.findFirst({
          where: {
            company_id: companyId,
            id: { startsWith: "EMP-" },
          },
          orderBy: { id: "desc" },
          select: { id: true },
        }),
        prisma.appUser.findFirst({
          where: {
            company_id: companyId,
            employee_id: { startsWith: "EMP-" },
          },
          orderBy: { employee_id: "desc" },
          select: { employee_id: true },
        }),
      ]);

      const lastEmployeeNumber = parseEmpNumber(lastEmployee?.id);
      const lastUserNumber = parseEmpNumber(
        lastUserWithEmployeeId?.employee_id,
      );
      const maxUsed = Math.max(lastEmployeeNumber ?? 0, lastUserNumber ?? 0);
      return maxUsed + 1;
    };

    const formatEmployeeId = (n: number) => `EMP-${String(n).padStart(4, "0")}`;

    // 3. Determine desired Employee ID
    let desiredEmployeeId: string | undefined =
      employee_id || employee?.employeeId;
    let nextEmployeeNumber: number | null = null;
    if (!desiredEmployeeId) {
      nextEmployeeNumber = await getNextEmployeeNumber();
      desiredEmployeeId = formatEmployeeId(nextEmployeeNumber);
      if (employee) employee.employeeId = desiredEmployeeId;
    }

    // Default password for newly created employees/users
    const hashedPassword = await hashPassword("password123");

    // Generate password reset token
    const { resetToken, passwordResetToken } = createPasswordResetToken();
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const isRetriableAutoEmployeeIdConflict = (err: any): boolean => {
      const message = String(err?.message || "");
      return (
        message.includes("already exists") ||
        message.includes("already assigned") ||
        message.includes("belongs to another company")
      );
    };

    const maxAttempts = userProvidedEmployeeId ? 1 : 50;
    let createdEmployee: any = null;
    let createdEmployment: any = null;
    let newUser: any = null;
    let finalEmployeeId: string | undefined = desiredEmployeeId;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (!userProvidedEmployeeId && nextEmployeeNumber !== null) {
        finalEmployeeId = formatEmployeeId(nextEmployeeNumber + attempt);
        if (employee) employee.employeeId = finalEmployeeId;
      }

      try {
        const result = await prisma.$transaction(
          async (tx) => {
            let txEmployee: any = null;
            let txEmployment: { id: number; is_active: boolean | null } | null =
              null;

            // Resolve Dynamic Fields (Department, JobTitle, Allowances)
            let departmentId: number | null = null;
            let jobTitleId: number | null = null;
            let resolvedJobTitleName = "Employee";
            let resolvedAllowancesList: Array<{
              name: string;
              amount: number;
            }> = [];

            if (employee && employee.employment) {
              const empData = employee.employment;

              // Resolve Department
              if (
                typeof empData.departmentId === "string" &&
                isNaN(Number(empData.departmentId))
              ) {
                // It's a name, create or find
                const deptName = empData.departmentId;
                const dept = await tx.department.upsert({
                  where: {
                    company_id_name: { company_id: companyId, name: deptName },
                  },
                  update: {},
                  create: { company_id: companyId, name: deptName },
                });
                departmentId = dept.id;
              } else if (empData.departmentId) {
                departmentId = Number(empData.departmentId);
              }

              // Resolve Job Title

              // ... inside transaction ...

              // Resolve Job Title
              if (
                typeof empData.jobTitleId === "string" &&
                isNaN(Number(empData.jobTitleId))
              ) {
                resolvedJobTitleName = empData.jobTitleId;
                const jobTitleName = empData.jobTitleId;
                // Avoid upsert due to nullable 'level' unique key type issues
                const existingJob = await tx.jobTitle.findFirst({
                  where: {
                    company_id: companyId,
                    title: jobTitleName,
                    level: null,
                  },
                });
                if (existingJob) {
                  jobTitleId = existingJob.id;
                } else {
                  const newJob = await tx.jobTitle.create({
                    data: {
                      company_id: companyId,
                      title: jobTitleName,
                      level: null,
                    },
                  });

                  // ALSO: Ensure this level (if any) exists in JobLevel table
                  // Though here level is null, we stick to the pattern if it ever changes.
                  jobTitleId = newJob.id;
                }
              } else if (empData.jobTitleId) {
                jobTitleId = Number(empData.jobTitleId);
                // Fetch name for email
                const job = await tx.jobTitle.findUnique({
                  where: { id: jobTitleId },
                });
                if (job) {
                  resolvedJobTitleName = job.title;

                  // 2b. If explicit Job Level is provided, ensure we link to the Title+Level variation
                  if (empData.jobLevel && empData.jobLevel !== job.level) {
                    // Ensure JobLevel entry exists
                    await tx.jobLevel.upsert({
                      where: {
                        company_id_name: {
                          company_id: companyId,
                          name: empData.jobLevel,
                        },
                      },
                      update: {},
                      create: {
                        company_id: companyId,
                        name: empData.jobLevel,
                      },
                    });

                    // Check if the specific Title+Level combination exists
                    const specificJob = await tx.jobTitle.findFirst({
                      where: {
                        company_id: companyId,
                        title: job.title,
                        level: empData.jobLevel,
                      },
                    });

                    if (specificJob) {
                      jobTitleId = specificJob.id;
                    } else {
                      // Create the specific variation
                      const newSpecificJob = await tx.jobTitle.create({
                        data: {
                          company_id: companyId,
                          title: job.title,
                          level: empData.jobLevel,
                        },
                      });
                      jobTitleId = newSpecificJob.id;
                    }
                  }
                }
              }
            }

            // Create Employee
            if (finalEmployeeId) {
              // ... existing employee check ...
              const existingEmp = await tx.employee.findUnique({
                where: { id: finalEmployeeId },
                select: { id: true, company_id: true, full_name: true },
              });

              if (employee) {
                if (existingEmp) {
                  throw new Error(
                    `Employee ID ${finalEmployeeId} already exists`,
                  );
                }

                txEmployee = await tx.employee.create({
                  data: {
                    id: finalEmployeeId,
                    company_id: companyId,
                    full_name: employee.fullName,
                    gender: null,
                    place_of_work: "Head Office",
                  },
                });

                // Create Employment
                resolvedAllowancesList = [];

                if (employee.employment) {
                  const empData = employee.employment;

                  // Validate Manager if linked
                  if (empData.managerId) {
                    const managerExists = await tx.employee.findUnique({
                      where: { id: empData.managerId },
                    });
                    if (!managerExists) {
                      empData.managerId = undefined;
                    }
                  }

                  // Ensure only one active employment record
                  await tx.employment.updateMany({
                    where: {
                      company_id: companyId,
                      employee_id: finalEmployeeId!,
                      is_active: true,
                    },
                    data: { is_active: false },
                  });

                  const createdEmployment = await tx.employment.create({
                    data: {
                      employee_id: finalEmployeeId!,
                      company_id: companyId,
                      employment_type: empData.employmentType || "Full Time",
                      start_date: empData.startDate
                        ? new Date(empData.startDate)
                        : new Date(),
                      gross_salary:
                        empData.grossSalary === undefined
                          ? null
                          : empData.grossSalary,
                      basic_salary:
                        empData.basicSalary === undefined
                          ? null
                          : empData.basicSalary,
                      department_id: departmentId,
                      job_title_id: jobTitleId,
                      manager_id: empData.managerId || null,
                      is_active: true,
                    },
                    select: {
                      id: true,
                      is_active: true,
                    },
                  });

                  txEmployment = createdEmployment;

                  // Handle Allowances
                  if (allowances && allowances.length > 0) {
                    const formattedAllowances = [];
                    for (const a of allowances) {
                      let typeId = 0;
                      let typeName = "";

                      if (
                        typeof a.allowance_type_id === "string" &&
                        isNaN(Number(a.allowance_type_id))
                      ) {
                        typeName = a.allowance_type_id;
                        const newType = await tx.allowanceType.upsert({
                          where: { name: typeName },
                          update: {},
                          create: {
                            name: typeName,
                            description: "Auto-created during onboarding",
                          },
                        });
                        typeId = newType.id;
                      } else {
                        typeId = Number(a.allowance_type_id);
                        const type = await tx.allowanceType.findUnique({
                          where: { id: typeId },
                        });
                        typeName = type?.name || "Allowance";
                      }

                      resolvedAllowancesList.push({
                        name: typeName,
                        amount: a.amount,
                      });

                      formattedAllowances.push({
                        employment_id: createdEmployment.id,
                        allowance_type_id: typeId,
                        amount: a.amount,
                        currency: a.currency || "ETB",
                        effective_date: new Date(),
                      });
                    }

                    if (formattedAllowances.length > 0) {
                      await tx.employeeAllowance.createMany({
                        data: formattedAllowances,
                      });
                    }
                  }
                }
              } else {
                // ... fallback logic if needed
                if (!existingEmp) {
                  txEmployee = await tx.employee.create({
                    data: {
                      id: finalEmployeeId,
                      company_id: companyId,
                      full_name: finalEmployeeId,
                    },
                  });
                } else {
                  txEmployee = existingEmp;
                }
              }
            }

            // ... user creation ...
            const txUser = await tx.appUser.create({
              data: {
                company_id: companyId,
                employee_id: finalEmployeeId,
                email: normalizedEmail,
                password_hash: hashedPassword,
                role_id: resolvedRoleId,
                onboarding_status: OnboardingStatus.IN_PROGRESS,
                is_active: true,
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

            await tx.passwordReset.create({
              data: {
                user_id: txUser.id,
                token_hash: passwordResetToken,
                expires_at: tokenExpiresAt,
              },
            });

            return {
              user: txUser,
              employee: txEmployee,
              employment: txEmployment,
              jobTitleName: resolvedJobTitleName, // Return resolved data
              allowanceList: resolvedAllowancesList,
              employmentData: data.employee?.employment,
            };
          },
          { maxWait: 10000, timeout: 20000 },
        );

        newUser = result.user;
        createdEmployee = result.employee;
        createdEmployment = result.employment;

        // 6. Send Welcome / Offer Email
        const setupUrl = `${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/setup-account/${resetToken}`;

        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: {
            name: true,
            logo_url: true,
            primary_color: true,
            secondary_color: true,
          },
        });
        const companyName =
          company?.name || "Kacha Digital Financial Service S.C";

        // Format start date
        const startDateStr = result.employmentData?.startDate
          ? new Date(result.employmentData.startDate).toDateString()
          : new Date().toDateString();

        const offerDetails = result.employmentData
          ? {
              jobTitle: result.jobTitleName || "Employee",
              department: "Department", // Should ideally be resolved
              employmentType:
                result.employmentData.employmentType || "Full Time",
              startDate: startDateStr,
              grossSalary: String(result.employmentData.grossSalary || 0),
              basicSalary: String(result.employmentData.basicSalary || 0),
              allowances: (result.allowanceList || []).map((a) => ({
                name: a.name,
                amount: String(a.amount),
              })),
            }
          : undefined;

        void sendActivationEmail(
          normalizedEmail,
          resetToken,
          offerDetails,
          createdEmployee?.full_name || "Employee",
          companyName,
          company?.logo_url || undefined,
          company?.primary_color || undefined,
          company?.secondary_color || undefined,
        );

        break;
      } catch (err: any) {
        if (!userProvidedEmployeeId && isRetriableAutoEmployeeIdConflict(err)) {
          continue;
        }
        if (
          !userProvidedEmployeeId &&
          err instanceof Prisma.PrismaClientKnownRequestError
        ) {
          if (err.code === "P2002") {
            continue;
          }
        }
        throw err;
      }
    }

    if (!newUser) {
      throw new Error("Unable to generate a unique employee ID. Please retry.");
    }

    return {
      user: newUser,
      employee: createdEmployee,
      employment: createdEmployment,
    };
  }

  static async getPendingUsers(companyId: number) {
    const users = await prisma.appUser.findMany({
      where: {
        company_id: companyId,
        onboarding_status: {
          in: [OnboardingStatus.IN_PROGRESS],
        },
      },
      orderBy: { created_at: "desc" },
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
        employee: {
          include: {
            addresses: true,
            phones: true,
            educations: {
              include: {
                educationLevel: true,
                fieldOfStudy: true,
                institution: true,
              },
            },
            employmentHistories: {
              include: {
                jobTitle: true,
              },
            },
            licensesAndCertifications: true,
            // @ts-ignore: Prisma client type generation issue, verified working at runtime
            documents: true,
            employments: {
              include: {
                department: true,
                jobTitle: true,
                manager: {
                  select: {
                    id: true,
                    full_name: true,
                  },
                },
              },
            },
          },
        },
        role: {
          select: { id: true, name: true },
        },
      },
    });

    return users.map((u) => {
      if (!u.employee) return u;

      const employee = u.employee;

      return {
        ...u,
        employee: {
          ...employee,
          educations: employee.educations.map((e) => ({
            id: e.id,
            level: e.educationLevel?.name ?? null,
            fieldOfStudy: e.fieldOfStudy?.name ?? null,
            institution: e.institution?.name ?? null,
            programType: e.program_type,
            hasCostSharing: e.has_cost_sharing ?? false,
            costSharingDocument: e.cost_sharing_document_urls || [],
            startDate: e.start_date,
            endDate: e.end_date,
            isCurrent: e.is_current ?? false,
            isVerified: e.is_verified ?? false,
          })),
          employmentHistories: employee.employmentHistories.map((h) => ({
            id: h.id,
            employee_id: h.employee_id,
            previousCompanyName: h.previous_company_name,
            jobTitle: h.jobTitle?.title ?? null,
            previousLevel: h.previous_level ?? null,
            departmentName: h.department_name ?? null,
            startDate: h.start_date,
            endDate: h.end_date,
            isVerified: h.is_verified ?? false,
            notes: h.notes ?? null,
          })),
        },
      };
    });
  }

  static async getPendingApprovalUsers(companyId: number) {
    const users = await prisma.appUser.findMany({
      where: {
        company_id: companyId,
        onboarding_status: OnboardingStatus.PENDING_APPROVAL,
      },
      orderBy: { created_at: "desc" },
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
        employee: {
          include: {
            addresses: true,
            phones: true,
            educations: {
              include: {
                educationLevel: true,
                fieldOfStudy: true,
                institution: true,
              },
            },
            employmentHistories: {
              include: {
                jobTitle: true,
              },
            },
            licensesAndCertifications: true,
            // @ts-ignore: Prisma client type generation issue, verified working at runtime
            documents: true,
            employments: {
              include: {
                department: true,
                jobTitle: true,
                manager: {
                  select: {
                    id: true,
                    full_name: true,
                  },
                },
              },
            },
          },
        },
        role: {
          select: { id: true, name: true },
        },
      },
    });

    return users.map((u) => {
      if (!u.employee) return u;

      const employee = u.employee;

      return {
        ...u,
        employee: {
          ...employee,
          educations: employee.educations.map((e) => ({
            id: e.id,
            level: e.educationLevel?.name ?? null,
            fieldOfStudy: e.fieldOfStudy?.name ?? null,
            institution: e.institution?.name ?? null,
            programType: e.program_type,
            hasCostSharing: e.has_cost_sharing ?? false,
            costSharingDocument: e.cost_sharing_document_urls || [],
            startDate: e.start_date,
            endDate: e.end_date,
            isCurrent: e.is_current ?? false,
            isVerified: e.is_verified ?? false,
          })),
          employmentHistories: employee.employmentHistories.map((h) => ({
            id: h.id,
            employee_id: h.employee_id,
            previousCompanyName: h.previous_company_name,
            jobTitle: h.jobTitle?.title ?? null,
            previousLevel: h.previous_level ?? null,
            departmentName: h.department_name ?? null,
            startDate: h.start_date,
            endDate: h.end_date,
            isVerified: h.is_verified ?? false,
            notes: h.notes ?? null,
          })),
        },
      };
    });
  }

  static async approveUser(companyId: number, id: string | number) {
    const numericId = Number(id);
    const maybeUserId = Number.isInteger(numericId) ? numericId : null;

    const userRecord = await prisma.appUser.findFirst({
      where: {
        company_id: companyId,
        OR: [
          ...(maybeUserId !== null ? [{ id: maybeUserId }] : []),
          { employee_id: String(id) },
        ],
      },
      include: { employee: true },
    });

    if (!userRecord) {
      throw new Error("User not found");
    }

    if (!userRecord.employee_id) {
      throw new Error("User has no employee record to approve");
    }

    const updatedUser = await prisma.appUser.update({
      where: { id: userRecord.id },
      data: {
        onboarding_status: OnboardingStatus.COMPLETED,
        is_active: true,
      },
      include: {
        employee: true,
        role: { select: { id: true, name: true } },
      },
    });

    // Ensure leave balances exist immediately after approval
    if (updatedUser.employee_id) {
      void initializeLeaveBalancesForEmployee(
        companyId,
        updatedUser.employee_id,
      ).catch((err) => {
        console.error(
          "[LeaveBalances] Failed to initialize on approval:",
          (err as Error)?.message || err,
        );
      });
    }

    const isEmployee = updatedUser.role?.name === RoleNames.EMPLOYEE;
    const loginPath = isEmployee ? "/employee-login" : "/login";

    const loginUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }${loginPath}`;
    const employeeName = updatedUser.employee?.full_name || "Employee";

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        logo_url: true,
        primary_color: true,
        secondary_color: true,
      },
    });

    const activeEmployment = updatedUser.employee_id
      ? await prisma.employment.findFirst({
          where: {
            employee_id: updatedUser.employee_id,
            company_id: companyId,
            is_active: true,
          },
          select: { employment_type: true },
          orderBy: { start_date: "desc" },
        })
      : null;

    const employmentType = activeEmployment?.employment_type || undefined;

    void sendEmail({
      to: updatedUser.email,
      subject: "Your account has been approved",
      html: getOnboardingApprovedEmailHtml(
        employeeName,
        loginUrl,
        employmentType,
        company?.name || "Kacha Digital Financial Service S.C",
        company?.logo_url || undefined,
        company?.primary_color || undefined,
        company?.secondary_color || undefined,
      ),
    });

    return updatedUser;
  }

  static async updatePendingUser(
    companyId: number,
    userId: number,
    data: {
      full_name?: string;
      gender?: string;
      date_of_birth?: string;
      place_of_work?: string;
      tin_number?: string;
      pension_number?: string;
    },
  ) {
    const userRecord = await prisma.appUser.findFirst({
      where: { id: userId, company_id: companyId },
      include: { employee: true },
    });

    if (!userRecord) {
      throw new Error("User not found");
    }

    if (!userRecord.employee_id) {
      throw new Error("User has no employee record to update");
    }

    const updatedEmployee = await prisma.employee.update({
      where: {
        id_company_id: {
          id: userRecord.employee_id,
          company_id: companyId,
        },
      },
      data: {
        ...(data.full_name && { full_name: data.full_name }),
        ...(data.gender && { gender: data.gender }),
        ...(data.date_of_birth && {
          date_of_birth: new Date(data.date_of_birth),
        }),
        ...(data.place_of_work && { place_of_work: data.place_of_work }),
        ...(data.tin_number !== undefined && {
          tin_number: data.tin_number || null,
        }),
        ...(data.pension_number !== undefined && {
          pension_number: data.pension_number || null,
        }),
      },
    });

    await prisma.appUser.update({
      where: { id: userRecord.id },
      data: {
        onboarding_status: OnboardingStatus.IN_PROGRESS,
      },
    });

    return updatedEmployee;
  }
}
