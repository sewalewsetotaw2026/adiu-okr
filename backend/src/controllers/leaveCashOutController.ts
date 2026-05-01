import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import {
  calculateLeaveCashValue,
  getFiscalYear,
  calculateAccruedBalance,
} from "src/utils/leaveUtils";
import { redisService } from "src/services/redisService";

/**
 * Calculate cash-out value for current employee
 * Shows potential encashment value without creating a request
 */
export const calculateCashOutValue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;

    if (!companyId || !employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    // Get leave settings
    const leaveSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });

    const settings = leaveSettings as any;

    if (!settings?.enable_encashment) {
      return res.status(400).json({
        status: "fail",
        message: "Leave encashment is not enabled for this company",
      });
    }

    // Get employee with salary info
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
      include: {
        employments: {
          where: { is_active: true },
          select: {
            start_date: true,
            gross_salary: true,
          },
          take: 1,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    const monthlySalary = Number(employee.employments[0]?.gross_salary ?? 0);
    if (monthlySalary <= 0) {
      return res.status(400).json({
        status: "fail",
        message: "Employee salary information not available",
      });
    }

    // Get annual leave balance
    const fiscalYear = await getFiscalYear(companyId);
    const annualLeaveType = await prisma.leaveType.findFirst({
      where: {
        company_id: companyId,
        code: "ANNUAL",
      },
    });

    if (!annualLeaveType) {
      return res.status(404).json({
        status: "fail",
        message: "Annual leave type not found",
      });
    }

    // Calculate accrued balance using leave type specific settings
    const hireDate = employee.employments[0]?.start_date ?? new Date();
    const accrualResult = calculateAccruedBalance(
      hireDate,
      new Date(),
      annualLeaveType.default_allowance_days || 16,
      settings.accrual_divisor || 365,
      settings.fiscal_year_start_month || 1,
      annualLeaveType.incremental_period_years || 2,
      annualLeaveType.incremental_days_per_year || 1,
      annualLeaveType.max_accrual_limit || null,
      (settings.accrual_basis as any) || "ANNIVERSARY"
    );

    // Get used/pending days
    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        employee_id_leave_type_id_fiscal_year: {
          employee_id: employeeId,
          leave_type_id: annualLeaveType.id,
          fiscal_year: fiscalYear,
        },
      },
    });

    const usedDays = Number(leaveBalance?.used_days ?? 0);
    const pendingDays = Number(leaveBalance?.pending_days ?? 0);
    const remainingDays = Math.max(
      0,
      accrualResult.accruedDays - usedDays - pendingDays
    );

    // Calculate cash-out value
    const cashOut = calculateLeaveCashValue(
      remainingDays,
      monthlySalary,
      settings.encashment_salary_divisor ?? 30,
      settings.max_encashment_days ?? null,
      (settings.encashment_rounding as "ROUND" | "FLOOR" | "CEIL") ?? "ROUND"
    );

    res.status(200).json({
      status: "success",
      message:
        remainingDays > 0
          ? "Cash-out value calculated successfully"
          : "You have no accrued leave available for cash-out at this time",
      data: {
        employee_id: employeeId,
        fiscal_year: fiscalYear,
        accrued_days: accrualResult.accruedDays,
        used_days: usedDays,
        pending_days: pendingDays,
        remaining_days: remainingDays,
        eligible_days: cashOut.eligibleDays,
        is_eligible: remainingDays > 0,
        monthly_salary: monthlySalary,
        daily_rate: cashOut.dailyRate,
        cash_value: cashOut.roundedValue,
        settings: {
          salary_divisor: settings.encashment_salary_divisor,
          max_days: settings.max_encashment_days,
          rounding: settings.encashment_rounding,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request leave cash-out
 */
export const requestCashOut = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;

    if (!companyId || !employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const { days_to_cash_out } = req.body;

    if (!days_to_cash_out || days_to_cash_out <= 0) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide a valid number of days to cash out",
      });
    }

    // Get leave settings
    const leaveSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });

    // Cast to any to suppress TS errors
    const settings = leaveSettings as any;

    if (!settings?.enable_encashment) {
      return res.status(400).json({
        status: "fail",
        message: "Leave encashment is not enabled for this company",
      });
    }

    // Check max encashment days
    if (
      settings.max_encashment_days &&
      days_to_cash_out > settings.max_encashment_days
    ) {
      return res.status(400).json({
        status: "fail",
        message: `Cannot cash out more than ${settings.max_encashment_days} days`,
      });
    }

    // Get employee with salary
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
      include: {
        employments: {
          where: { is_active: true },
          select: {
            start_date: true,
            gross_salary: true,
          },
          take: 1,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    const monthlySalary = Number(employee.employments[0]?.gross_salary ?? 0);
    if (monthlySalary <= 0) {
      return res.status(400).json({
        status: "fail",
        message: "Employee salary information not available",
      });
    }

    // Get annual leave type
    const fiscalYear = await getFiscalYear(companyId);
    const annualLeaveType = await prisma.leaveType.findFirst({
      where: {
        company_id: companyId,
        code: "ANNUAL",
      },
    });

    if (!annualLeaveType) {
      return res.status(404).json({
        status: "fail",
        message: "Annual leave type not found",
      });
    }

    // Calculate remaining days using leave type specific settings
    const hireDate = employee.employments[0]?.start_date ?? new Date();
    const accrualResult = calculateAccruedBalance(
      hireDate,
      new Date(),
      annualLeaveType.default_allowance_days || 16,
      settings.accrual_divisor || 365,
      settings.fiscal_year_start_month || 1,
      annualLeaveType.incremental_period_years || 2,
      annualLeaveType.incremental_days_per_year || 1,
      annualLeaveType.max_accrual_limit || null,
      (settings.accrual_basis as any) || "ANNIVERSARY"
    );

    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        employee_id_leave_type_id_fiscal_year: {
          employee_id: employeeId,
          leave_type_id: annualLeaveType.id,
          fiscal_year: fiscalYear,
        },
      },
    });

    const usedDays = Number(leaveBalance?.used_days ?? 0);
    const pendingDays = Number(leaveBalance?.pending_days ?? 0);
    const remainingDays = Math.max(
      0,
      accrualResult.accruedDays - usedDays - pendingDays
    );

    if (days_to_cash_out > remainingDays) {
      return res.status(400).json({
        status: "fail",
        message: `Cannot cash out more days than available. Available: ${remainingDays.toFixed(
          2
        )} days`,
      });
    }

    // Check for existing pending cash-out request
    const existingRequest = await prisma.leaveCashOut.findFirst({
      where: {
        employee_id: employeeId,
        company_id: companyId,
        fiscal_year: fiscalYear,
        status: "PENDING",
      },
    });

    if (existingRequest) {
      return res.status(400).json({
        status: "fail",
        message:
          "You already have a pending cash-out request for this fiscal year",
      });
    }

    // Calculate cash value
    const cashOut = calculateLeaveCashValue(
      days_to_cash_out,
      monthlySalary,
      settings.encashment_salary_divisor ?? 30,
      null,
      (settings.encashment_rounding as "ROUND" | "FLOOR" | "CEIL") ?? "ROUND"
    );

    // Create cash-out request
    const cashOutRequest = await prisma.leaveCashOut.create({
      data: {
        employee_id: employeeId,
        company_id: companyId,
        leave_type_id: annualLeaveType.id,
        fiscal_year: fiscalYear,
        days_cashed_out: days_to_cash_out,
        cash_value: cashOut.roundedValue,
        monthly_salary: monthlySalary,
        salary_divisor: settings.encashment_salary_divisor ?? 30,
        status: "PENDING",
      },
      include: {
        leaveType: {
          select: { name: true, code: true },
        },
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(201).json({
      status: "success",
      message: "Cash-out request submitted successfully",
      data: { cashOutRequest },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get cash-out requests for current employee
 */
export const getMyCashOutRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;

    if (!companyId || !employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const requests = await prisma.leaveCashOut.findMany({
      where: {
        employee_id: employeeId,
        company_id: companyId,
      },
      include: {
        leaveType: {
          select: { name: true, code: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({
      status: "success",
      message: "Cash-out requests fetched successfully",
      data: { requests },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all pending cash-out requests (Admin/HR)
 */
export const getAllCashOutRequests = async (
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

    const status = req.query.status as string | undefined;
    const fiscalYear = req.query.fiscal_year
      ? Number(req.query.fiscal_year)
      : undefined;

    // Advanced filters
    const departmentId = req.query.department_id as string;
    const jobTitleId = req.query.job_title_id as string;
    const gender = req.query.gender as string;
    const search = req.query.search as string;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      company_id: companyId,
    };

    if (status) {
      where.status = status;
    }

    if (fiscalYear) {
      where.fiscal_year = fiscalYear;
    }

    // Build employee filter for nested relation
    const employeeFilter: any = {};

    if (departmentId) {
      employeeFilter.employments = {
        some: {
          is_active: true,
          department_id: Number(departmentId),
        },
      };
    }

    if (jobTitleId) {
      employeeFilter.employments = {
        some: {
          ...(employeeFilter.employments?.some || { is_active: true }),
          job_title_id: Number(jobTitleId),
        },
      };
    }

    if (gender) {
      const normalizedGender = gender.trim().toLowerCase();
      if (normalizedGender === "male" || normalizedGender === "m") {
        employeeFilter.gender = { in: ["Male", "M", "male", "m"] };
      } else if (normalizedGender === "female" || normalizedGender === "f") {
        employeeFilter.gender = { in: ["Female", "F", "female", "f"] };
      }
    }

    if (search) {
      employeeFilter.full_name = {
        contains: search,
        mode: "insensitive",
      };
    }

    if (Object.keys(employeeFilter).length > 0) {
      where.employee = employeeFilter;
    }

    const [requests, total] = await Promise.all([
      prisma.leaveCashOut.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              gender: true,
              employments: {
                where: { is_active: true },
                select: {
                  department: { select: { id: true, name: true } },
                  jobTitle: { select: { id: true, title: true } },
                },
                take: 1,
              },
            },
          },
          leaveType: {
            select: { name: true, code: true },
          },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.leaveCashOut.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Cash-out requests fetched successfully",
      data: {
        requests,
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

/**
 * Approve cash-out request (Admin/HR)
 */
export const approveCashOut = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const approverId = req.user?.employee_id;

    if (!companyId || !approverId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const request = await prisma.leaveCashOut.findFirst({
      where: {
        id: Number(id),
        company_id: companyId,
      },
    });

    if (!request) {
      return res.status(404).json({
        status: "fail",
        message: "Cash-out request not found",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        status: "fail",
        message: `Cannot approve request with status: ${request.status}`,
      });
    }

    // Update request status
    const updatedRequest = await prisma.leaveCashOut.update({
      where: { id: Number(id) },
      data: {
        status: "APPROVED",
        approved_by: approverId,
        approved_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        employee: {
          select: { id: true, full_name: true },
        },
        leaveType: {
          select: { name: true, code: true },
        },
      },
    });

    // Update leave balance - deduct cashed out days
    await prisma.leaveBalance.updateMany({
      where: {
        employee_id: request.employee_id,
        leave_type_id: request.leave_type_id,
        fiscal_year: request.fiscal_year,
      },
      data: {
        used_days: {
          increment: Number(request.days_cashed_out),
        },
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Cash-out request approved successfully",
      data: { cashOutRequest: updatedRequest },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject cash-out request (Admin/HR)
 */
export const rejectCashOut = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const approverId = req.user?.employee_id;

    if (!companyId || !approverId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const { rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide a rejection reason",
      });
    }

    const request = await prisma.leaveCashOut.findFirst({
      where: {
        id: Number(id),
        company_id: companyId,
      },
    });

    if (!request) {
      return res.status(404).json({
        status: "fail",
        message: "Cash-out request not found",
      });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        status: "fail",
        message: `Cannot reject request with status: ${request.status}`,
      });
    }

    const updatedRequest = await prisma.leaveCashOut.update({
      where: { id: Number(id) },
      data: {
        status: "REJECTED",
        approved_by: approverId,
        approved_at: new Date(),
        updated_at: new Date(),
      },
      include: {
        employee: {
          select: { id: true, full_name: true },
        },
        leaveType: {
          select: { name: true, code: true },
        },
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Cash-out request rejected",
      data: { cashOutRequest: updatedRequest },
    });
  } catch (error) {
    next(error);
  }
};
