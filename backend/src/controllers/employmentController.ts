import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { sendEmail } from "src/utils/email";
import { OnboardingStatus } from "@prisma/client";
import path from "path";
import fs from "fs";
import * as celebrationService from "src/services/celebrationService";
import * as celebrationController from "src/controllers/celebrationController";
import { activateEmployee } from "src/controllers/employeeController";
import { redisService } from "src/services/redisService";
import { generateExperienceLetter } from "src/controllers/experienceLetterController";

const formatBirr = (amount: number) => {
  return amount.toLocaleString("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 2,
  });
};

const approxThousands = (amount: number) => {
  if (!Number.isFinite(amount) || amount < 1000) return null;
  const roundedThousands = Math.round(amount / 1000);
  return `${roundedThousands} Thousand`;
};

import { recalculateLeaveBalancesForEmployee } from "src/utils/leaveUtils";

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  // Prisma Decimal
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyValue: any = value;
  if (anyValue && typeof anyValue.toNumber === "function") {
    try {
      return anyValue.toNumber();
    } catch {
      return 0;
    }
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getKachaLogoDataUri = async () => {
  const logoPath = path.resolve(process.cwd(), "src/assets/kacha_logo.jpg");
  if (!fs.existsSync(logoPath)) return null;
  const buf = await fs.promises.readFile(logoPath);
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
};

import {
  getOfferEmailHtml,
  getCareerEventEmailHtml,
} from "src/utils/emailTemplates";

const sendPendingOfferEmail = async (params: {
  to: string;
  employeeName: string;
  jobTitle: string;
  employmentType: string;
  startDate: Date;
  grossSalary: number;
  basicSalary: number;
  allowances: { name: string; amount: number }[];
  companyId: number;
}) => {
  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: {
      name: true,
      primary_color: true,
      secondary_color: true,
      logo_url: true,
    },
  });

  const companyName = company?.name || "Kacha Digital Financial Service S.C";
  const primaryColor = company?.primary_color || "#e55400";
  const secondaryColor = company?.secondary_color || "#ffda00";
  const logoUrl = company?.logo_url || undefined;

  const startDateText = params.startDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Plain text version for email clients that don't support HTML
  const allowancesText = params.allowances
    .map((a) => `${a.name}: ${formatBirr(a.amount)}`)
    .join("\n");

  await sendEmail({
    to: params.to,
    subject: `Offer of Employment - ${companyName}`,
    text: `Dear ${params.employeeName},

On behalf of ${companyName}, I am delighted to extend an offer of employment to you for the position of ${params.jobTitle}.

Compensation:
- Gross Salary: ${formatBirr(params.grossSalary)}
- Basic Salary: ${formatBirr(params.basicSalary)}
${allowancesText}

Your start date will be ${startDateText}.

Please respond to this email to confirm your acceptance of the offer.`,
    html: getOfferEmailHtml(
      params.employeeName,
      params.jobTitle,
      params.employmentType,
      params.grossSalary,
      params.basicSalary,
      params.allowances,
      startDateText,
      process.env.FRONTEND_URL || "http://localhost:5173",
      companyName,
      logoUrl,
      primaryColor,
      secondaryColor,
    ),
  });
};

export const countManagers = async (
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

    const managers = await prisma.employment.groupBy({
      by: ["manager_id"],
      where: {
        company_id: companyId,
        manager_id: {
          not: null,
        },
        is_active: true,
      },
      _count: {
        manager_id: true,
      },
    });

    const count = managers.length;
    return res.status(200).json({
      status: "success",
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

export const managerialDist = async (
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

    const managers = await prisma.employment.groupBy({
      by: ["manager_id"],
      where: {
        company_id: companyId,
        manager_id: {
          not: null,
        },
        is_active: true,
      },
      _count: {
        manager_id: true,
      },
    });

    const allEmployees = await prisma.employment.count({
      where: {
        company_id: companyId,
        is_active: true,
      },
    });

    const nonManagersCount = allEmployees - managers.length;

    return res.status(200).json({
      status: "success",
      data: { Managers: managers.length, NonManagers: nonManagersCount },
    });
  } catch (error) {
    next(error);
  }
};

export const jobLevelDistribution = async (
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

    const employeeCounts = await prisma.employment.groupBy({
      by: ["job_title_id"],
      where: {
        company_id: companyId,
      },
      _count: {
        job_title_id: true,
      },
    });

    const jobtitlelevel = await prisma.jobTitle.findMany({
      where: {
        company_id: companyId,
      },
      select: {
        id: true,
        level: true,
      },
    });

    const result = employeeCounts.map((count) => {
      const jobTitleLevel = jobtitlelevel.find(
        (d) => d.id === count.job_title_id,
      );
      return {
        id: jobTitleLevel?.id,
        name: jobTitleLevel?.level,
        emp_count: count._count.job_title_id,
      };
    });

    const formatted: Record<string, number> = {};

    result.forEach((r) => {
      if (r.name) formatted[r.name] = r.emp_count;
    });

    return res.status(200).json({
      status: "success",
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

export const departmentTypeDistribution = async (
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

    const employeeCounts = await prisma.employment.groupBy({
      by: ["department_id"],
      where: {
        company_id: companyId,
      },
      _count: {
        department_id: true,
      },
    });

    const departments = await prisma.department.findMany({
      where: {
        company_id: companyId,
      },
      select: { id: true, name: true },
    });

    const result = employeeCounts.map((count) => {
      const department = departments.find((d) => d.id === count.department_id);
      return {
        id: department?.id,
        name: department?.name,
        emp_count: count._count.department_id,
      };
    });

    const formatted: Record<string, number> = {};

    result.forEach((r) => {
      if (r.name) formatted[r.name] = r.emp_count;
    });

    return res.status(200).json({
      status: "success",
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

export const genderDist = async (
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

    const female = await prisma.employment.count({
      where: {
        company_id: companyId,
        is_active: true,
        employee: {
          gender: "Female",
        },
      },
    });

    const male = await prisma.employment.count({
      where: {
        company_id: companyId,
        is_active: true,
        employee: {
          gender: "Male",
        },
      },
    });

    return res.status(200).json({
      status: "success",
      data: { male: male, female: female },
    });
  } catch (error) {
    next(error);
  }
};

export const employmentDist = async (
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

    const employmentDistribution = await prisma.employment.groupBy({
      by: ["employment_type"],
      where: {
        company_id: companyId,
        is_active: true,
      },
      _count: {
        _all: true,
      },
    });

    return res.status(200).json({
      status: "success",
      data: Object.fromEntries(
        employmentDistribution.map((item) => [
          item.employment_type,
          item._count._all,
        ]),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const countActiveEmployments = async (
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

    const count = await prisma.employment.count({
      where: { company_id: companyId, is_active: true },
    });
    return res.status(200).json({
      status: "success",
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

export const countInactiveEmployments = async (
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

    const count = await prisma.employment.count({
      where: { company_id: companyId, is_active: false },
    });
    return res.status(200).json({
      status: "success",
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

export const countEmployments = async (
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

    const count = await prisma.employment.count({
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

export const fetchAllEmployments = async (
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
    const employeeId = req.query.employee_id as string;
    const departmentId = req.query.department_id as string;
    const jobTitleId = req.query.job_title_id as string;
    const employmentType = req.query.employment_type as string;
    const isActive = req.query.is_active as string;
    const salaryMin = req.query.salary_min as string;
    const salaryMax = req.query.salary_max as string;
    const startDateFrom = req.query.start_date_from as string;
    const startDateTo = req.query.start_date_to as string;
    const probationStatus = req.query.probation_status as string; // active, completed, none

    // Build where clause
    const where: any = {
      company_id: companyId,
    };

    // Search filter (employee name or ID)
    if (search) {
      where.employee = {
        OR: [
          { full_name: { contains: search, mode: "insensitive" } },
          { id: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Employee ID filter
    if (employeeId) {
      where.employee_id = employeeId;
    }

    // Department filter
    if (departmentId) {
      where.department_id = parseInt(departmentId);
    }

    // Job title filter
    if (jobTitleId) {
      where.job_title_id = parseInt(jobTitleId);
    }

    // Employment type filter
    if (employmentType) {
      where.employment_type = employmentType;
    }

    // Active status filter
    if (isActive !== undefined) {
      where.is_active = isActive === "true";
    }

    // Salary range filter
    if (salaryMin || salaryMax) {
      where.gross_salary = {};
      if (salaryMin) {
        where.gross_salary.gte = parseFloat(salaryMin);
      }
      if (salaryMax) {
        where.gross_salary.lte = parseFloat(salaryMax);
      }
    }

    // Start date range filter
    if (startDateFrom || startDateTo) {
      where.start_date = {};
      if (startDateFrom) {
        where.start_date.gte = new Date(startDateFrom);
      }
      if (startDateTo) {
        where.start_date.lte = new Date(startDateTo);
      }
    }

    // Fetch company settings
    const settings = await prisma.employeeSettings.findUnique({
      where: { company_id: companyId },
    });
    const probationDays = settings?.probation_period_days ?? 90;

    // Probation status filter
    const today = new Date();
    const probationThresholdDate = new Date();
    probationThresholdDate.setDate(
      probationThresholdDate.getDate() - probationDays,
    );

    if (probationStatus === "active") {
      where.OR = [
        { probation_end_date: { gte: today } },
        {
          AND: [
            { probation_end_date: null },
            { start_date: { gte: probationThresholdDate } },
          ],
        },
      ];
    } else if (probationStatus === "completed") {
      where.OR = [
        { probation_end_date: { lt: today } },
        {
          AND: [
            { probation_end_date: null },
            { start_date: { lt: probationThresholdDate } },
          ],
        },
      ];
    } else if (probationStatus === "none") {
      where.probation_end_date = null;
      where.start_date = { lt: probationThresholdDate };
    }

    // Sorting
    const sortBy = (req.query.sortBy as string) || "created_at";
    const order = (req.query.order as string) || "desc";
    const orderBy = { [sortBy]: order };

    // Fetch employments with count
    const [employments, total] = await Promise.all([
      prisma.employment.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              gender: true,
            },
          },
          manager: {
            select: {
              id: true,
              full_name: true,
            },
          },
          department: true,
          jobTitle: true,
          allowances: {
            where: { is_active: true },
            include: {
              allowanceType: true,
            },
          },
        },
      }),
      prisma.employment.count({ where }),
    ]);

    const transformedEmployments = employments.map((emp) => ({
      ...emp,
      probation_end_date:
        emp.probation_end_date ||
        (emp.start_date
          ? new Date(
              new Date(emp.start_date).getTime() +
                probationDays * 24 * 60 * 60 * 1000,
            )
          : null),
    }));

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Employments fetched successfully",
      data: {
        employments: transformedEmployments,
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

export const fetchEmployment = async (
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

    const employment = await prisma.employment.findFirst({
      where: {
        id: parseInt(id),
        company_id: companyId,
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            gender: true,
            date_of_birth: true,
            tin_number: true,
          },
        },
        manager: {
          select: {
            id: true,
            full_name: true,
          },
        },
        department: true,
        jobTitle: true,
        allowances: {
          include: {
            allowanceType: true,
          },
        },
      },
    });

    if (!employment) {
      return res.status(404).json({
        status: "fail",
        message: "Employment record not found",
      });
    }

    // Fetch company settings
    const settings = await prisma.employeeSettings.findUnique({
      where: { company_id: companyId },
    });
    const probationDays = settings?.probation_period_days ?? 90;

    const transformedEmployment = {
      ...employment,
      probation_end_date:
        employment.probation_end_date ||
        (employment.start_date
          ? new Date(
              new Date(employment.start_date).getTime() +
                probationDays * 24 * 60 * 60 * 1000,
            )
          : null),
    };

    res.status(200).json({
      status: "success",
      message: "Employment fetched successfully",
      data: { employment: transformedEmployment },
    });
  } catch (error) {
    next(error);
  }
};

export const getLatestEmployment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const employment = await prisma.employment.findFirst({
      where: {
        employee_id: employeeId,
        company_id: companyId,
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        jobTitle: true,
        department: true,
        manager: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    if (!employment) {
      return res.status(404).json({
        status: "fail",
        message: "No employment record found for this employee",
      });
    }

    // Fetch company settings
    const settings = await prisma.employeeSettings.findUnique({
      where: { company_id: companyId },
    });
    const probationDays = settings?.probation_period_days ?? 90;

    const transformedEmployment = {
      ...employment,
      probation_end_date:
        employment.probation_end_date ||
        (employment.start_date
          ? new Date(
              new Date(employment.start_date).getTime() +
                probationDays * 24 * 60 * 60 * 1000,
            )
          : null),
    };

    res.status(200).json({
      status: "success",
      message: "Latest employment fetched successfully",
      data: { employment: transformedEmployment },
    });
  } catch (error) {
    next(error);
  }
};

export const fetchEmployeeManager = async (
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

    const employment = await prisma.employment.findFirst({
      where: {
        employee_id: String(id),
        company_id: companyId,
      },
      include: {
        manager: {
          select: {
            id: true,
            full_name: true,
            gender: true,
          },
        },
      },
    });

    if (!employment) {
      return res.status(404).json({
        status: "fail",
        message: "Employment record not found",
      });
    }

    if (!employment.manager) {
      return res.status(404).json({
        status: "fail",
        message: "Manager not assigned to this employment",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Manager details fetched successfully",
      data: {
        employment: {
          id: employment.id,
          employee_id: employment.employee_id,
        },
        manager: employment.manager,
      },
    });
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
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { manager_id, employee_ids } = req.body;

    if (
      !manager_id ||
      !Array.isArray(employee_ids) ||
      employee_ids.length === 0
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Provide manager_id and a non-empty employee_ids array",
      });
    }

    const managerEmployment = await prisma.employment.findFirst({
      where: {
        employee_id: manager_id,
        company_id: companyId,
        is_active: true,
      },
      include: { employee: true },
    });

    if (!managerEmployment) {
      return res.status(404).json({
        status: "fail",
        message: "Manager employment record not found in this company",
      });
    }

    const updates = await Promise.all(
      employee_ids.map((empId: string) =>
        prisma.employment.updateMany({
          where: {
            employee_id: empId,
            company_id: companyId,
            is_active: true,
          },
          data: {
            manager_id,
          },
        }),
      ),
    );

    const affected = updates.reduce((sum, res) => sum + res.count, 0);

    return res.status(200).json({
      status: "success",
      message: `Manager assigned to ${affected} active employment records`,
      data: {
        manager: {
          id: managerEmployment.employee_id,
          full_name: managerEmployment.employee?.full_name,
        },
        updated_count: affected,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createEmployment = async (
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
      manager_id,
      employment_type,
      start_date,
      end_date,
      gross_salary,
      basic_salary,
      department, // Accept department name
      department_id, // Accept department ID directly
      job_title_id,
      cost_sharing_status,
      cost_sharing_amount,
      provider_company,
      contract_reference,
      probation_end_date,
      notes,
    } = req.body;

    // Validation
    if (!employee_id || !employment_type || !start_date || !gross_salary) {
      return res.status(400).json({
        status: "fail",
        message:
          "Please provide all required fields: employee_id, employment_type, start_date, gross_salary",
      });
    }

    if (basic_salary && parseFloat(basic_salary) > parseFloat(gross_salary)) {
      return res.status(400).json({
        status: "fail",
        message: "Basic salary cannot be greater than gross salary",
      });
    }

    // Resolve department: accept either department_id (number) or department (string name)
    let resolvedDepartmentId: number | null = null;

    if (department_id) {
      // If department_id is provided, use it directly
      resolvedDepartmentId = parseInt(department_id);

      // Verify department exists
      const dept = await prisma.department.findFirst({
        where: {
          id: resolvedDepartmentId,
          company_id: companyId,
        },
      });

      if (!dept) {
        return res.status(404).json({
          status: "fail",
          message: "Department not found",
        });
      }
    } else if (department) {
      // If department name is provided, find the department by name
      const dept = await prisma.department.findUnique({
        where: {
          company_id_name: {
            company_id: companyId,
            name: department,
          },
        },
      });

      if (dept) {
        resolvedDepartmentId = dept.id;
      } else {
        return res.status(404).json({
          status: "fail",
          message: `Department "${department}" not found in this company`,
        });
      }
    }

    // Verify Employee Exists
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employee_id,
          company_id: companyId,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // Verify Manager Exists (if provided)
    if (manager_id) {
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
          message: "Manager not found",
        });
      }
    }

    // Create Employment
    const newEmployment = await prisma.employment.create({
      data: {
        company_id: companyId,
        employee_id,
        manager_id: manager_id ? manager_id : null,
        employment_type,
        start_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        gross_salary: parseFloat(gross_salary),
        basic_salary: basic_salary ? parseFloat(basic_salary) : null,
        department_id: resolvedDepartmentId,
        job_title_id: job_title_id ? parseInt(job_title_id) : null,
        cost_sharing_status,
        cost_sharing_amount: cost_sharing_amount
          ? parseFloat(cost_sharing_amount)
          : null,
        provider_company,
        contract_reference,
        probation_end_date: probation_end_date
          ? new Date(probation_end_date)
          : null,
        notes,
        is_active: true,
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
          },
        },
        manager: {
          select: {
            id: true,
            full_name: true,
          },
        },
        department: true,
        jobTitle: true,
        allowances: {
          include: {
            allowanceType: true,
          },
        },
      },
    });

    // Update User Status to PENDING and Send Login Email
    const user = await prisma.appUser.findFirst({
      where: {
        employee_id: employee_id,
        company_id: companyId,
      },
      select: {
        id: true,
        email: true,
        onboarding_status: true,
      },
    });

    if (user) {
      // SUBMITTED should remain SUBMITTED until an explicit approval,
      // but HR creating/updating employment should still trigger the offer email.
      const shouldTransitionToPending =
        user.onboarding_status !== OnboardingStatus.IN_PROGRESS &&
        user.onboarding_status !== OnboardingStatus.PENDING_APPROVAL &&
        user.onboarding_status !== OnboardingStatus.COMPLETED;

      const shouldSendOfferEmail =
        shouldTransitionToPending ||
        user.onboarding_status === OnboardingStatus.PENDING_APPROVAL;

      if (shouldTransitionToPending) {
        await prisma.appUser.update({
          where: { id: user.id },
          data: {
            onboarding_status: OnboardingStatus.IN_PROGRESS,
          },
        });
      }

      if (shouldSendOfferEmail) {
        const employeeName = newEmployment.employee?.full_name || "Employee";
        const jobTitle = newEmployment.jobTitle?.title || "Employee";

        await sendPendingOfferEmail({
          to: user.email,
          employeeName,
          jobTitle,
          employmentType: newEmployment.employment_type,
          startDate: newEmployment.start_date,
          grossSalary: toNumber(newEmployment.gross_salary),
          basicSalary: toNumber(newEmployment.basic_salary),
          allowances: (newEmployment as any).allowances.map((a: any) => ({
            name: a.allowanceType?.name || "Allowance",
            amount: toNumber(a.amount),
          })),
          companyId,
        });
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

    res.status(201).json({
      status: "success",
      message: "Employment record created successfully.",
      data: {
        employment: newEmployment,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmployment = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params; // This is now employee_id
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const {
      manager_id,
      department_id,
      job_title_id,
      job_title,
      job_level,
      employment_type,
      start_date,
      end_date,
      gross_salary,
      basic_salary,
      department, // Accept department name
      cost_sharing_status,
      cost_sharing_amount,
      provider_company,
      contract_reference,
      probation_end_date,
      notes,
      is_active,
    } = req.body;

    // Numeric Validation
    const numericFields = {
      gross_salary,
      basic_salary,
      cost_sharing_amount,
    };

    for (const [key, value] of Object.entries(numericFields)) {
      if (value !== undefined && value !== null && isNaN(parseFloat(value))) {
        return res.status(400).json({
          status: "fail",
          message: `${key.replace(/_/g, " ")} must be a valid number`,
        });
      }
    }

    // Resolve department: Upsert if name provided
    let resolvedDepartmentId: number | null = department_id
      ? parseInt(department_id)
      : null;

    if (department) {
      const dept = await prisma.department.upsert({
        where: {
          company_id_name: {
            company_id: companyId,
            name: department,
          },
        },
        update: {},
        create: {
          company_id: companyId,
          name: department,
        },
      });
      resolvedDepartmentId = dept.id;
    }

    // Resolve Job Title: Upsert if title provided
    let resolvedJobTitleId: number | null = job_title_id
      ? parseInt(job_title_id)
      : null;

    if (job_title) {
      const jobLevel = job_level || "Entry";
      const job = await prisma.jobTitle.upsert({
        where: {
          company_id_title_level: {
            company_id: companyId,
            title: job_title,
            level: jobLevel,
          },
        },
        update: {},
        create: {
          company_id: companyId,
          title: job_title,
          level: jobLevel,
        },
      });
      resolvedJobTitleId = job.id;
    }

    const numericId = parseInt(id);
    const isNumeric = !isNaN(numericId);

    // Find the employment record. We try to match by 'id' (PK) or 'employee_id' (String)
    const latestEmployment = await prisma.employment.findFirst({
      where: {
        OR: [
          ...(isNumeric ? [{ id: numericId }] : []),
          { employee_id: String(id) },
        ],
        company_id: companyId,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    if (!latestEmployment) {
      return res.status(404).json({
        status: "fail",
        message: `No employment record found for ID or Employee ID: ${id}`,
      });
    }

    // Verify Manager Exists (if being updated)
    if (manager_id) {
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
          message: "Manager not found",
        });
      }
    }

    // Salary Consistency Validation
    const effectiveGross =
      gross_salary !== undefined
        ? parseFloat(gross_salary)
        : latestEmployment.gross_salary
          ? Number(latestEmployment.gross_salary)
          : 0;

    const effectiveBasic =
      basic_salary !== undefined
        ? basic_salary
          ? parseFloat(basic_salary)
          : 0
        : latestEmployment.basic_salary
          ? Number(latestEmployment.basic_salary)
          : 0;

    if (effectiveBasic > effectiveGross) {
      return res.status(400).json({
        status: "fail",
        message: `Inconsistent salary: Basic salary (${effectiveBasic}) cannot exceed Gross salary (${effectiveGross})`,
      });
    }

    // Update the found latest employment
    const updatedEmployment = await prisma.employment.update({
      where: { id: latestEmployment.id },
      data: {
        ...(manager_id !== undefined && {
          manager_id: manager_id ? manager_id : null,
        }),
        ...(employment_type !== undefined && { employment_type }),
        ...(start_date !== undefined && { start_date: new Date(start_date) }),
        ...(end_date !== undefined && {
          end_date: end_date ? new Date(end_date) : null,
        }),
        ...(gross_salary !== undefined && {
          gross_salary: parseFloat(gross_salary),
        }),
        ...(basic_salary !== undefined && {
          basic_salary: basic_salary ? parseFloat(basic_salary) : null,
        }),
        ...(cost_sharing_status !== undefined && { cost_sharing_status }),
        ...(cost_sharing_amount !== undefined && {
          cost_sharing_amount: cost_sharing_amount
            ? parseFloat(cost_sharing_amount)
            : null,
        }),
        ...(provider_company !== undefined && { provider_company }),
        ...(contract_reference !== undefined && { contract_reference }),
        ...(resolvedDepartmentId !== undefined && {
          department_id: resolvedDepartmentId,
        }),
        ...(resolvedJobTitleId !== null && {
          job_title_id: resolvedJobTitleId,
        }),
        ...(probation_end_date !== undefined && {
          probation_end_date: probation_end_date
            ? new Date(probation_end_date)
            : null,
        }),
        ...(notes !== undefined && { notes }),
        ...(is_active !== undefined && { is_active }),
        allowances: {
          deleteMany: {},
          create:
            req.body.allowances && Array.isArray(req.body.allowances)
              ? req.body.allowances.map((a: any) => ({
                  amount: parseFloat(a.amount),
                  allowanceType: {
                    connectOrCreate: {
                      where: { name: a.name },
                      create: { name: a.name },
                    },
                  },
                }))
              : [],
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
          },
        },
        manager: {
          select: {
            id: true,
            full_name: true,
          },
        },
        department: true,
        jobTitle: true,
        allowances: {
          include: {
            allowanceType: true,
          },
        },
      },
    });

    // Recalculate Leave Balances if start_date changed
    if (
      start_date &&
      new Date(start_date).getTime() !== latestEmployment.start_date.getTime()
    ) {
      await recalculateLeaveBalancesForEmployee(
        updatedEmployment.employee_id,
        companyId,
      );
    }

    // Update User Status to PENDING and Send Offer Email (only on transition)
    const user = await prisma.appUser.findFirst({
      where: {
        employee_id: String(id),
        company_id: companyId,
      },
      select: {
        id: true,
        email: true,
        onboarding_status: true,
      },
    });

    const shouldTransitionToPending =
      !!user &&
      user.onboarding_status !== OnboardingStatus.IN_PROGRESS &&
      user.onboarding_status !== OnboardingStatus.PENDING_APPROVAL &&
      user.onboarding_status !== OnboardingStatus.COMPLETED;

    const shouldSendOfferEmail =
      !!user &&
      (shouldTransitionToPending ||
        user.onboarding_status === OnboardingStatus.PENDING_APPROVAL);

    if (shouldTransitionToPending && user) {
      await prisma.appUser.update({
        where: { id: user.id },
        data: {
          onboarding_status: OnboardingStatus.IN_PROGRESS,
        },
      });
    }

    if (shouldSendOfferEmail && user) {
      const employeeName = updatedEmployment.employee?.full_name || "Employee";
      const jobTitle = updatedEmployment.jobTitle?.title || "Employee";
      await sendPendingOfferEmail({
        to: user.email,
        employeeName,
        jobTitle,
        employmentType: updatedEmployment.employment_type,
        startDate: updatedEmployment.start_date,
        grossSalary: toNumber(updatedEmployment.gross_salary),
        basicSalary: toNumber(updatedEmployment.basic_salary),
        allowances: (updatedEmployment as any).allowances.map((a: any) => ({
          name: a.allowanceType?.name || "Allowance",
          amount: toNumber(a.amount),
        })),
        companyId,
      });
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
      message: "Latest employment updated successfully",
      data: {
        employment: updatedEmployment,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmployment = async (
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

    const numericId = parseInt(id);
    const isNumeric = !isNaN(numericId);

    // Check if employment exists - try both PK and employee_id
    const existingEmployment = await prisma.employment.findFirst({
      where: {
        OR: [
          ...(isNumeric ? [{ id: numericId }] : []),
          { employee_id: String(id) },
        ],
        company_id: companyId,
      },
      include: {
        allowances: true,
      },
    });

    if (!existingEmployment) {
      return res.status(404).json({
        status: "fail",
        message: "Employment record not found",
      });
    }

    // Check if it's the only active employment for the employee
    if (existingEmployment.is_active) {
      const activeEmploymentsCount = await prisma.employment.count({
        where: {
          employee_id: existingEmployment.employee_id,
          company_id: companyId,
          is_active: true,
        },
      });

      if (activeEmploymentsCount === 1) {
        await prisma.employment.update({
          where: {
            id: existingEmployment.id,
            company_id: companyId,
            is_active: true,
          },
          data: { is_active: false },
        });
        return res.status(200).json({
          status: "deactivate",
          message:
            "Cannot delete the only active employment record for this employee. deactivating instead.",
        });
      }
    }

    // Delete employment (cascade will handle allowances)
    await prisma.employment.delete({
      where: {
        id: existingEmployment.id,
      },
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
      message: "Employment record deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
export const promoteEmployee = async (
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
      current_employment_id,
      new_manager_id,
      new_job_title_id,
      new_job_title_name,
      new_job_level_name,
      new_department_id,
      new_department_name,
      new_gross_salary,
      new_basic_salary,
      new_employment_type,
      new_allowances,
      event_type,
      effective_date,
      justification,
      notes,
    } = req.body;

    // Basic validation
    if (
      !employee_id ||
      !current_employment_id ||
      (!new_job_title_id && !new_job_title_name) ||
      !new_gross_salary ||
      !new_employment_type ||
      !event_type ||
      !effective_date
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Missing required fields for promotion",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current employment
      const currentEmployment = await tx.employment.findFirst({
        where: {
          id: parseInt(current_employment_id),
          employee_id,
          company_id: companyId,
          is_active: true,
        },
      });

      if (!currentEmployment) {
        throw new Error(
          "Current active employment not found for this employee",
        );
      }

      const settings = await tx.employeeSettings.findUnique({
        where: { company_id: companyId },
        select: { probation_period_days: true },
      });
      const probationDays = settings?.probation_period_days ?? 90;
      const carriedProbationEndDate =
        currentEmployment.probation_end_date ||
        (currentEmployment.start_date
          ? new Date(
              new Date(currentEmployment.start_date).getTime() +
                probationDays * 24 * 60 * 60 * 1000,
            )
          : null);

      // Handle Job Title resolution (Upsert if name/level provided)
      let resolvedJobTitleId =
        new_job_title_id && !isNaN(Number(new_job_title_id))
          ? Number(new_job_title_id)
          : null;

      if (!resolvedJobTitleId && new_job_title_name) {
        const jobLevel = new_job_level_name || "Entry";
        const job = await tx.jobTitle.upsert({
          where: {
            company_id_title_level: {
              company_id: companyId,
              title: new_job_title_name,
              level: jobLevel,
            },
          },
          update: {},
          create: {
            company_id: companyId,
            title: new_job_title_name,
            level: jobLevel,
          },
        });
        resolvedJobTitleId = job.id;
      }

      if (!resolvedJobTitleId) {
        throw new Error("Could not resolve new job title ID");
      }

      // 2. Deactivate all current active employments
      await tx.employment.updateMany({
        where: {
          employee_id,
          company_id: companyId,
          is_active: true,
        },
        data: {
          is_active: false,
          end_date: new Date(effective_date),
        },
      });

      // Handle Department resolution (Upsert if name provided)
      let resolvedDepartmentId =
        new_department_id && !isNaN(Number(new_department_id))
          ? Number(new_department_id)
          : null;

      if (!resolvedDepartmentId && new_department_name) {
        const department = await tx.department.upsert({
          where: {
            company_id_name: {
              company_id: companyId,
              name: new_department_name,
            },
          },
          update: {},
          create: {
            company_id: companyId,
            name: new_department_name,
          },
        });
        resolvedDepartmentId = department.id;
      }

      // Fallback to current department if none provided/found
      if (!resolvedDepartmentId) {
        resolvedDepartmentId = currentEmployment.department_id;
      }

      // 3. Create new employment
      const newEmployment = await tx.employment.create({
        data: {
          employee_id,
          company_id: companyId,
          job_title_id: resolvedJobTitleId,
          department_id: resolvedDepartmentId,
          manager_id: new_manager_id || currentEmployment.manager_id,
          gross_salary: parseFloat(new_gross_salary),
          basic_salary: new_basic_salary
            ? parseFloat(new_basic_salary)
            : currentEmployment.basic_salary,
          start_date: new Date(effective_date),
          is_active: true,
          employment_type: new_employment_type,
          provider_company: currentEmployment.provider_company,
          contract_reference: currentEmployment.contract_reference,
          cost_sharing_status: currentEmployment.cost_sharing_status,
          cost_sharing_amount: currentEmployment.cost_sharing_amount,
          probation_end_date: carriedProbationEndDate,
        },
      });

      // 4. Handle Allowances for the new employment
      const rawAllowances = new_allowances || [];
      if (Array.isArray(rawAllowances) && rawAllowances.length > 0) {
        for (const al of rawAllowances) {
          const amount = parseFloat(al.amount);
          if (amount > 0) {
            const typeName = al.name || al.allowanceTypeName;
            if (!typeName) continue;

            const type = await tx.allowanceType.upsert({
              where: { name: typeName },
              update: {},
              create: { name: typeName },
            });

            await tx.employeeAllowance.create({
              data: {
                employment_id: newEmployment.id,
                allowance_type_id: type.id,
                amount: amount,
              },
            });
          }
        }
      }

      // 5. Create Career Event
      const careerEvent = await tx.employeeCareerEvent.create({
        data: {
          employee_id,
          previous_employment_id: currentEmployment.id,
          new_employment_id: newEmployment.id,
          previous_job_title_id: currentEmployment.job_title_id,
          new_job_title_id: resolvedJobTitleId,
          previous_salary: currentEmployment.gross_salary,
          new_salary: parseFloat(new_gross_salary),
          event_type: event_type as any,
          event_date: new Date(),
          effective_date: new Date(effective_date),
          justification,
          notes,
          recorded_by: req.user?.employee_id || null,
          department_changed: resolvedDepartmentId
            ? resolvedDepartmentId !== currentEmployment.department_id
            : false,
          document_urls:
            req.body.document_urls ||
            (req.body.document_url ? [req.body.document_url] : []),
        },
      });

      return { newEmployment, careerEvent };
    });

    // Send career event notification email
    try {
      // Fetch employee details
      const employee = await prisma.employee.findUnique({
        where: {
          id_company_id: {
            id: employee_id,
            company_id: companyId,
          },
        },
      });

      // Fetch user email via AppUser table
      const user = await prisma.appUser.findFirst({
        where: {
          employee_id: employee_id,
          company_id: companyId,
        },
        select: { email: true },
      });

      // Fetch job titles for the email
      const [previousJobTitle, newJobTitle] = await Promise.all([
        result.careerEvent.previous_job_title_id
          ? prisma.jobTitle.findUnique({
              where: { id: result.careerEvent.previous_job_title_id },
            })
          : null,
        prisma.jobTitle.findUnique({
          where: { id: result.careerEvent.new_job_title_id! },
        }),
      ]);

      if (employee && user?.email) {
        const eventTypeMap: Record<
          string,
          "promotion" | "demotion" | "transfer"
        > = {
          PROMOTION: "promotion",
          DEMOTION: "demotion",
          TRANSFER: "transfer",
          LATERAL_MOVE: "transfer",
          SALARY_INCREASE: "promotion",
        };

        const emailEventType = eventTypeMap[event_type] || "promotion";
        const previousTitle = previousJobTitle?.title || "Previous Position";
        const newTitleText = newJobTitle?.title || "New Position";
        const newSalary = Number(result.careerEvent.new_salary) || undefined;

        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: {
            name: true,
            primary_color: true,
            secondary_color: true,
            logo_url: true,
          },
        });

        const companyName = company?.name || "Kacha HRIS";
        const primaryColor = company?.primary_color || "#e55400";
        const secondaryColor = company?.secondary_color || "#ffda00";
        const logoUrl = company?.logo_url || undefined;

        const html = getCareerEventEmailHtml(
          employee.full_name,
          emailEventType,
          previousTitle,
          newTitleText,
          effective_date,
          newSalary,
          justification || undefined,
          companyName,
          logoUrl,
          primaryColor,
          secondaryColor,
        );

        // Add a small delay to allow the transaction to fully settle and reduce immediate network contention
        setTimeout(() => {
          void sendEmail({
            to: user.email,
            subject:
              emailEventType === "promotion"
                ? `Congratulations on Your Promotion! 🎉 - ${companyName}`
                : emailEventType === "transfer"
                  ? `Position Transfer Notice - ${companyName}`
                  : `Position Change Notice - ${companyName}`,
            html,
          }).catch((err) =>
            console.error("[CareerEvent] Delayed email send failed:", err),
          );

          console.log(
            `[CareerEvent] Email scheduled for ${user.email} (2s delay)`,
          );
        }, 2000);
      }
    } catch (emailError) {
      console.error(
        "[CareerEvent] Failed to send notification email:",
        emailError,
      );
      // Don't fail the request if email fails
    }

    // Trigger Celebration if PROMOTION
    try {
      console.log(
        "[Celebration] Checking if celebration should be triggered for event_type:",
        event_type,
      );
      const eventTypeMap: Record<
        string,
        "promotion" | "demotion" | "transfer"
      > = {
        PROMOTION: "promotion",
        DEMOTION: "demotion",
        TRANSFER: "transfer",
        LATERAL_MOVE: "transfer",
        SALARY_INCREASE: "promotion",
      };

      const emailEventType = eventTypeMap[event_type] || "promotion";
      console.log("[Celebration] Mapped event type:", emailEventType);

      if (emailEventType === "promotion") {
        console.log(
          "[Celebration] Creating promotion celebration for employee:",
          employee_id,
          "company:",
          companyId,
        );
        // We need titles, fetch if not already fetched in email block (cleaner to re-fetch or restructure,
        // but to minimize impact, let's just fetch simplified versions here if needed or reuse logic if I could.
        // Since I cannot easily share scope variables from the prev try/catch block without big refactor,
        // I will re-fetch minimal data needed.

        const prevTitle = result.careerEvent.previous_job_title_id
          ? (
              await prisma.jobTitle.findUnique({
                where: { id: result.careerEvent.previous_job_title_id },
                select: { title: true },
              })
            )?.title || "Previous Position"
          : "Previous Position";

        const newTitle =
          (
            await prisma.jobTitle.findUnique({
              where: { id: result.careerEvent.new_job_title_id! },
              select: { title: true },
            })
          )?.title || "New Position";

        console.log(
          "[Celebration] Titles - Previous:",
          prevTitle,
          "New:",
          newTitle,
        );

        const celebration = await celebrationService.createPromotionCelebration(
          employee_id,
          companyId,
          prevTitle,
          newTitle,
        );

        console.log(
          "[Celebration] Celebration created successfully, ID:",
          celebration.id,
        );

        celebrationController.broadcastNewCelebration(companyId, celebration);
        console.log("[Celebration] Broadcast completed");
      }
    } catch (celebrationError) {
      console.error(
        "[Celebration] Failed to trigger promotion celebration:",
        celebrationError,
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

    return res.status(201).json({
      status: "success",
      message: "Employee promoted successfully",
      data: result,
    });
  } catch (error: any) {
    if (
      error.message === "Current active employment not found for this employee"
    ) {
      return res.status(404).json({
        status: "fail",
        message: error.message,
      });
    }
    next(error);
  }
};
export const replaceEmployeeEmploymentDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;
    if (!companyId)
      return res
        .status(400)
        .json({ status: "fail", message: "Company ID missing" });

    const {
      job_title_id,
      job_title,
      job_level,
      department_id,
      department,
      manager_id,
      employment_type,
      start_date,
      probation_end_date,
      gross_salary,
      basic_salary,
      allowances,
    } = req.body;

    await prisma.$transaction(async (tx) => {
      const activeEmp = await tx.employment.findFirst({
        where: { employee_id: id, company_id: companyId, is_active: true },
      });

      if (!activeEmp) {
        throw new Error("No active employment record found to update.");
      }

      // Verify Manager if provided
      if (manager_id) {
        const manager = await tx.employee.findUnique({
          where: { id_company_id: { id: manager_id, company_id: companyId } },
        });
        if (!manager) throw new Error("Manager not found");
      }

      // Resolve Department
      let resolvedDepartmentId =
        department_id && !isNaN(Number(department_id))
          ? Number(department_id)
          : undefined;

      // Only resolve by name if ID is NOT provided
      if (!resolvedDepartmentId && department) {
        const dept = await tx.department.upsert({
          where: {
            company_id_name: { company_id: companyId, name: department },
          },
          update: {},
          create: { company_id: companyId, name: department },
        });
        resolvedDepartmentId = dept.id;
      }

      // Resolve Job Title
      let resolvedJobTitleId =
        job_title_id && !isNaN(Number(job_title_id))
          ? Number(job_title_id)
          : undefined;

      // Only resolve by name if ID is NOT provided
      if (!resolvedJobTitleId && job_title) {
        const jobLevel = job_level || "Entry";
        const job = await tx.jobTitle.upsert({
          where: {
            company_id_title_level: {
              company_id: companyId,
              title: job_title,
              level: jobLevel,
            },
          },
          update: {},
          create: {
            company_id: companyId,
            title: job_title,
            level: jobLevel,
          },
        });
        resolvedJobTitleId = job.id;
      }

      const rawStartDate = start_date;
      const parsedStartDate = rawStartDate ? new Date(rawStartDate) : null;

      await tx.employment.update({
        where: { id: activeEmp.id },
        data: {
          ...(manager_id !== undefined && { manager_id: manager_id || null }),
          ...(resolvedJobTitleId && { job_title_id: resolvedJobTitleId }),
          ...(resolvedDepartmentId && { department_id: resolvedDepartmentId }),
          ...(employment_type && { employment_type }),
          ...(parsedStartDate &&
            !isNaN(parsedStartDate.getTime()) && {
              start_date: parsedStartDate,
            }),
          ...(probation_end_date !== undefined && {
            probation_end_date: probation_end_date
              ? new Date(probation_end_date)
              : null,
          }),
          ...(gross_salary !== undefined && {
            gross_salary: parseFloat(gross_salary) || 0,
          }),
          ...(basic_salary !== undefined && {
            basic_salary: parseFloat(basic_salary) || 0,
          }),
        },
      });

      if (allowances && Array.isArray(allowances)) {
        await tx.employeeAllowance.deleteMany({
          where: { employment_id: activeEmp.id },
        });
        for (const al of allowances) {
          const amount = parseFloat(al.amount);
          if (amount > 0) {
            const typeName = al.name;
            if (!typeName) continue;
            const type = await tx.allowanceType.upsert({
              where: { name: typeName },
              update: {},
              create: { name: typeName },
            });
            await tx.employeeAllowance.create({
              data: {
                employment_id: activeEmp.id,
                allowance_type_id: type.id,
                amount,
              },
            });
          }
        }
      }
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

    res
      .status(200)
      .json({ status: "success", message: "Employment details updated" });
  } catch (error) {
    next(error);
  }
};
