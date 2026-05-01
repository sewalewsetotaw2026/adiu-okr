import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { RoleNames, SUPERADMIN_VARIANTS } from "src/utils/roleConstants";
import {
  calculateLeaveEntitlement,
  calculateYearsOfService,
  getFiscalYear,
  calculateExpiryDate,
  calculateAccruedBalance,
  calculateLeaveCashValue,
  AccruedBalanceResult,
  calculateDynamicLeaveBalance,
  calculateDbValueForTargetBalance,
  normalizeAccrualBasis,
} from "src/utils/leaveUtils";
import { sendEmail } from "src/utils/email";
import { redisService } from "src/services/redisService";

const round2 = (value: number): number => Number(value.toFixed(2));
const toNum = (v: any) => {
  if (v && typeof v === 'object' && 'toNumber' in v) return v.toNumber();
  return Number(v ?? 0);
};

/**
 * Unified helper to compute the effective leave balance for a single balance record.
 * This should be used consistently across all leave balance APIs.
 */
const computeEffectiveLeaveBalance = (
  leaveType: any,
  dbBalance: any,
  hireDate: Date,
  settings: any,
  monthlySalary: number = 0
) => {
  // Use the central dynamic calculation logic
  const dynamic = calculateDynamicLeaveBalance(
    leaveType,
    dbBalance,
    hireDate,
    settings
  );

  // Calculate cash-out value if encashment is enabled
  let cashOutInfo = null;
  const enableEncashment = settings?.enable_encashment ?? false;
  const isAnnualLeave = leaveType.code === "ANNUAL";

  if (enableEncashment && isAnnualLeave && monthlySalary > 0) {
    const encashmentDivisor = settings?.encashment_salary_divisor ?? 30;
    const maxEncashmentDays = settings?.max_encashment_days ?? null;
    const rounding = (settings?.encashment_rounding as "ROUND" | "FLOOR" | "CEIL") ?? "ROUND";

    const cashOut = calculateLeaveCashValue(
      dynamic.remainingDays,
      monthlySalary,
      encashmentDivisor,
      maxEncashmentDays,
      rounding
    );
    cashOutInfo = {
      eligible_days: cashOut.eligibleDays,
      daily_rate: cashOut.dailyRate,
      cash_value: cashOut.roundedValue,
      currency: "ETB",
    };
  }

  // Map to the standardized response format (snake_case for frontend)
  return {
    ...dbBalance,
    ...dynamic, // camelCase properties for internal use if needed
    total_entitlement: dynamic.totalEntitlement,
    used_days: dynamic.usedDays,
    pending_days: dynamic.pendingDays,
    remaining_days: dynamic.remainingDays,
    accrual_details: dynamic.accrualDetails ? {
      is_gradual_accrual: dynamic.accrualDetails.isAccrualBased,
      daily_rate: dynamic.accrualDetails.dailyRate,
      accrued_days_current_year: dynamic.accrualDetails.accruedDays,
      carried_over_days: dynamic.accrualDetails.openingBalance,
      days_worked: dynamic.accrualDetails.daysInFiscalYear,
      annual_entitlement: dynamic.accrualDetails.annualEntitlement,
      tenure_bonus_days: dynamic.accrualDetails.tenureBonusDays || 0,
      base_entitlement: dynamic.accrualDetails.baseDays || 0,
      simulated_carry_over: dynamic.accrualDetails.simulatedCarryOver,
      total_service_days: dynamic.accrualDetails.totalServiceDays,
      years_of_service: dynamic.accrualDetails.yearsOfService,
      months_worked: dynamic.accrualDetails.monthsWorked,
      accrual_frequency: dynamic.accrualDetails.accrualFrequency,
    } : undefined,
    cash_out: cashOutInfo,
  };
};

/**
 * Fetches and reconciles leave balances for an employee, ensuring all applicable leave types have a balance record.
 * This is the internal source of truth for "Current State" of an employee's leave.
 */
const getInternalEmployeeBalances = async (
  companyId: number,
  employeeId: string,
  fiscalYear: number,
  settings: any
) => {
  // 1. Get employee details
  const employee = await prisma.employee.findUnique({
    where: { id_company_id: { id: employeeId, company_id: companyId } },
    include: {
      employments: {
        where: { is_active: true },
        select: { start_date: true, gross_salary: true },
        take: 1,
      },
    },
  });

  if (!employee) return null;

  const hireDate = employee.employments[0]?.start_date ?? new Date();
  const monthlySalary = Number(employee.employments[0]?.gross_salary ?? 0);

  // 2. Get applicable leave types
  const normalizeGender = (g: string | null | undefined) => {
    if (!g) return null;
    const n = g.trim().toUpperCase();
    return (n === "M" || n === "MALE") ? "Male" : (n === "F" || n === "FEMALE") ? "Female" : g;
  };
  const gender = normalizeGender(employee.gender);

  const leaveTypes = await prisma.leaveType.findMany({
    where: {
      company_id: companyId,
      OR: gender ? [{ applicable_gender: "All" }, { applicable_gender: gender }] : [{ applicable_gender: "All" }, { applicable_gender: "Male" }, { applicable_gender: "Female" }],
    },
    orderBy: { name: "asc" },
  });

  // 3. Get existing balances
  const existingBalances = await prisma.leaveBalance.findMany({
    where: { employee_id: employeeId, company_id: companyId, fiscal_year: fiscalYear },
    include: { leaveType: true },
  });

  const balanceMap = new Map(existingBalances.map((b) => [b.leave_type_id, b]));

  // 4. Calculate/Reconcile balances
  const balances = await Promise.all(
    leaveTypes.map(async (leaveType) => {
      let balance = balanceMap.get(leaveType.id);
      const dynamic = calculateDynamicLeaveBalance(leaveType, balance ?? null, hireDate, settings);

      // Initialize balance in DB if missing (Self-healing/Initialization)
      if (!balance) {
        try {
          const initialEntitlement = leaveType.is_accrual_based && dynamic.accrualDetails
            ? dynamic.accrualDetails.openingBalance
            : dynamic.totalEntitlement;

          balance = await prisma.leaveBalance.create({
            data: {
              employee_id: employeeId,
              company_id: companyId,
              leave_type_id: leaveType.id,
              fiscal_year: fiscalYear,
              total_entitlement: initialEntitlement,
              used_days: 0,
              pending_days: 0,
              remaining_days: dynamic.remainingDays,
              expiry_date: leaveType.carry_over_expiry_months
                ? calculateExpiryDate(fiscalYear, leaveType.carry_over_expiry_months, settings?.fiscal_year_start_month ?? 1, settings?.accrual_basis ?? "ANNIVERSARY", hireDate)
                : null,
            },
            include: { leaveType: true },
          });
        } catch (e: any) {
          if (e.code === 'P2002') {
            balance = await prisma.leaveBalance.findUnique({
              where: { employee_id_leave_type_id_fiscal_year: { employee_id: employeeId, leave_type_id: leaveType.id, fiscal_year: fiscalYear } },
              include: { leaveType: true },
            }) as any;
          }
        }
      }

      return computeEffectiveLeaveBalance(leaveType, balance, hireDate, settings, monthlySalary);
    })
  );

  return balances;
};

/**
 * Optimized helper to get employee balances with Redis caching.
 */
const getEmployeeLeaveBalancesWithCaching = async (
  companyId: number,
  employeeId: string,
  fiscalYear: number,
  settings: any
) => {
  const cacheKey = `company:${companyId}:leave_balance:${employeeId}:${fiscalYear}`;

  // Try cache first
  const cached = await redisService.get<any[]>(cacheKey);
  if (cached) return cached;

  // Calculate and store
  const balances = await getInternalEmployeeBalances(companyId, employeeId, fiscalYear, settings);
  if (balances) {
    await redisService.set(cacheKey, balances, 3600); // 1 hour TTL
  }

  return balances;
};

/**
 * Get leave balance for the current employee
 *
 * IMPORTANT: For Annual Leave, uses GRADUAL ACCRUAL based on company settings.
 * Daily accrual formula: daily_leave = annual_entitlement / accrual_divisor
 *
 * Other leave types use standard entitlement (full amount available when eligible)
 */
export const getMyLeaveBalance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;

    if (!companyId || !employeeId) {
      return res.status(400).json({ status: "fail", message: "Company ID or Employee ID not found" });
    }

    const fiscalYear = req.query.year
      ? Number(req.query.year)
      : await getFiscalYear(companyId);
    const leaveSettings = await prisma.leaveSettings.findUnique({ where: { company_id: companyId } });
    const settings = leaveSettings as any;

    const balances = await getEmployeeLeaveBalancesWithCaching(companyId, employeeId, fiscalYear, settings);

    if (!balances) {
      return res.status(404).json({ status: "fail", message: "Employee not found or balances could not be calculated" });
    }

    res.status(200).json({
      status: "success",
      message: "Leave balance fetched successfully",
      data: {
        fiscal_year: fiscalYear,
        accrual_settings: {
          base_days: settings?.annual_leave_base_days ?? 16,
          divisor: settings?.accrual_divisor ?? 365,
          frequency: settings?.accrual_frequency ?? "DAILY",
          increment_period_years: settings?.increment_period_years ?? 2,
          increment_amount: settings?.increment_amount ?? 1,
          max_cap: settings?.max_annual_leave_cap ?? null,
          encashment_enabled: settings?.enable_encashment ?? false,
        },
        balances,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leave balance for a specific employee (Admin/HR)
 */
export const getEmployeeLeaveBalance = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { employeeId } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId || !employeeId) {
      return res.status(400).json({ status: "fail", message: "Company ID or Employee ID not found" });
    }

    const fiscalYear = req.query.year ? Number(req.query.year) : await getFiscalYear(companyId);
    const leaveSettings = await prisma.leaveSettings.findUnique({ where: { company_id: companyId } });
    const settings = leaveSettings as any;

    const balances = await getEmployeeLeaveBalancesWithCaching(companyId, employeeId, fiscalYear, settings);

    if (!balances) {
      return res.status(404).json({ status: "fail", message: "Employee not found or balances could not be calculated" });
    }

    res.status(200).json({
      status: "success",
      message: "Employee leave balance fetched successfully",
      data: {
        fiscal_year: fiscalYear,
        balances,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all employees' leave balances (Admin/HR dashboard)
 */
export const getAllEmployeesLeaveBalance = async (
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

    const year = req.query.year
      ? Number(req.query.year)
      : await getFiscalYear(companyId);

    const leaveSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });
    const settings = leaveSettings as any;

    const leaveTypeId = req.query.leave_type_id as string;
    const departmentId = req.query.department_id as string;
    // Advanced filters
    const jobTitleId = req.query.job_title_id as string;
    const gender = req.query.gender as string;
    const managerId = req.query.manager_id as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || "full_name";
    const order = (req.query.order as string) || "asc";

    // Build where clause
    const where: any = {
      company_id: companyId,
      employments: {
        some: { is_active: true },
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

    // Department filter
    if (departmentId) {
      where.employments.some.department_id = Number(departmentId);
    }

    // Job title filter
    if (jobTitleId) {
      where.employments.some = {
        ...(where.employments.some || { is_active: true }),
        job_title_id: Number(jobTitleId),
      };
    }

    // Manager filter
    if (managerId) {
      where.employments.some = {
        ...(where.employments.some || { is_active: true }),
        manager_id: managerId,
      };
    }

    // Gender filter
    if (gender) {
      const normalizedGender = gender.trim().toLowerCase();
      if (normalizedGender === "male" || normalizedGender === "m") {
        where.gender = { in: ["Male", "M", "male", "m"] };
      } else if (normalizedGender === "female" || normalizedGender === "f") {
        where.gender = { in: ["Female", "F", "female", "f"] };
      }
    }

    // Search filter
    if (search) {
      where.full_name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Valid sorts
    const validSortFields = ["id", "full_name", "gender", "date_of_birth", "created_at", "updated_at", "remaining_days"];
    const isBalanceSort = sortBy === "remaining_days";
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "full_name";

    let employees: any[] = [];
    let total = 0;

    if (isBalanceSort && leaveTypeId) {
      // If sorting by remaining_days, we must query LeaveBalance directly
      // Build the employee where clause to use inside the relation filter
      const employeeWhere = { ...where };
      delete employeeWhere.company_id; // LeaveBalance has its own company_id

      const [balances, count] = await Promise.all([
        prisma.leaveBalance.findMany({
          where: {
            company_id: companyId,
            fiscal_year: year,
            leave_type_id: Number(leaveTypeId),
            employee: employeeWhere,
          },
          include: {
            employee: {
              select: {
                id: true,
                full_name: true,
                gender: true,
                employments: {
                  where: { is_active: true },
                  select: {
                    start_date: true,
                    gross_salary: true,
                    department: { select: { id: true, name: true } },
                    jobTitle: { select: { id: true, title: true, level: true } },
                  },
                  take: 1,
                },
              },
            },
            leaveType: true,
          },
          orderBy: { remaining_days: order as any },
          skip,
          take: limit,
        }),
        prisma.leaveBalance.count({
          where: {
            company_id: companyId,
            fiscal_year: year,
            leave_type_id: Number(leaveTypeId),
            employee: employeeWhere,
          },
        }),
      ]);

      total = count;
      // Map back to the expected employee structure, injecting the single sorted balance
      employees = balances.map((b) => ({
        ...b.employee,
        leaveBalances: [b],
      }));
    } else {
      // Standard employee-based query
      // If sorting by remaining_days but no leave type selected, fallback to name sort
      const finalSort = isBalanceSort ? "full_name" : safeSortBy;

      const [fetchedEmployees, count] = await Promise.all([
        prisma.employee.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [finalSort]: order },
          select: {
            id: true,
            full_name: true,
            gender: true,
            employments: {
              where: { is_active: true },
              select: {
                start_date: true,
                gross_salary: true,
                department: { select: { id: true, name: true } },
                jobTitle: { select: { id: true, title: true, level: true } },
              },
              take: 1,
            },
            leaveBalances: {
              where: {
                fiscal_year: year,
                leave_type_id: leaveTypeId ? Number(leaveTypeId) : undefined,
              },
              include: {
                leaveType: true,
              },
            },
          },
        }),
        prisma.employee.count({ where }),
      ]);
      employees = fetchedEmployees;
      total = count;
    }

    const normalizedEmployees = await Promise.all(employees.map(async (employee) => {
      const hireDate = employee.employments[0]?.start_date ?? new Date();

      // Use the cached/dynamic calculation for EACH employee to ensure consistency
      // Note: In a list view, this will perform multiple Redis lookups, which is fine.
      let balances = await getEmployeeLeaveBalancesWithCaching(
        companyId,
        employee.id,
        year,
        settings
      );

      // Post-filter by leave_type_id if specified (cache returns ALL leave types)
      if (leaveTypeId && balances) {
        balances = balances.filter(
          (b: any) => b.leave_type_id === Number(leaveTypeId)
        );
      }

      return {
        ...employee,
        leaveBalances: balances || [],
      };
    }));

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Employees leave balances fetched successfully",
      data: {
        fiscal_year: year,
        employees: normalizedEmployees,
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
 * Allocate leave for a specific employee for the year
 */
export const allocateLeaveForEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction
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

    const { fiscal_year, leave_type_id, total_entitlement, expiry_date } =
      req.body;

    // Get employee and their employment details
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
          select: { start_date: true },
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

    // Get leave type
    const leaveType = await prisma.leaveType.findFirst({
      where: {
        id: Number(leave_type_id),
        company_id: companyId,
      },
    });

    if (!leaveType) {
      return res.status(404).json({
        status: "fail",
        message: "Leave type not found",
      });
    }

    const targetYear = fiscal_year || (await getFiscalYear(companyId));

    const round2 = (value: number): number => Number(value.toFixed(2));

    // Calculate entitlement if not provided
    let entitlement = total_entitlement;
    if (!entitlement && employee.employments[0]) {
      const yearsOfService = calculateYearsOfService(
        employee.employments[0].start_date
      );
      entitlement = calculateLeaveEntitlement(
        leaveType.default_allowance_days,
        leaveType.incremental_days_per_year || 0,
        yearsOfService,
        leaveType.max_accrual_limit
      );
    }

    // Calculate expiry date if not provided
    let expiryDateValue = expiry_date ? new Date(expiry_date) : null;
    const leaveSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });
    const settings = leaveSettings as any;
    const hireDate = employee.employments[0]?.start_date;

    if (!expiryDateValue && leaveType.carry_over_expiry_months) {
      expiryDateValue = calculateExpiryDate(
        targetYear,
        leaveType.carry_over_expiry_months,
        settings?.fiscal_year_start_month ?? 1,
        settings?.accrual_basis ?? "ANNIVERSARY",
        hireDate
      );
    }


    // Keep remaining_days consistent even when updating an existing balance.
    const existingBalance = await prisma.leaveBalance.findUnique({
      where: {
        employee_id_leave_type_id_fiscal_year: {
          employee_id: employeeId,
          leave_type_id: Number(leave_type_id),
          fiscal_year: targetYear,
        },
      },
      select: {
        used_days: true,
        pending_days: true,
      },
    });

    const usedDays = Number(existingBalance?.used_days ?? 0);
    const pendingDays = Number(existingBalance?.pending_days ?? 0);
    const remainingDays = Math.max(
      0,
      round2(Number(entitlement) - usedDays - pendingDays)
    );

    // Upsert the leave balance
    const balance = await prisma.leaveBalance.upsert({
      where: {
        employee_id_leave_type_id_fiscal_year: {
          employee_id: employeeId,
          leave_type_id: Number(leave_type_id),
          fiscal_year: targetYear,
        },
      },
      update: {
        total_entitlement: entitlement,
        remaining_days: remainingDays,
        expiry_date: expiryDateValue,
        updated_at: new Date(),
      },
      create: {
        employee_id: employeeId,
        company_id: companyId,
        leave_type_id: Number(leave_type_id),
        fiscal_year: targetYear,
        total_entitlement: entitlement,
        used_days: 0,
        pending_days: 0,
        remaining_days: round2(Number(entitlement)),
        expiry_date: expiryDateValue,
      },
      include: {
        leaveType: true,
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:leave_balance:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_balance_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_balance_my:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_stats:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Leave allocated successfully",
      data: { balance },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk allocate leave for all employees for the year
 */
export const bulkAllocateLeave = async (
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

    const { fiscal_year, leave_type_id } = req.body;

    if (!leave_type_id) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide leave_type_id",
      });
    }

    // Get leave type
    const leaveType = await prisma.leaveType.findFirst({
      where: {
        id: Number(leave_type_id),
        company_id: companyId,
      },
    });

    if (!leaveType) {
      return res.status(404).json({
        status: "fail",
        message: "Leave type not found",
      });
    }

    const targetYear = fiscal_year || (await getFiscalYear(companyId));

    // Get all active employees
    const employees = await prisma.employee.findMany({
      where: {
        company_id: companyId,
        // Check gender eligibility
        ...(leaveType.applicable_gender !== "All" && {
          gender: leaveType.applicable_gender,
        }),
        employments: {
          some: { is_active: true },
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
      include: {
        employments: {
          where: { is_active: true },
          select: { start_date: true },
          take: 1,
        },
      },
    });

    let created = 0;
    let updated = 0;

    for (const employee of employees) {
      if (!employee.employments[0]) continue;

      const yearsOfService = calculateYearsOfService(
        employee.employments[0].start_date
      );

      const entitlement = calculateLeaveEntitlement(
        leaveType.default_allowance_days,
        leaveType.incremental_days_per_year || 0,
        yearsOfService,
        leaveType.max_accrual_limit
      );

      const expiryDate = leaveType.carry_over_expiry_months
        ? calculateExpiryDate(targetYear, leaveType.carry_over_expiry_months)
        : null;

      // Check if balance exists
      const existing = await prisma.leaveBalance.findUnique({
        where: {
          employee_id_leave_type_id_fiscal_year: {
            employee_id: employee.id,
            leave_type_id: Number(leave_type_id),
            fiscal_year: targetYear,
          },
        },
      });

      if (existing) {
        await prisma.leaveBalance.update({
          where: { id: existing.id },
          data: {
            total_entitlement: entitlement,
            expiry_date: expiryDate,
            updated_at: new Date(),
          },
        });
        updated++;
      } else {
        await prisma.leaveBalance.create({
          data: {
            employee_id: employee.id,
            company_id: companyId,
            leave_type_id: Number(leave_type_id),
            fiscal_year: targetYear,
            total_entitlement: entitlement,
            used_days: 0,
            pending_days: 0,
            expiry_date: expiryDate,
          },
        });
        created++;
      }
    }

    // Invalidate Cache
    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:leave_balance:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_balance_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_balance_my:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_stats:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: `Leave allocated for ${employees.length} employees (${created} created, ${updated} updated)`,
      data: {
        total_employees: employees.length,
        created,
        updated,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Adjust leave balance manually (Admin)
 * 
 * Supports three modes:
 * - adjustment_type: "add" - Add days to opening balance
 * - adjustment_type: "subtract" - Subtract days from opening balance
 * - adjustment_type: "set" - Set target balance (Option B: DB = Target - Accrued)
 */
export const adjustLeaveBalance = async (
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

    const { adjustment_days, adjustment_type, used_days_adjustment, used_days_adjustment_type, reason } = req.body;

    if (
      (adjustment_days === undefined || !adjustment_type) &&
      (used_days_adjustment === undefined || !used_days_adjustment_type)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide either adjustment_days/type or used_days_adjustment/type",
      });
    }

    // Get the balance with leave type and employee info
    const balance = await prisma.leaveBalance.findFirst({
      where: {
        id: Number(id),
        company_id: companyId,
      },
      include: {
        leaveType: true,
        employee: {
          include: {
            employments: {
              where: { is_active: true },
              select: { start_date: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!balance) {
      return res.status(404).json({
        status: "fail",
        message: "Leave balance not found",
      });
    }

    // Get company settings for accrual basis
    const leaveSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });

    const hireDate = balance.employee.employments[0]?.start_date ?? new Date();
    const round2 = (value: number): number => Number(value.toFixed(2));

    // --- 1. Process Allowance (Manual Adjustment) ---
    // Handle potential Decimal object from Prisma
    let newManualAdjustment = 0;
    if (balance.manual_adjustment_days !== null && balance.manual_adjustment_days !== undefined) {
      const val: any = balance.manual_adjustment_days;
      newManualAdjustment = (typeof val === 'object' && 'toNumber' in val) ? val.toNumber() : Number(val);
    }

    if (adjustment_days !== undefined && adjustment_type) {
      const adjustmentValue = Number(adjustment_days);

      if (adjustment_type === "set") {
        const tempDynamic = calculateDynamicLeaveBalance(
          balance.leaveType,
          { ...balance, manual_adjustment_days: 0 },
          hireDate,
          leaveSettings
        );
        newManualAdjustment = adjustmentValue - tempDynamic.totalEntitlement;
      } else if (adjustment_type === "add") {
        newManualAdjustment += adjustmentValue;
      } else if (adjustment_type === "subtract") {
        newManualAdjustment -= adjustmentValue;
      } else {
        return res.status(400).json({
          status: "fail",
          message: "adjustment_type must be 'add', 'subtract', or 'set'",
        });
      }
    }

    // --- 2. Process Used Days ---
    let newUsedDays = 0;
    if (balance.used_days !== null && balance.used_days !== undefined) {
      const val: any = balance.used_days;
      newUsedDays = (typeof val === 'object' && 'toNumber' in val) ? val.toNumber() : Number(val);
    }

    if (used_days_adjustment !== undefined && used_days_adjustment_type) {
      const usedAdjustmentValue = Number(used_days_adjustment);

      if (used_days_adjustment_type === "set") {
        newUsedDays = usedAdjustmentValue;
      } else if (used_days_adjustment_type === "add") {
        newUsedDays += usedAdjustmentValue;
      } else if (used_days_adjustment_type === "subtract") {
        newUsedDays -= usedAdjustmentValue;
      } else {
        return res.status(400).json({
          status: "fail",
          message: "used_days_adjustment_type must be 'add', 'subtract', or 'set'",
        });
      }

      // Prevent used days from accidentally going strictly negative
      newUsedDays = Math.max(0, newUsedDays);
    }

    // --- 3. Calculate Final Effective Balance ---
    // Calculate what the effective balance will be with both new parameters
    const dynamicResult = calculateDynamicLeaveBalance(
      balance.leaveType,
      {
        ...balance,
        manual_adjustment_days: newManualAdjustment,
        used_days: newUsedDays,
      },
      hireDate,
      leaveSettings
    );

    // Validate if resulting balance is negative (optional, but good practice)
    if (dynamicResult.remainingDays < 0) {
      // Decide if we want to block this or allow it. 
      // For now, let's allow negative balances (overdraft) if user explicitly requests it,
      // OR we can clamp it. The user request said "make sure values never gets bellow 0".
      // So we should probably clamp the manual adjustment if it results in < 0 remaining?
      // OR, just return an error saying "Insufficient balance".

      // Strategy: Allow the subtraction but check if remaining < 0
      return res.status(400).json({
        status: "fail",
        message: `Cannot subtract days. Resulting balance would be negative (${dynamicResult.remainingDays} days).`
      });
    }

    const updatedBalance = await prisma.leaveBalance.update({
      where: { id: Number(id) },
      data: {
        manual_adjustment_days: round2(newManualAdjustment),
        used_days: round2(newUsedDays),
        // We still store the snapshot of total/remaining for easy querying/sorting without recalc
        total_entitlement: round2(dynamicResult.totalEntitlement),
        remaining_days: round2(dynamicResult.remainingDays),
        updated_at: new Date(),
      },
      include: {
        leaveType: true,
        employee: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Build response message
    let message = "Leave balance adjusted successfully.";
    if (adjustment_days !== undefined && adjustment_type) {
      if (adjustment_type === "set") {
        message = `Leave allowance set to ${adjustment_days} days.`;
      } else {
        message = `Leave allowance ${adjustment_type === "add" ? "increased" : "decreased"} by ${adjustment_days} days.`;
      }
    }
    if (used_days_adjustment !== undefined && used_days_adjustment_type) {
      const usedMsg = used_days_adjustment_type === "set"
        ? `Used days set to ${used_days_adjustment}.`
        : `Used days ${used_days_adjustment_type === "add" ? "increased" : "decreased"} by ${used_days_adjustment}.`;
      message = (adjustment_days !== undefined && adjustment_type) ? `${message} ${usedMsg}` : usedMsg;
    }

    redisService.delByPattern(`company:${companyId}:leave_balance:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_balance_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_balance_my:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_stats:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message,
      data: {
        balance: {
          ...updatedBalance,
          // Include dynamic calculation details
          effective_total: dynamicResult.totalEntitlement,
          effective_remaining: dynamicResult.remainingDays,
          accrual_details: dynamicResult.accrualDetails,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leave balances that are about to expire (2-year rule notification)
 */


/**
 * Carry over unused leave from previous year
 */
export const carryOverLeave = async (
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

    const { from_year, to_year, leave_type_id } = req.body;

    if (!from_year || !to_year || !leave_type_id) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide from_year, to_year, and leave_type_id",
      });
    }

    // Get leave type to check if carry over is allowed
    const leaveType = await prisma.leaveType.findFirst({
      where: {
        id: Number(leave_type_id),
        company_id: companyId,
      },
    });

    if (!leaveType) {
      return res.status(404).json({
        status: "fail",
        message: "Leave type not found",
      });
    }

    if (!leaveType.is_carry_over_allowed) {
      return res.status(400).json({
        status: "fail",
        message: "Carry over is not allowed for this leave type",
      });
    }

    // Get balances from previous year with remaining days
    const previousBalances = await prisma.leaveBalance.findMany({
      where: {
        company_id: companyId,
        leave_type_id: Number(leave_type_id),
        fiscal_year: Number(from_year),
        remaining_days: { gt: 0 },
        OR: [{ expiry_date: null }, { expiry_date: { gt: new Date() } }],
      },
    });

    let carriedOver = 0;

    for (const balance of previousBalances) {
      const remainingDays = Number(balance.remaining_days);

      // Add to next year's balance
      await prisma.leaveBalance.upsert({
        where: {
          employee_id_leave_type_id_fiscal_year: {
            employee_id: balance.employee_id,
            leave_type_id: Number(leave_type_id),
            fiscal_year: Number(to_year),
          },
        },
        update: {
          total_entitlement: {
            increment: remainingDays,
          },
        },
        create: {
          employee_id: balance.employee_id,
          company_id: companyId,
          leave_type_id: Number(leave_type_id),
          fiscal_year: Number(to_year),
          total_entitlement: remainingDays,
          used_days: 0,
          pending_days: 0,
          expiry_date: balance.expiry_date,
        },
      });

      carriedOver++;
    }

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:leave_balance:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_balance_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_balance_my:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_stats:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: `Carried over leave for ${carriedOver} employees from ${from_year} to ${to_year}`,
      data: { carried_over_count: carriedOver },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Notify employees with expiring leave balances
 * Triggered manually or by scheduler
 */
import { notifyLeaveExpiring } from "../services/leaveNotificationService";

/**
 * Get expiring leave balances
 * Supports filtering by threshold days, department, and leave type
 */
export const getExpiringLeaveBalances = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      days_threshold = 90,
      department_id,
      leave_type_id,
      page = 1,
      limit = 10
    } = req.query;

    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "Company ID missing" });
    }

    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + Number(days_threshold));

    const skip = (Number(page) - 1) * Number(limit);

    // Build query filters
    const where: any = {
      company_id: companyId,
      remaining_days: { gt: 0 },
      expiry_date: {
        gte: new Date(today.setHours(0, 0, 0, 0)), // From today (start of day)
        lte: thresholdDate
      }
    };

    if (leave_type_id) {
      where.leave_type_id = Number(leave_type_id);
    }

    if (department_id) {
      where.employee = {
        employments: {
          some: {
            department_id: Number(department_id),
            is_active: true
          }
        }
      };
    }

    const [balances, total] = await Promise.all([
      prisma.leaveBalance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              employments: {
                where: { is_active: true },
                select: {
                  department: { select: { name: true } },
                  jobTitle: { select: { title: true } }
                },
                take: 1
              }
            }
          },
          leaveType: { select: { name: true, code: true } }
        },
        orderBy: { expiry_date: "asc" },
        skip,
        take: Number(limit)
      }),
      prisma.leaveBalance.count({ where })
    ]);

    // Flatten structure for easier frontend consumption
    const formattedBalances = balances.map(b => ({
      id: b.id,
      employee: {
        id: b.employee.id,
        full_name: b.employee.full_name,
        department: b.employee.employments[0]?.department?.name,
        job_title: b.employee.employments[0]?.jobTitle?.title
      },
      leave_type: b.leaveType.name,
      leave_type_code: b.leaveType.code,
      remaining_days: b.remaining_days,
      expiry_date: b.expiry_date,
      days_until_expiry: b.expiry_date
        ? Math.ceil((new Date(b.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : 0
    }));

    res.status(200).json({
      status: "success",
      data: {
        balances: formattedBalances,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit))
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Notify employees with expiring leave balances
 * Triggered manually (with IDs) or by scheduler (generic check)
 */
export const notifyExpiringLeaves = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { balance_ids } = req.body;

    let processedCount = 0;

    if (balance_ids && Array.isArray(balance_ids) && balance_ids.length > 0) {
      // Manual trigger for specific balances
      console.log(`[LeaveNotification] Manual trigger for ${balance_ids.length} balances`);

      for (const id of balance_ids) {
        const balance = await prisma.leaveBalance.findUnique({
          where: { id: Number(id) }
        });

        if (balance && balance.expiry_date && Number(balance.remaining_days) > 0) {
          // Use the service function to ensure consistent logic, history, and delivery tracking
          await notifyLeaveExpiring(balance);
          processedCount++;
        }
      }
    } else {
      // Fallback to legacy/scheduler logic (if triggered without IDs)
      // Or strictly require IDs for this endpoint?
      // Let's allow default check if no IDs provided, but restricted to Admin usually.
      // For now, let's keep it safe and just support the explicit IDs or return error 
      if (!balance_ids) {
        return res.status(400).json({ status: "fail", message: "Please provide balance_ids to notify." });
      }
    }

    res.status(200).json({
      status: "success",
      message: `Triggered notifications for ${processedCount} balances`,
    });
  } catch (error) {
    next(error);
  }
};
