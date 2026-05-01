import { Request, Response, NextFunction } from "express";
import { OnboardingStatus } from "@prisma/client";
import { prisma } from "src/app";
import { RoleNames, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";
import { initializeLeaveBalancesForEmployee } from "src/utils/leaveUtils";
import { sendEmail } from "src/utils/email";
import { getOnboardingApprovedEmailHtml } from "src/utils/emailTemplates";
import { fetchEducation } from "./educationController";
import { redisService } from "src/services/redisService";

const getProbationThresholdDate = (probationDays: number) => {
  const threshold = new Date();
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - probationDays);
  return threshold;
};

export const countEmployees = async (
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

    const count = await prisma.employee.count({
      where: {
        company_id: companyId,
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
    });
    return res.status(200).json({
      status: "success",
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

export const getTabCounts = async (
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch company settings
    const settings = await prisma.employeeSettings.findUnique({
      where: { company_id: companyId },
    });
    const probationDays = settings?.probation_period_days ?? 90;
    const probationDateThreshold = getProbationThresholdDate(probationDays);

    const [active, pending, inprogress, inactive, probation] = await Promise.all([
      prisma.employee.count({
        where: {
          company_id: companyId,
          appUsers: {
            some: { onboarding_status: "COMPLETED", is_active: true },
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
        },
      }),
      prisma.employee.count({
        where: {
          company_id: companyId,
          appUsers: {
            some: { onboarding_status: "PENDING_APPROVAL" },
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
        },
      }),
      prisma.employee.count({
        where: {
          company_id: companyId,
          appUsers: {
            some: { onboarding_status: "IN_PROGRESS" },
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
        },
      }),
      prisma.employee.count({
        where: {
          company_id: companyId,
          appUsers: {
            some: { onboarding_status: "COMPLETED", is_active: false },
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
        },
      }),
      prisma.employee.count({
        where: {
          company_id: companyId,
          appUsers: {
            some: { onboarding_status: "COMPLETED", is_active: true },
            none: {
              role: {
                name: {
                  in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
                },
              },
            },
          },
          employments: {
            some: {
              is_active: true,
              OR: [
                { probation_end_date: { gte: today } },
                {
                  AND: [
                    { probation_end_date: null },
                    { start_date: { gte: probationDateThreshold } },
                  ],
                },
              ],
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      status: "success",
      data: {
        active,
        pending,
        inprogress,
        inactive,
        probation,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchAllEmployee = async (
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

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filter parameters
    const search = req.query.search as string;
    const departmentId = req.query.department_id as string;
    const jobTitleId = req.query.job_title_id as string;
    const employmentType = req.query.employment_type as string;
    const status = req.query.status as string; // active, inactive, probation (Legacy)
    const onboardingStatus = req.query.onboarding_status as string; // COMPLETED, PENDING_APPROVAL, IN_PROGRESS
    const isActiveParam = req.query.is_active as string; // employment is_active filter
    const gender = req.query.gender as string;
    const hireDateFrom = req.query.hire_date_from as string;
    const hireDateTo = req.query.hire_date_to as string;
    const department = req.query.department as string; // department name filter
    const jobLevel = req.query.job_level as string;
    const probationStatus = req.query.probation_status as string; // active, completed, none
    const sortBy = req.query.sort_by as string;
    const costSharingStatus = req.query.cost_sharing_status as string;

    // Build where clause
    const where: any = {
      company_id: companyId,
    };

    // Search filter (name, employee_id, tin_number)
    if (search) {
      where.OR = [
        { full_name: { contains: search, mode: "insensitive" } },
        { id: { contains: search, mode: "insensitive" } },
        { tin_number: { contains: search, mode: "insensitive" } },
        {
          appUsers: {
            some: { email: { contains: search, mode: "insensitive" } },
          },
        },
        {
          phones: {
            some: { phone_number: { contains: search, mode: "insensitive" } },
          },
        },
        {
          employments: {
            some: {
              is_active: true,
              OR: [
                {
                  department: {
                    name: { contains: search, mode: "insensitive" },
                  },
                },
                {
                  jobTitle: {
                    title: { contains: search, mode: "insensitive" },
                  },
                },
              ],
            },
          },
        },
      ];
    }

    // Gender filter
    if (gender) {
      where.gender = gender;
    }

    // Build appUsers filter conditions (for tab navigation)
    const appUsersConditions: any = {};

    // Onboarding Status Filter (All Employees, Pending Approval, In Progress)
    if (onboardingStatus) {
      const statusArray = onboardingStatus.split(",").map((s) => s.trim());
      appUsersConditions.onboarding_status =
        statusArray.length === 1 ? statusArray[0] : { in: statusArray };
    }

    // is_active Filter (for employment status)
    if (isActiveParam !== undefined) {
      const isActive = isActiveParam === "true";
      appUsersConditions.is_active = isActive;
    }

    // Exclude Admin and SuperAdmin roles at the collection level unless explicitly requested
    const adminExclusion = {
      role: {
        name: {
          in: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
        },
      },
    };

    const includeAdmins = req.query.include_admins === "true";

    // Apply combined appUsers filter if any conditions exist
    if (Object.keys(appUsersConditions).length > 0) {
      where.appUsers = {
        some: appUsersConditions,
        ...(includeAdmins ? {} : { none: adminExclusion }),
      };
    } else if (!includeAdmins) {
      where.appUsers = {
        none: adminExclusion,
      };
    }

    // Cost Sharing Status filter
    if (costSharingStatus) {
      const status = costSharingStatus as string;
      // We filter by payment_status enum
      where.educations = {
        some: {
          costSharing: {
            some: {
              payment_status: status,
            },
          },
        },
      };
    }

    // Employment-based filters require nested filtering
    const employmentFilters: any = {
      is_active: true,
    };

    // Department filter (by ID)
    if (departmentId) {
      employmentFilters.department_id = parseInt(departmentId);
    }

    // Job title filter (by ID)
    if (jobTitleId) {
      employmentFilters.job_title_id = parseInt(jobTitleId);
    }

    // Employment type filter
    if (employmentType) {
      employmentFilters.employment_type = employmentType;
    }

    // Department name filter (merged here)
    if (department) {
      employmentFilters.department = {
        name: { contains: department, mode: "insensitive" },
      };
    }

    // Job Level filter (merged here)
    if (jobLevel) {
      employmentFilters.jobTitle = {
        level: { contains: jobLevel, mode: "insensitive" },
      };
    }

    // Hire date range filter
    if (hireDateFrom || hireDateTo) {
      employmentFilters.start_date = {};
      if (hireDateFrom) {
        employmentFilters.start_date.gte = new Date(hireDateFrom);
      }
      if (hireDateTo) {
        employmentFilters.start_date.lte = new Date(hireDateTo);
      }
    }

    // Fetch company settings
    const settings = await prisma.employeeSettings.findUnique({
      where: { company_id: companyId },
    });
    const probationDays = settings?.probation_period_days ?? 90;
    const probationThresholdDate = getProbationThresholdDate(probationDays);

    // Probation status filter
    if (probationStatus) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (probationStatus === "active") {
        employmentFilters.OR = [
          { probation_end_date: { gte: today } },
          {
            AND: [
              { probation_end_date: null },
              { start_date: { gte: probationThresholdDate } },
              { newCareerEvents: { none: {} } },
            ],
          },
        ];
      } else if (probationStatus === "completed") {
        employmentFilters.OR = [
          { probation_end_date: { lt: today } },
          {
            AND: [
              { probation_end_date: null },
              {
                OR: [
                  { start_date: { lt: probationThresholdDate } },
                  { newCareerEvents: { some: {} } },
                ],
              },
            ],
          },
        ];
      } else if (probationStatus === "none") {
        employmentFilters.probation_end_date = null;
        employmentFilters.OR = [
          { start_date: { lt: probationThresholdDate } },
          { newCareerEvents: { some: {} } },
        ];
      }
    }

    // Apply employment filters if any were specified
    if (
      departmentId ||
      jobTitleId ||
      employmentType ||
      hireDateFrom ||
      hireDateTo ||
      department ||
      jobLevel ||
      probationStatus
    ) {
      where.employments = {
        some: {
          ...employmentFilters,
          ...(where.employments?.some || {}),
        },
      };
    }

    // Sorting
    let orderBy: any = { created_at: "desc" }; // Default sort
    if (sortBy) {
      if (sortBy === "name_asc") {
        orderBy = { full_name: "asc" };
      } else if (sortBy === "name_desc") {
        orderBy = { full_name: "desc" };
      } else if (sortBy === "newest") {
        orderBy = { created_at: "desc" };
      } else if (sortBy === "oldest") {
        orderBy = { created_at: "asc" };
      }
    }

    // Fetch employees with count
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          addresses: true,
          phones: true,
          appUsers: {
            select: {
              id: true,
              email: true,
              onboarding_status: true,
            },
            take: 1,
          },
          employments: {
            where: { is_active: true },
            orderBy: { created_at: "desc" },
            include: {
              department: true,
              jobTitle: true,
              manager: {
                select: {
                  id: true,
                  full_name: true,
                  employments: {
                    where: { is_active: true },
                    select: {
                      jobTitle: { select: { title: true } },
                    },
                    take: 1,
                  },
                },
              },
              allowances: {
                include: {
                  allowanceType: true,
                },
              },
            },
          },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // transform data
    const employeesData = employees.map((emp) => {
      // ... same mapping logic as before ...
      const activeEmployment = emp.employments[0];
      const manager = activeEmployment?.manager;
      const managerJobTitle =
        manager?.employments?.[0]?.jobTitle?.title || "N/A";
      const appUser = emp.appUsers[0];

      return {
        id: emp.id,
        employee_id: emp.id,
        full_name: emp.full_name,
        fullName: emp.full_name,
        firstName: emp.full_name.split(" ")[0],
        lastName: emp.full_name.split(" ").slice(1).join(" "),
        app_user_id: appUser?.id || null,
        appUserId: appUser?.id || null,
        user: appUser ? { id: appUser.id } : null,
        email: appUser?.email || "",
        onboarding_status: appUser?.onboarding_status || "N/A",
        phone: emp.phones.find((p) => p.is_primary)?.phone_number,
        phones: emp.phones, // Include raw phones for filtering
        addresses: emp.addresses,
        department: activeEmployment?.department?.name,
        job_title: activeEmployment?.jobTitle?.title,
        jobTitle: activeEmployment?.jobTitle?.title,
        status: activeEmployment ? "Active" : "Inactive",
        manager: manager
          ? {
              id: manager.id,
              full_name: manager.full_name,
              jobTitle: managerJobTitle,
            }
          : null,
        managerId: manager?.id,
        joinedDate: activeEmployment?.start_date,
        start_date: activeEmployment?.start_date,
        probation_end_date:
          activeEmployment?.probation_end_date ||
          (activeEmployment?.start_date
            ? new Date(
                new Date(activeEmployment.start_date).getTime() +
                  probationDays * 24 * 60 * 60 * 1000,
              )
            : null),
        tin_number: emp.tin_number,
        pension_number: emp.pension_number,
        profile_picture: emp.profile_picture_url || null,
        signature_url: emp.signature_url || null,
      };
    });

    // Apply permission filtering to each employee in the list
    const { filterEmployeeSensitiveData } = require("../utils/permissionUtils");
    const filteredEmployees = await Promise.all(
      employeesData.map((emp) => filterEmployeeSensitiveData(req.user, emp)),
    );

    // Filter out System Admin and clean up
    const finalFiltered = filteredEmployees
      .filter((e) => e.id !== "EMP-ADMIN")
      .map((emp) => {
        // After filtering, we can remove the raw 'phones' array used for check if it wasn't there before
        // Actually, employee list often just needs the primary phone string.
        return {
          ...emp,
          phone:
            emp.phones?.find((p: any) => p.is_primary)?.phone_number ||
            emp.phone,
        };
      });

    res.status(200).json({
      status: "success",
      message: "Employees fetched successfully",
      data: {
        employees: finalFiltered,
        pagination: {
          total:
            finalFiltered.length === filteredEmployees.length
              ? total
              : total - 1,
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

export const fetchEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: id,
          company_id: companyId,
        },
      },
      include: {
        addresses: true,
        phones: true,
        employments: {
          include: {
            department: true,
            jobTitle: true,
            manager: {
              select: {
                id: true,
                full_name: true,
                employments: {
                  where: { is_active: true },
                  select: {
                    jobTitle: { select: { title: true } },
                  },
                  take: 1,
                },
              },
            },
            allowances: {
              include: {
                allowanceType: true,
              },
            },
          },
          orderBy: {
            created_at: "desc",
          },
        },
        educations: {
          include: {
            educationLevel: true,
            fieldOfStudy: true,
            institution: true,
            costSharing: true,
          },
        },
        licensesAndCertifications: true,
        emergencyContacts: true,
        financialDetails: {
          include: {
            bank: true,
          },
        },
        documents: true,
        employmentHistories: {
          include: {
            jobTitle: true,
          },
          orderBy: {
            start_date: "desc",
          },
        },
        careerEvents: {
          include: {
            previousJobTitle: true,
            newJobTitle: true,
            previousEmployment: {
              include: { department: true },
            },
            newEmployment: {
              include: { department: true },
            },
          },
          orderBy: {
            event_date: "desc",
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // Fetch company settings
    const settings = await prisma.employeeSettings.findUnique({
      where: { company_id: companyId },
    });
    const probationDays = settings?.probation_period_days ?? 90;

    const activeEmployment =
      employee.employments?.find((e: any) => e.is_active) ||
      employee.employments?.[0];
    const startDate = activeEmployment?.start_date;
    const probationEndDate =
      activeEmployment?.probation_end_date ||
      (startDate
        ? new Date(
            new Date(startDate).getTime() + probationDays * 24 * 60 * 60 * 1000,
          )
        : null);

    const employeeForFrontend = {
      ...(employee as any),
      start_date: startDate,
      probation_end_date: probationEndDate,
      profile_picture: employee.profile_picture_url || null,
      signature_url: employee.signature_url || "",
      documents: employee.documents || {
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
      },
      educations: (employee as any).educations.map((e: any) => ({
        id: e.id,
        level: e.educationLevel?.name ?? null,
        fieldOfStudy: e.fieldOfStudy?.name ?? null,
        institution: e.institution?.name ?? null,
        institutionCategory: e.institution?.category ?? "Private",
        programType: e.program_type,
        hasCostSharing: e.has_cost_sharing ?? false,
        costSharingDocument: e.cost_sharing_document_urls || [],
        costSharingDocumentUrl:
          e.cost_sharing_document_urls &&
          e.cost_sharing_document_urls.length > 0
            ? e.cost_sharing_document_urls[0]
            : null,
        costSharings: e.costSharing.map((cs: any) => ({
          ...cs,
          issuing_institution:
            cs.issuing_institution || e.institution?.name || null,
        })),
        startDate: e.start_date,
        endDate: e.end_date,
        isCurrent: e.is_current ?? false,
        isVerified: e.is_verified ?? false,
        documentUrl: e.document_urls?.[0] ?? null,
        documentUrls: e.document_urls ?? [], // Ensure array if key exists
      })),
      employments: (employee as any).employments.map((emp: any) => {
        const manager = emp.manager;
        const managerJobTitle =
          manager?.employments?.[0]?.jobTitle?.title || "N/A";

        return {
          ...emp,
          probation_end_date:
            emp.probation_end_date ||
            (emp.start_date
              ? new Date(
                  new Date(emp.start_date).getTime() +
                    probationDays * 24 * 60 * 60 * 1000,
                )
              : null),
          manager: manager
            ? {
                id: manager.id,
                full_name: manager.full_name,
                jobTitle: managerJobTitle,
              }
            : null,
        };
      }),
      emergencyContacts: (employee as any).emergencyContacts,
      financialDetails: (employee as any).financialDetails.map((fd: any) => ({
        ...fd,
        bankName: fd.bank?.name,
      })),
      employmentHistories:
        (employee as any).employmentHistories?.map((h: any) => ({
          id: h.id,
          employee_id: h.employee_id,
          previous_company_name: h.previous_company_name,
          previous_job_title:
            h.previous_job_title_text || h.jobTitle?.title || null,
          jobTitle: h.jobTitle
            ? { title: h.jobTitle.title, level: h.jobTitle.level }
            : null,
          previous_level: h.previous_level,
          department_name: h.department_name,
          employment_type: h.employment_type,
          start_date: h.start_date,
          end_date: h.end_date,
          is_current: h.is_current,
          document_urls: h.document_urls || [],
          notes: h.notes,
        })) || [],
      careerEvents:
        (employee as any).careerEvents?.map((ce: any) => ({
          id: ce.id,
          event_type: ce.event_type,
          event_date: ce.event_date,
          effective_date: ce.effective_date,
          previousJobTitle: ce.previousJobTitle
            ? {
                title: ce.previousJobTitle.title,
                level: ce.previousJobTitle.level,
              }
            : null,
          newJobTitle: ce.newJobTitle
            ? { title: ce.newJobTitle.title, level: ce.newJobTitle.level }
            : null,
          previousEmployment: ce.previousEmployment,
          newEmployment: ce.newEmployment,
          department_changed: ce.department_changed,
          previous_salary: ce.previous_salary,
          new_salary: ce.new_salary,
          justification: ce.justification,
          notes: ce.notes,
          document_urls: ce.document_urls || [],
        })) || [],
    };

    const { filterEmployeeSensitiveData } = require("../utils/permissionUtils");
    const filteredEmployee = await filterEmployeeSensitiveData(
      req.user,
      employeeForFrontend,
    );

    res.status(200).json({
      status: "success",
      message: "Employee fetched successfully",
      data: { employee: filteredEmployee },
    });
  } catch (error) {
    next(error);
  }
};

export const createEmployee = async (
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

    const {
      employee_id,
      full_name,
      gender,
      date_of_birth,
      tin_number,
      pension_number,
      place_of_work,
      // Employment Details
      department_id,
      job_title_id,
      employment_type,
      start_date,
      salary, // gross salary
    } = req.body;

    let finalEmployeeId = employee_id;

    if (!finalEmployeeId) {
      // Get company code
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { company_code: true },
      });

      const companyPrefix = company?.company_code || "EMP";

      // Auto-generate employee_id with company prefix
      // Format: {COMPANY_CODE}-EMP-{SEQUENCE}
      // e.g. KACHA-EMP-1
      const idPrefix = `${companyPrefix}-EMP-`;

      const lastEmployee = await prisma.employee.findFirst({
        where: {
          company_id: companyId,
          id: { startsWith: idPrefix },
        },
        orderBy: { created_at: "desc" },
        select: { id: true },
      });

      let nextId = 1;
      if (lastEmployee) {
        // Extract the number part from the end
        const parts = lastEmployee.id.split("-EMP-");
        if (parts.length === 2) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num)) {
            nextId = num + 1;
          }
        }
      }
      finalEmployeeId = `${idPrefix}${nextId}`;
    }

    // validation
    if (!finalEmployeeId || !full_name || !date_of_birth || !gender) {
      return res.status(400).json({
        status: "fail",
        message:
          "Please provide all required fields: full_name, date_of_birth, gender",
      });
    }

    const {
      validateFullName,
      validateIsNumeric,
    } = require("src/utils/validation");
    if (!validateFullName(full_name)) {
      return res.status(400).json({
        status: "fail",
        message:
          "Full Name must contain exactly three words (First Middle Last)",
      });
    }

    if (tin_number && !validateIsNumeric(tin_number)) {
      return res.status(400).json({
        status: "fail",
        message: "TIN Number must be numeric",
      });
    }

    // check for duplicates (using the generated or provided ID)
    const existingEmployee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: finalEmployeeId,
          company_id: companyId,
        },
      },
    });

    if (existingEmployee) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID already exists in this company",
      });
    }

    // check for duplicate TIN if provided
    if (tin_number) {
      const existingTin = await prisma.employee.findFirst({
        where: {
          tin_number,
          company_id: companyId,
        },
      });

      if (existingTin) {
        return res.status(400).json({
          status: "fail",
          message: "TIN number already exists in this company",
        });
      }
    }

    // Transaction: Create Employee + Employment
    const newEmployee = await prisma.$transaction(async (tx) => {
      // 1. Create Employee
      const emp = await tx.employee.create({
        data: {
          id: finalEmployeeId,
          company_id: companyId,
          full_name,
          gender,
          date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
          tin_number,
          pension_number,
          place_of_work,
        },
      });

      // 2. Create Initial Employment Record if details provided
      if (
        department_id ||
        job_title_id ||
        employment_type ||
        start_date ||
        salary
      ) {
        await tx.employment.create({
          data: {
            employee_id: emp.id,
            company_id: companyId,
            department_id: department_id ? parseInt(department_id) : null,
            job_title_id: job_title_id ? parseInt(job_title_id) : null,
            employment_type: employment_type || "Full Time",
            start_date: start_date ? new Date(start_date) : new Date(),
            gross_salary: salary ? parseFloat(salary) : null,
            basic_salary: salary ? parseFloat(salary) : null, // Assuming basic = gross initially for simplicity, or 0
            is_active: true,
          },
        });
      }

      return emp;
    });

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
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

    res.status(201).json({
      status: "success",
      message: "Employee created successfully",
      data: {
        employee: newEmployee,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    const {
      full_name,
      gender,
      date_of_birth,
      tin_number,
      pension_number,
      place_of_work,
      signature_url,
    } = req.body;

    const {
      validateFullName,
      validateIsNumeric,
    } = require("src/utils/validation");
    if (full_name && !validateFullName(full_name)) {
      return res.status(400).json({
        status: "fail",
        message:
          "Full Name must contain exactly three words (First Middle Last)",
      });
    }

    if (tin_number && !validateIsNumeric(tin_number)) {
      return res.status(400).json({
        status: "fail",
        message: "TIN Number must be numeric",
      });
    }

    // check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: id,
          company_id: companyId,
        },
      },
    });

    if (!existingEmployee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // check for duplicate TIN if being updated
    if (tin_number && tin_number !== existingEmployee.tin_number) {
      const existingTin = await prisma.employee.findFirst({
        where: {
          tin_number,
          company_id: companyId,
        },
      });

      if (existingTin) {
        return res.status(400).json({
          status: "fail",
          message: "TIN number already exists in this company",
        });
      }
    }

    // update employee
    const updatedEmployee = await prisma.employee.update({
      where: {
        id_company_id: {
          id: id,
          company_id: companyId,
        },
      },
      data: {
        ...(full_name && { full_name }),
        ...(gender && { gender }),
        ...(date_of_birth !== undefined && {
          date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        }),
        ...(tin_number !== undefined && { tin_number }),
        ...(pension_number !== undefined && { pension_number }),
        ...(place_of_work !== undefined && { place_of_work }),
        ...(signature_url !== undefined && { signature_url }),
      },
      include: {
        addresses: true,
        phones: true,
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
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
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
      message: "Employee updated successfully",
      data: {
        employee: updatedEmployee,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { hard_delete } = req.query;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: id,
          company_id: companyId,
        },
      },
      include: {
        employments: true,
        appUsers: true,
      },
    });

    if (!existingEmployee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    if (hard_delete === "true") {
      // PERFORM HARD DELETE (Permanent Data Removal)
      await prisma.$transaction(async (tx) => {
        // 1. Delete associated records that have 'Restrict' constraint in schema
        // We delete them in reverse dependency order

        // Delete AppUsers (and their password resets)
        await tx.passwordReset.deleteMany({
          where: { user: { employee_id: id, company_id: companyId } },
        });
        await tx.appUser.deleteMany({
          where: { employee_id: id, company_id: companyId },
        });

        // Delete Personal Info
        await tx.employeeAddress.deleteMany({
          where: { employee_id: id },
        });
        await tx.employeePhone.deleteMany({
          where: { employee_id: id },
        });
        await tx.emergencyContact.deleteMany({
          where: { employee_id: id, company_id: companyId },
        });
        await tx.financialDetail.deleteMany({
          where: { employee_id: id, company_id: companyId },
        });

        // Delete Career/Work Info
        await tx.employeeLicensesAndCertifications.deleteMany({
          where: { employee_id: id },
        });

        // Delete Employment History (separate from active employments)
        await tx.employmentHistory.deleteMany({
          where: { employee_id: id },
        });

        // Delete Cost Sharing & Education
        await tx.employeeCostSharing.deleteMany({
          where: { employee_id: id },
        });
        await tx.employeeEducation.deleteMany({
          where: { employee_id: id },
        });

        // Delete Leave info (History & Balances)
        // Note: Cascade might handle some, but let's be explicit for safety
        await tx.leaveApprovalLog.deleteMany({
          where: {
            OR: [
              { application: { employee_id: id, company_id: companyId } },
              { approver_id: id },
            ],
          },
        });
        await tx.leaveRecall.deleteMany({
          where: {
            OR: [
              {
                leaveApplication: { employee_id: id, company_id: companyId },
              },
              { recalled_by: id },
            ],
          },
        });
        await tx.leaveApplication.deleteMany({
          where: { employee_id: id, company_id: companyId },
        });
        await tx.leaveBalance.deleteMany({
          where: { employee_id: id, company_id: companyId },
        });
        await tx.leaveCashOut.deleteMany({
          where: { employee_id: id, company_id: companyId },
        });

        // Delete Resignations
        await tx.employeeResignation.deleteMany({
          where: { employee_id: id },
        });

        // Delete Career Events
        await tx.employeeCareerEvent.deleteMany({
          where: { employee_id: id },
        });

        // Update events where this employee is approver/recorder
        // This is necessary if onDelete: SetNull is not fully supported by the DB or if we want to be explicit
        await tx.employeeCareerEvent.updateMany({
          where: { approved_by: id },
          data: { approved_by: null },
        });
        await tx.employeeCareerEvent.updateMany({
          where: { recorded_by: id },
          data: { recorded_by: null },
        });

        // Delete Document Signer Configs where this employee is the signer
        // This is critical if there's a restrict constraint on DocumentSignerConfig
        await tx.documentSignerConfig.deleteMany({
          where: { signer_employee_id: id },
        });

        // Delete Employments and associated Allowances
        const employmentIds = existingEmployee.employments.map((e) => e.id);
        await tx.employeeAllowance.deleteMany({
          where: { employment_id: { in: employmentIds } },
        });
        await tx.employment.deleteMany({
          where: { employee_id: id, company_id: companyId },
        });

        // 2. Finally delete the employee record
        await tx.employee.delete({
          where: {
            id_company_id: {
              id: id,
              company_id: companyId,
            },
          },
        });
      });

      // Invalidate Cache
      redisService
        .delByPattern(`company:${companyId}:employees:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${companyId}:managers:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${companyId}:teams:*`)
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
        message: "Employee and all related records deleted forever",
      });
    } else {
      // PERFORM SOFT DELETE (Deactivation)
      // We set is_active: false on AppUser and all Employments

      await prisma.$transaction(async (tx) => {
        // Deactivate AppUser
        await tx.appUser.updateMany({
          where: { employee_id: id, company_id: companyId },
          data: { is_active: false },
        });

        // Deactivate all employments
        await tx.employment.updateMany({
          where: { employee_id: id, company_id: companyId },
          data: { is_active: false },
        });
      });

      // Invalidate Cache
      redisService
        .delByPattern(`company:${companyId}:employees:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${companyId}:managers:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${companyId}:teams:*`)
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
        message: "Employee deactivated successfully",
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getPendingEmployees = async (
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

    const pendingUsers = await prisma.appUser.findMany({
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
            documents: true,
            employments: {
              where: { is_active: true },
              orderBy: { created_at: "desc" },
              include: {
                department: true,
                jobTitle: true,
                manager: {
                  select: {
                    id: true,
                    full_name: true,
                    employments: {
                      where: { is_active: true },
                      select: {
                        jobTitle: { select: { title: true } },
                      },
                      take: 1,
                    },
                  },
                },
                allowances: {
                  include: {
                    allowanceType: true,
                  },
                },
              },
            },
          },
        },
        role: true,
      },
    });

    const pendingUsersForFrontend = pendingUsers.map((u) => {
      if (!u.employee) return u;
      const employee = u.employee;
      const activeEmployment = employee.employments[0]; // Assuming most recent
      const manager = activeEmployment?.manager;
      const managerJobTitle =
        manager?.employments?.[0]?.jobTitle?.title || "N/A";

      return {
        ...u,
        employee: {
          ...employee,
          manager: manager
            ? {
                id: manager.id,
                full_name: manager.full_name,
                jobTitle: managerJobTitle,
              }
            : null,
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

    res.status(200).json({
      status: "success",
      data: {
        pendingEmployees: pendingUsersForFrontend,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSubmittedEmployees = async (
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

    const submittedUsers = await prisma.appUser.findMany({
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
            documents: true,
            employments: {
              where: { is_active: true },
              orderBy: { created_at: "desc" },
              include: {
                department: true,
                jobTitle: true,
                manager: {
                  select: {
                    id: true,
                    full_name: true,
                    employments: {
                      where: { is_active: true },
                      select: {
                        jobTitle: { select: { title: true } },
                      },
                      take: 1,
                    },
                  },
                },
                allowances: {
                  include: {
                    allowanceType: true,
                  },
                },
              },
            },
          },
        },
        role: true,
      },
    });

    // The user didn't complain about single fetch, but let's fix the lists first.
    // Focusing on getSubmittedEmployees and getPendingEmployees which return lists.

    // ... getSubmittedEmployees ...

    const submittedUsersForFrontend = submittedUsers.map((u) => {
      if (!u.employee) return u;
      const employee = u.employee;
      const activeEmployment = employee.employments[0]; // Assuming most recent
      const manager = activeEmployment?.manager;
      const managerJobTitle =
        manager?.employments?.[0]?.jobTitle?.title || "N/A";

      return {
        ...u,
        employee: {
          ...employee,
          manager: manager
            ? {
                id: manager.id,
                full_name: manager.full_name,
                jobTitle: managerJobTitle,
              }
            : null,
          educations: employee.educations.map((e: any) => ({
            id: e.id,
            level: e.educationLevel?.name ?? null,
            fieldOfStudy: e.fieldOfStudy?.name ?? null,
            institution: e.institution?.name ?? null,
            institutionCategory: e.institution?.category ?? "Private",
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

    res.status(200).json({
      status: "success",
      data: {
        submittedEmployees: submittedUsersForFrontend,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCompletedEmployees = async (
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

    const completedUsers = await prisma.appUser.findMany({
      where: {
        company_id: companyId,
        onboarding_status: OnboardingStatus.COMPLETED,
        is_active: true,
        role: {
          name: {
            notIn: [RoleNames.ADMIN, ...SUPERADMIN_VARIANTS],
          },
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
            documents: true,
            employments: {
              where: { is_active: true },
              orderBy: { created_at: "desc" },
              include: {
                department: true,
                jobTitle: true,
                manager: {
                  select: {
                    id: true,
                    full_name: true,
                    employments: {
                      where: { is_active: true },
                      select: {
                        jobTitle: { select: { title: true } },
                      },
                      take: 1,
                    },
                  },
                },
                allowances: {
                  include: {
                    allowanceType: true,
                  },
                },
              },
            },
          },
        },
        role: true,
      },
    });

    const completedUsersForFrontend = completedUsers.map((u) => {
      if (!u.employee) return u;
      const employee = u.employee;
      const activeEmployment = employee.employments[0]; // Assuming most recent
      const manager = activeEmployment?.manager;
      const managerJobTitle =
        manager?.employments?.[0]?.jobTitle?.title || "N/A";

      return {
        ...u,
        employee: {
          ...employee,
          manager: manager
            ? {
                id: manager.id,
                full_name: manager.full_name,
                jobTitle: managerJobTitle,
              }
            : null,
          educations: employee.educations.map((e: any) => ({
            id: e.id,
            level: e.educationLevel?.name ?? null,
            fieldOfStudy: e.fieldOfStudy?.name ?? null,
            institution: e.institution?.name ?? null,
            institutionCategory: e.institution?.category ?? "Private",
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

    res.status(200).json({
      status: "success",
      data: {
        completedEmployees: completedUsersForFrontend,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const approveEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params; // user id (numeric) or employee_id (string)
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const numericId = Number(id);
    let user = Number.isFinite(numericId)
      ? await prisma.appUser.findFirst({
          where: { id: numericId, company_id: companyId },
        })
      : null;

    if (!user) {
      user = await prisma.appUser.findFirst({
        where: {
          company_id: companyId,
          employee_id: id,
        },
      });
    }

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    if (user.onboarding_status !== OnboardingStatus.PENDING_APPROVAL) {
      return res.status(400).json({
        status: "fail",
        message: "User is not in submitted status",
      });
    }

    const approvedUser = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.appUser.update({
        where: { id: user.id },
        data: {
          onboarding_status: OnboardingStatus.COMPLETED,
          is_active: true,
        },
        include: { employee: true },
      });

      if (updatedUser.employee_id) {
        await tx.employment.updateMany({
          where: {
            employee_id: updatedUser.employee_id,
            company_id: companyId,
          },
          data: { is_active: true },
        });

        await initializeLeaveBalancesForEmployee(
          companyId,
          updatedUser.employee_id,
          new Date(),
          tx,
        );
      }

      return updatedUser;
    });

    if (approvedUser.employee_id) {
      const loginUrl = `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/login`;
      const employeeName = approvedUser.employee?.full_name || "Employee";

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          primary_color: true,
          secondary_color: true,
          logo_url: true,
        },
      });

      const activeEmployment = await prisma.employment.findFirst({
        where: {
          employee_id: approvedUser.employee_id,
          company_id: companyId,
          is_active: true,
        },
        select: { employment_type: true },
        orderBy: { start_date: "desc" },
      });

      const employmentType = activeEmployment?.employment_type || undefined;

      const emailResult = await sendEmail({
        to: approvedUser.email,
        subject: `Your account has been approved - ${company?.name || "Kacha HRIS"}`,
        html: getOnboardingApprovedEmailHtml(
          employeeName,
          loginUrl,
          employmentType,
          company?.name || undefined,
          company?.logo_url || undefined,
          company?.primary_color || undefined,
          company?.secondary_color || undefined,
        ),
      });

      if (!emailResult?.success) {
        console.error(
          "[Email] Approval email failed:",
          emailResult?.error || "Unknown error",
        );
      }
    }

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
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
      message: "Employee approved successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const approveOnboarding = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    // Find the AppUser associated with this employee
    const appUser = await prisma.appUser.findFirst({
      where: { employee_id: id, company_id: companyId },
    });

    if (!appUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found for this employee",
      });
    }

    if (appUser.onboarding_status === OnboardingStatus.COMPLETED) {
      return res.status(400).json({
        status: "fail",
        message: "Onboarding is already completed",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.appUser.update({
        where: { id: appUser.id },
        data: {
          onboarding_status: OnboardingStatus.COMPLETED,
          is_active: true,
        },
        include: { employee: true },
      });

      await tx.employment.updateMany({
        where: {
          employee_id: id,
          company_id: companyId,
        },
        data: { is_active: true },
      });

      await initializeLeaveBalancesForEmployee(companyId, id, new Date(), tx);

      return updatedUser;
    });

    const loginUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/login`;
    const employeeName = result.employee?.full_name || "Employee";

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        primary_color: true,
        secondary_color: true,
        logo_url: true,
      },
    });

    const activeEmployment = await prisma.employment.findFirst({
      where: {
        employee_id: id,
        company_id: companyId,
        is_active: true,
      },
      select: { employment_type: true },
      orderBy: { start_date: "desc" },
    });

    const employmentType = activeEmployment?.employment_type || undefined;

    const emailResult = await sendEmail({
      to: result.email,
      subject: `Your account has been approved - ${company?.name || "Kacha HRIS"}`,
      html: getOnboardingApprovedEmailHtml(
        employeeName,
        loginUrl,
        employmentType,
        company?.name || undefined,
        company?.logo_url || undefined,
        company?.primary_color || undefined,
        company?.secondary_color || undefined,
      ),
    });

    if (!emailResult?.success) {
      console.error(
        "[Email] Approval email failed:",
        emailResult?.error || "Unknown error",
      );
    }

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
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
    redisService
      .delByPattern(`company:${companyId}:leave_stats:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:leave_list:*`)
      .catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Onboarding approved and leave balances initialized",
      data: {
        user: result,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employee_id = (req as any).user?.employee_id;

    if (!employee_id) {
      return res.status(404).json({
        status: "fail",
        message: "Employee profile not found for this user",
      });
    }

    // Reuse the fetchEmployee logic but forced to own ID
    req.params.id = employee_id;
    return fetchEmployeeDetail(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const assignManager = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params; // Employee ID to assign manager to
    const { manager_id } = req.body;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    if (!manager_id) {
      return res.status(400).json({
        status: "fail",
        message: "Manager ID is required",
      });
    }

    // Verify manager exists and is in the same company
    const manager = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: manager_id,
          company_id: companyId,
        },
      },
    });

    if (!manager) {
      return res.status(404).json({
        status: "fail",
        message: "Manager not found in this company",
      });
    }

    // Update the active employment record
    const activeEmployment = await prisma.employment.findFirst({
      where: {
        employee_id: id,
        company_id: companyId,
        is_active: true,
      },
    });

    if (!activeEmployment) {
      return res.status(404).json({
        status: "fail",
        message: "Active employment record not found for this employee",
      });
    }

    const updatedEmployment = await prisma.employment.update({
      where: { id: activeEmployment.id },
      data: { manager_id },
    });

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:employees:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:managers:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:teams:*`)
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
      message: "Manager assigned successfully",
      data: {
        employment: updatedEmployment,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchEmployeeDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: id,
          company_id: companyId,
        },
      },
      include: {
        addresses: true,
        phones: true,
        appUsers: {
          select: {
            email: true,
            onboarding_status: true,
          },
        },
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
            allowances: {
              include: {
                allowanceType: true,
              },
            },
          },
          orderBy: {
            created_at: "desc",
          },
        },
        educations: {
          include: {
            educationLevel: true,
            fieldOfStudy: true,
            institution: true,
            costSharing: true,
          },
        },
        licensesAndCertifications: true,
        documents: true,
        emergencyContacts: true,
        financialDetails: {
          include: {
            bank: true,
          },
        },
        employmentHistories: {
          include: {
            jobTitle: true,
          },
        },
        careerEvents: {
          include: {
            newJobTitle: true,
            previousJobTitle: true,
            newEmployment: {
              include: {
                department: true,
              },
            },
            previousEmployment: {
              include: {
                department: true,
              },
            },
          },
          orderBy: [
            { effective_date: "desc" },
            { event_date: "desc" },
            { id: "desc" },
          ],
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // Process data to match frontend expectations
    const activeEmployment =
      (employee as any).employments.find((e: any) => e.is_active) ||
      (employee as any).employments[0];
    const onboarding_status =
      (employee as any).appUsers?.[0]?.onboarding_status || "PENDING";
    const profile_picture =
      (employee as any).profile_picture_url ||
      (employee as any).appUsers?.[0]?.profile_picture ||
      null;

    const formattedEmployee = {
      ...employee,
      educations: (employee as any).educations.map((e: any) => ({
        ...e,
        level: e.educationLevel?.name ?? null,
        fieldOfStudy: e.fieldOfStudy?.name ?? null,
        institution: e.institution?.name ?? null,
        institutionCategory: e.institution?.category ?? "Private",
        costSharing:
          e.costSharing?.map((cs: any) => ({
            ...cs,
            issuing_institution:
              cs.issuing_institution || e.institution?.name || null,
          })) || [],
        costSharings:
          e.costSharing?.map((cs: any) => ({
            ...cs,
            issuing_institution:
              cs.issuing_institution || e.institution?.name || null,
          })) || [],
        documentUrl:
          e.document_urls && e.document_urls.length > 0
            ? e.document_urls[0]
            : null,
        document_urls: e.document_urls || [],
        startDate: e.start_date,
        endDate: e.end_date,
      })),
      licensesAndCertifications: (
        employee as any
      ).licensesAndCertifications.map((c: any) => ({
        ...c,
        document_url:
          c.document_urls && c.document_urls.length > 0
            ? c.document_urls[0]
            : null,
        issueDate: c.issue_date,
        expirationDate: c.expiration_date,
      })),
      onboarding_status,
      job_title: activeEmployment?.jobTitle?.title,
      job_level: activeEmployment?.jobTitle?.level,
      department: activeEmployment?.department?.name,
      employment_type: activeEmployment?.employment_type,
      start_date: activeEmployment?.start_date,
      // salary,
      profile_picture,
      emergencyContacts: (employee as any).emergencyContacts,
      financialDetails: (employee as any).financialDetails.map((fd: any) => ({
        ...fd,
        bankName: fd.bank?.name,
      })),
      documents: employee.documents || {
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
      },
      signature_url: employee.signature_url || "",
    };

    // Sign all files in the details
    // const signedEmployee = await signEmployeeFiles(formattedEmployee);
    const signedEmployee = formattedEmployee; // Direct return as per user request (Cloudinary URLs)

    const { filterEmployeeSensitiveData } = require("../utils/permissionUtils");
    const filteredEmployee = await filterEmployeeSensitiveData(
      req.user,
      signedEmployee,
    );

    res.status(200).json({
      status: "success",
      message: "Employee fetched successfully",
      data: { employee: filteredEmployee },
    });
  } catch (error) {
    next(error);
  }
};
export const activateEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: id,
          company_id: companyId,
        },
      },
      include: {
        appUsers: true,
      },
    });

    if (!existingEmployee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // Perform Activation
    await prisma.$transaction(async (tx) => {
      // 1. Activate AppUser
      if (existingEmployee.appUsers.length > 0) {
        await tx.appUser.updateMany({
          where: { employee_id: id, company_id: companyId },
          data: { is_active: true },
        });
      }

      // 2. Activate ONLY the most recent employment
      const latestEmployment = await tx.employment.findFirst({
        where: { employee_id: id, company_id: companyId },
        orderBy: { created_at: "desc" },
      });

      if (latestEmployment) {
        await tx.employment.update({
          where: { id: latestEmployment.id },
          data: { is_active: true },
        });
      }
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
      message: "Employee activated successfully",
    });
  } catch (error) {
    next(error);
  }
};
