/**
 * Leave Management Utility Functions
 *
 * Handles working day calculations, leave entitlement computation,
 * and other leave-related business logic.
 */

import { prisma } from "src/lib/prisma";

/**
 * Check if a date is a Sunday
 */
export const isSunday = (date: Date): boolean => {
  return date.getDay() === 0;
};

/**
 * Check if a date is a Saturday
 */
export const isSaturday = (date: Date): boolean => {
  return date.getDay() === 6;
};

/**
 * Add days to a date
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Check if a date is a public holiday
 */
export const isHoliday = async (
  date: Date,
  companyId: number,
  holidayCache?: Date[]
): Promise<boolean> => {
  // If holiday cache is provided, use it
  if (holidayCache) {
    return holidayCache.some((h) => h.toDateString() === date.toDateString());
  }

  // Otherwise, query the database
  const year = date.getFullYear();
  const holiday = await prisma.publicHoliday.findFirst({
    where: {
      company_id: companyId,
      OR: [
        // Exact date match
        {
          holiday_date: date,
          is_recurring: false,
        },
        // Recurring holiday (match month and day)
        {
          is_recurring: true,
          holiday_date: {
            gte: new Date(year, date.getMonth(), date.getDate()),
            lt: new Date(year, date.getMonth(), date.getDate() + 1),
          },
        },
      ],
    },
  });

  return !!holiday;
};

/**
 * Get all holidays for a date range (for caching)
 */
export const getHolidaysInRange = async (
  companyId: number,
  startDate: Date,
  endDate: Date
): Promise<Date[]> => {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  const holidays = await prisma.publicHoliday.findMany({
    where: {
      company_id: companyId,
    },
  });

  const holidayDates: Date[] = [];

  for (const holiday of holidays) {
    if (holiday.is_recurring) {
      // For recurring holidays, add for each year in range
      for (let year = startYear; year <= endYear; year++) {
        const holidayDate = new Date(holiday.holiday_date);
        const recurringDate = new Date(
          year,
          holidayDate.getMonth(),
          holidayDate.getDate()
        );
        if (recurringDate >= startDate && recurringDate <= endDate) {
          holidayDates.push(recurringDate);
        }
      }
    } else {
      // For non-recurring, check if within range
      if (
        holiday.holiday_date >= startDate &&
        holiday.holiday_date <= endDate
      ) {
        holidayDates.push(holiday.holiday_date);
      }
    }
  }

  return holidayDates;
};

/**
 * Calculate working days between two dates
 * Based on 5.5-day work week (Mon-Fri full days, Saturday half day, Sunday off)
 * Excludes public holidays
 */
export const calculateWorkingDays = async (
  startDate: Date,
  endDate: Date,
  companyId: number,
  options?: {
    saturdayHalfDay?: boolean;
    sundayOff?: boolean;
    isCalendarDays?: boolean;
    isStartHalfDay?: boolean;
    isEndHalfDay?: boolean;
  }
): Promise<number> => {
  const saturdayHalfDay = options?.saturdayHalfDay ?? true;
  const sundayOff = options?.sundayOff ?? true;
  const isCalendarDays = options?.isCalendarDays ?? false;

  // Simple calendar days calculation (count all days)
  if (isCalendarDays) {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Inclusive of start date
  }

  // Get company leave settings for working day logic
  const leaveSettings = await prisma.leaveSettings.findUnique({
    where: { company_id: companyId },
  });

  const isSaturdayHalf = leaveSettings?.saturday_half_day ?? saturdayHalfDay;
  const isSundayOff = leaveSettings?.sunday_off ?? sundayOff;

  // Get holidays in range for caching
  const holidays = await getHolidaysInRange(companyId, startDate, endDate);

  let days = 0;
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const endThreshold = new Date(endDate);
  endThreshold.setHours(0, 0, 0, 0);

  while (current <= endThreshold) {
    const isHolidayDate = holidays.some(
      (h) => {
        const hd = new Date(h);
        hd.setHours(0, 0, 0, 0);
        return hd.getTime() === current.getTime();
      }
    );

    let dayValue = 0;

    if (isHolidayDate) {
      // Holiday - no work
    } else if (isSunday(current) && isSundayOff) {
      // Sunday off
    } else if (isSaturday(current)) {
      dayValue = isSaturdayHalf ? 0.5 : 1;
    } else {
      // Mon-Fri - full day
      dayValue = 1;
    }

    // Apply specific explicit half-day toggles requested by the user
    // Only apply if the day was originally going to be a full working day
    if (dayValue === 1) {
      if (options?.isStartHalfDay && current.getTime() === startDate.getTime()) {
        dayValue = 0.5;
      } else if (options?.isEndHalfDay && current.getTime() === endThreshold.getTime()) {
        dayValue = 0.5;
      }
    }

    days += dayValue;
    current = addDays(current, 1);
  }

  return days;
};

/**
 * Calculate return date (first working day after leave end)
 */
export const calculateReturnDate = async (
  endDate: Date,
  companyId: number
): Promise<Date> => {
  let returnDate = addDays(endDate, 1);

  // Get leave settings
  const leaveSettings = await prisma.leaveSettings.findUnique({
    where: { company_id: companyId },
  });

  const isSundayOff = leaveSettings?.sunday_off ?? true;

  // Skip weekends and holidays
  while (true) {
    const isHolidayDate = await isHoliday(returnDate, companyId);

    if (isHolidayDate || (isSunday(returnDate) && isSundayOff)) {
      returnDate = addDays(returnDate, 1);
    } else {
      break;
    }
  }

  return returnDate;
};

/**
 * Calculate leave entitlement for an employee
 *
 * For Annual Leave (per business requirements):
 * - First year: 16 working days (proportional if less than 1 year)
 * - After first year: +1 day for every 2 years of service
 *
 * @param baseDays - Base entitlement days (e.g., 16 for annual leave)
 * @param incrementalDays - Days to add per increment period (e.g., 1)
 * @param yearsOfService - Total years of service
 * @param incrementalPeriodYears - Years per increment (e.g., 2 for "every 2 years")
 * @param maxAccrualLimit - Maximum days that can accrue
 * @param monthsWorkedFirstYear - For proportional calculation in first year
 */
export const calculateLeaveEntitlement = (
  baseDays: number,
  incrementalDays: number,
  yearsOfService: number,
  maxAccrualLimit?: number | null,
  incrementalPeriodYears: number = 1,
  monthsWorkedFirstYear?: number
): number => {
  // For employees with less than 1 year of service, calculate proportional entitlement
  if (yearsOfService < 1 && monthsWorkedFirstYear !== undefined) {
    const proportionalDays = Math.round(
      (baseDays * monthsWorkedFirstYear) / 12
    );
    return Math.max(0, proportionalDays);
  }

  // For first year employees without month data, give full base
  if (yearsOfService <= 1) {
    return baseDays;
  }

  // Calculate incremental days based on period
  // Example: 3 years of service with 2-year period = 1 increment (years 2-3)
  const yearsAfterFirst = Math.max(0, yearsOfService - 1);
  const incrementPeriods = Math.floor(yearsAfterFirst / incrementalPeriodYears);
  let entitlement = baseDays + incrementPeriods * incrementalDays;

  // Apply max accrual limit if set
  if (maxAccrualLimit && entitlement > maxAccrualLimit) {
    entitlement = maxAccrualLimit;
  }

  return entitlement;
};

// ============================================================================
// GRADUAL LEAVE ACCRUAL FUNCTIONS
// ============================================================================

/**
 * Check if a year is a leap year
 */
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

/**
 * Get appropriate divisor based on configuration
 * Handles leap years when using 365/366
 */
export const getAccrualDivisor = (
  configuredDivisor: number,
  year: number,
  adjustForLeapYear: boolean = true
): number => {
  if (configuredDivisor === 365 && adjustForLeapYear && isLeapYear(year)) {
    return 366;
  }
  return configuredDivisor;
};

/**
 * Calculate daily leave accrual rate
 * @param annualEntitlement - Total annual leave days
 * @param divisor - Number of days to divide by (365, 360, or custom)
 */
export const calculateDailyAccrualRate = (
  annualEntitlement: number,
  divisor: number = 365
): number => {
  return annualEntitlement / divisor;
};

/**
 * Get the fiscal year start date based on company settings
 */
export const getFiscalYearStartDate = (
  fiscalYearStartMonth: number,
  referenceDate: Date = new Date()
): Date => {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1; // 1-indexed

  // If current month is before fiscal year start, we're in the fiscal year that started last year
  // Use UTC to ensure consistency check
  if (currentMonth < fiscalYearStartMonth) {
    return new Date(Date.UTC(currentYear - 1, fiscalYearStartMonth - 1, 1));
  }

  return new Date(Date.UTC(currentYear, fiscalYearStartMonth - 1, 1));
};

export type LeaveAccrualBasis = "ANNIVERSARY" | "CALENDAR_YEAR";

/**
 * Normalize accrual basis from various DB/UI formats to valid LeaveAccrualBasis.
 * Handles: "FISCAL_YEAR", "CALENDAR_YEAR", "Calendar Year", "Fiscal Year", "Anniversary", etc.
 * Defaults to "ANNIVERSARY" if input is unrecognized.
 */
export const normalizeAccrualBasis = (basis: string | null | undefined): LeaveAccrualBasis => {
  if (!basis) return "ANNIVERSARY";

  const normalized = basis.trim().toUpperCase().replace(/[\s_-]+/g, '_');

  // Map all fiscal/calendar year variants to CALENDAR_YEAR
  if (normalized.includes('FISCAL') || normalized.includes('CALENDAR')) {
    return "CALENDAR_YEAR";
  }

  // Anniversary variants
  if (normalized.includes('ANNIVERSARY')) {
    return "ANNIVERSARY";
  }

  // Default fallback
  return "ANNIVERSARY";
};

const getJoinDateAnniversaryForYear = (joinDate: Date, year: number): Date => {
  const month = joinDate.getUTCMonth();
  const day = joinDate.getUTCDate();

  // Handles dates like Feb 29 in non-leap years by snapping to last day of month.
  // Using Date.UTC to avoid timezone offsets causing date shifts
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getUTCMonth() !== month) {
    return new Date(Date.UTC(year, month + 1, 0));
  }
  return candidate;
};

/**
 * Get the start date of the current anniversary-based accrual year.
 * Example: join date Mar 15 → for Jan 12, 2026 the period starts Mar 15, 2025.
 */
export const getAnniversaryYearStartDate = (
  joinDate: Date,
  referenceDate: Date = new Date()
): Date => {
  const thisYearAnniversary = getJoinDateAnniversaryForYear(
    joinDate,
    referenceDate.getFullYear()
  );

  if (referenceDate < thisYearAnniversary) {
    return getJoinDateAnniversaryForYear(
      joinDate,
      referenceDate.getFullYear() - 1
    );
  }

  return thisYearAnniversary;
};

/**
 * Calculate precise years of service (with decimals) for an employee
 * Used for determining tenure-based entitlements
 */
export const calculatePreciseYearsOfService = (
  hireDate: Date,
  referenceDate: Date = new Date()
): number => {
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  const diffMs = referenceDate.getTime() - hireDate.getTime();
  return Math.max(0, diffMs / msPerYear);
};

/**
 * Calculate tenure-based annual entitlement
 * Every N years of service, add M days to base entitlement
 *
 * @param baseDays - Base annual leave days (e.g., 16)
 * @param yearsOfService - Total years of service
 * @param incrementPeriodYears - Years required for each increment (e.g., 2)
 * @param incrementAmount - Days added per increment cycle (e.g., 1)
 * @param maxCap - Maximum annual leave cap (optional)
 *
 * @example
 * // Employee with 5 years service, 2-year increment period, +1 day per period
 * // 5 years = 2 completed periods (years 0-1, 2-3) = 2 bonus days
 * // Total: 16 + 2 = 18 days
 */
export const calculateTenureEntitlement = (
  baseDays: number,
  yearsOfService: number,
  incrementPeriodYears: number = 2,
  incrementAmount: number = 1,
  maxCap?: number | null
): { entitlement: number; bonusDays: number; completedPeriods: number } => {
  // Completed periods = floor(years / period)
  // e.g., 5 years with 2-year period = 2 completed periods
  const completedPeriods = Math.floor(yearsOfService / incrementPeriodYears);
  const bonusDays = completedPeriods * incrementAmount;

  let entitlement = baseDays + bonusDays;

  // Apply max cap if specified
  if (maxCap && entitlement > maxCap) {
    entitlement = maxCap;
  }

  return { entitlement, bonusDays, completedPeriods };
};

export interface AccruedBalanceResult {
  accruedDays: number;
  daysInFiscalYear: number;
  dailyRate: number;
  fiscalYearStart: Date;
  annualEntitlement: number;
  tenureBonusDays: number;
  yearsOfService: number;
  monthsWorked?: number; // Added for monthly accrual frequency display
}

/**
 * Calculate accrued leave balance from fiscal year start (or join date) to reference date
 * This implements gradual accrual instead of upfront allocation
 *
 * @param joinDate - Employee's hire/join date
 * @param referenceDate - Date to calculate accrual up to (usually today)
 * @param baseDays - Base annual leave entitlement
 * @param divisor - Accrual divisor (365, 360, etc.)
 * @param fiscalYearStartMonth - Month when fiscal year starts (1-12)
 * @param incrementPeriodYears - Years required for tenure increment
 * @param incrementAmount - Days added per tenure period
 * @param maxCap - Maximum annual leave cap
 */
export const calculateAccruedBalance = (
  joinDate: Date,
  referenceDate: Date,
  baseDays: number,
  divisor: number = 365,
  fiscalYearStartMonth: number = 1,
  incrementPeriodYears: number = 2,
  incrementAmount: number = 1,
  maxCap?: number | null,
  accrualBasis?: LeaveAccrualBasis | string,
  accrualFrequency: string = "DAILY"
): AccruedBalanceResult => {
  // Normalize the accrual basis first to handle various DB/UI formats
  const normalizedBasis = normalizeAccrualBasis(accrualBasis);

  // Determine the accrual period start.
  // - CALENDAR_YEAR: anchored to company fiscal year start month
  // - ANNIVERSARY: anchored to employee join-date anniversary
  const fiscalYearStart =
    normalizedBasis === "ANNIVERSARY"
      ? getAnniversaryYearStartDate(joinDate, referenceDate)
      : getFiscalYearStartDate(fiscalYearStartMonth, referenceDate);

  // Calculate tenure-based entitlement
  const yearsOfService = calculatePreciseYearsOfService(
    joinDate,
    referenceDate
  );
  const { entitlement: annualEntitlement, bonusDays: tenureBonusDays } =
    calculateTenureEntitlement(
      baseDays,
      yearsOfService,
      incrementPeriodYears,
      incrementAmount,
      maxCap
    );

  // Determine accrual start date.
  // Always ensure accrual doesn't start before the employee actually joined.
  const accrualStartDate =
    joinDate > fiscalYearStart ? joinDate : fiscalYearStart;

  // Ensure reference date is not before start date
  if (referenceDate < accrualStartDate) {
    return {
      accruedDays: 0,
      daysInFiscalYear: 0,
      dailyRate: 0,
      fiscalYearStart,
      annualEntitlement: baseDays,
      tenureBonusDays: 0,
      yearsOfService, // Added
    };
  }

  // Calculate days worked in current fiscal year
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysInFiscalYear =
    Math.floor(
      (referenceDate.getTime() - accrualStartDate.getTime()) / msPerDay
    ); // Calculate completed days (elapsed time)

  // Adjust divisor for leap year if needed
  const year = referenceDate.getFullYear();
  const adjustedDivisor = getAccrualDivisor(divisor, year, true);

  // Calculate daily accrual rate
  const dailyRate = calculateDailyAccrualRate(
    annualEntitlement,
    adjustedDivisor
  );

  // Calculate accrued days based on frequency
  let rawAccruedDays: number;
  let monthsWorked: number | undefined;

  if (accrualFrequency === "MONTHLY") {
    // Monthly: only credit full months worked (30-day periods)
    monthsWorked = Math.floor(daysInFiscalYear / 30);
    const monthlyRate = annualEntitlement / 12;
    rawAccruedDays = monthsWorked * monthlyRate;
  } else {
    // Daily (default): multiply worked days by daily rate
    rawAccruedDays = daysInFiscalYear * dailyRate;
  }

  // Cap at annual entitlement
  const accruedDays = Math.min(
    Math.round(rawAccruedDays * 100) / 100, // Round to 2 decimals
    annualEntitlement // Cap at annual entitlement
  );

  return {
    accruedDays,
    daysInFiscalYear,
    dailyRate: Math.round(dailyRate * 10000) / 10000, // 4 decimal precision for daily rate
    fiscalYearStart,
    annualEntitlement,
    tenureBonusDays,
    yearsOfService,
    monthsWorked, // Added for monthly frequency display
  };
};

export interface CashOutCalculation {
  cashValue: number;
  eligibleDays: number;
  dailyRate: number;
  roundedValue: number;
}

/**
 * Calculate leave cash-out value
 * Formula: (monthly_salary / salary_divisor) * remaining_days
 *
 * @param remainingDays - Available leave days to cash out
 * @param monthlySalary - Employee's monthly salary
 * @param salaryDivisor - Divisor for daily rate (30, 26, etc.)
 * @param maxDays - Maximum days that can be cashed out (optional)
 * @param rounding - Rounding method: 'ROUND', 'FLOOR', 'CEIL'
 */
export const calculateLeaveCashValue = (
  remainingDays: number,
  monthlySalary: number,
  salaryDivisor: number = 30,
  maxDays?: number | null,
  rounding: "ROUND" | "FLOOR" | "CEIL" = "ROUND"
): CashOutCalculation => {
  const eligibleDays = maxDays
    ? Math.min(remainingDays, maxDays)
    : remainingDays;
  const safeSalaryDivisor = salaryDivisor > 0 ? salaryDivisor : 30;
  const dailyRate = monthlySalary / safeSalaryDivisor;
  const rawCashValue = Math.max(0, dailyRate * eligibleDays);

  let roundedValue: number;
  switch (rounding) {
    case "FLOOR":
      roundedValue = Math.floor(rawCashValue * 100) / 100;
      break;
    case "CEIL":
      roundedValue = Math.ceil(rawCashValue * 100) / 100;
      break;
    default:
      roundedValue = Math.round(rawCashValue * 100) / 100;
  }

  return {
    cashValue: rawCashValue,
    eligibleDays,
    dailyRate: Math.round(dailyRate * 100) / 100,
    roundedValue,
  };
};

/**
 * Calculate years of service for an employee
 */
export const calculateYearsOfService = (hireDate: Date): number => {
  const now = new Date();
  const years = now.getFullYear() - hireDate.getFullYear();

  // Adjust if anniversary hasn't occurred this year
  const currentMonth = now.getMonth();
  const hireMonth = hireDate.getMonth();

  if (
    currentMonth < hireMonth ||
    (currentMonth === hireMonth && now.getDate() < hireDate.getDate())
  ) {
    return Math.max(1, years - 1);
  }

  return Math.max(1, years);
};

/**
 * Get fiscal year based on company settings
 */
export const getFiscalYear = async (
  companyId: number,
  date: Date = new Date(),
  db: any = prisma
): Promise<number> => {
  const leaveSettings = await db.leaveSettings.findUnique({
    where: { company_id: companyId },
  });

  const fiscalYearStartMonth = leaveSettings?.fiscal_year_start_month ?? 1;
  const currentMonth = date.getMonth() + 1; // 1-indexed

  // If current month is before fiscal year start, we're in previous fiscal year
  if (currentMonth < fiscalYearStartMonth) {
    return date.getFullYear() - 1;
  }

  return date.getFullYear();
};

/**
 * Initialize leave balances for an employee (creates missing rows for the current fiscal year).
 *
 * This is useful right after onboarding approval so the employee immediately has leave balances.
 * Annual leave entitlement uses gradual accrual and respects the configured accrual basis
 * (ANNIVERSARY vs fiscal year anchoring).
 */
export const initializeLeaveBalancesForEmployee = async (
  companyId: number,
  employeeId: string,
  date: Date = new Date(),
  db: any = prisma
): Promise<{ fiscalYear: number; createdCount: number }> => {
  const fiscalYear = await getFiscalYear(companyId, date, db);

  const leaveSettings = await db.leaveSettings.findUnique({
    where: { company_id: companyId },
  });

  const settings = leaveSettings as any;
  const fiscalYearStartMonth = settings?.fiscal_year_start_month ?? 1;
  const accrualBasis = settings?.accrual_basis ?? "ANNIVERSARY";

  const employee = await db.employee.findUnique({
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

  const normalizeGender = (
    gender: string | null | undefined
  ): string | null => {
    if (!gender) return null;
    const g = gender.trim().toUpperCase();
    if (g === "M" || g === "MALE") return "Male";
    if (g === "F" || g === "FEMALE") return "Female";
    return gender;
  };

  const employeeGender = normalizeGender(employee?.gender);
  const hireDate =
    employee?.employments?.[0]?.start_date ?? employee?.created_at ?? date;

  const leaveTypes = await db.leaveType.findMany({
    where: {
      company_id: companyId,
      OR: employeeGender
        ? [{ applicable_gender: "All" }, { applicable_gender: employeeGender }]
        : [
          { applicable_gender: "All" },
          { applicable_gender: "Male" },
          { applicable_gender: "Female" },
        ],
    },
    orderBy: { name: "asc" },
  });

  if (!leaveTypes || leaveTypes.length === 0) {
    return { fiscalYear, createdCount: 0 };
  }

  const accrualConfig = {
    baseDays: settings?.annual_leave_base_days ?? 16,
    divisor: settings?.accrual_divisor ?? 365,
    fiscalYearStartMonth,
    accrualBasis,
    incrementPeriodYears: settings?.increment_period_years ?? 2,
    incrementAmount: settings?.increment_amount ?? 1,
    maxCap: settings?.max_annual_leave_cap ?? null,
  };

  const rows = leaveTypes.map((leaveType: any) => {
    const isAccrualAnnualLeave = leaveType.code === "ANNUAL" && leaveType.is_accrual_based === true;

    let entitlement: number;
    if (isAccrualAnnualLeave) {
      const baseDays =
        leaveType.default_allowance_days || accrualConfig.baseDays;
      const incrementPeriodYears =
        leaveType.incremental_period_years ??
        accrualConfig.incrementPeriodYears;
      const incrementAmount =
        leaveType.incremental_days_per_year ?? accrualConfig.incrementAmount;
      const maxCap = leaveType.max_accrual_limit ?? accrualConfig.maxCap;

      const fiscalYearStart = getFiscalYearStartDate(
        accrualConfig.fiscalYearStartMonth,
        date
      );

      // Determine the start of the current anniversary period if needed
      const anniversaryStart = getAnniversaryYearStartDate(hireDate, date);

      // For Annual Leave, the database "total_entitlement" should store the 
      // cumulative carry-over from all PREVIOUS periods.
      // Accrued leave for the CURRENT period is calculated dynamically.
      const normalizedBasis = normalizeAccrualBasis(accrualConfig.accrualBasis);
      const retrospectiveDays = normalizedBasis === "ANNIVERSARY"
        ? calculateRetrospectiveAccrual(
          hireDate,
          anniversaryStart,
          baseDays,
          incrementPeriodYears,
          incrementAmount,
          maxCap
        )
        : calculateFiscalYearRetrospectiveAccrual(
          hireDate,
          fiscalYearStart,
          accrualConfig.fiscalYearStartMonth,
          baseDays,
          incrementPeriodYears,
          incrementAmount,
          maxCap
        );

      entitlement = retrospectiveDays;
    } else {
      const yearsOfService = calculateYearsOfService(hireDate);
      entitlement = calculateLeaveEntitlement(
        leaveType.default_allowance_days,
        leaveType.incremental_days_per_year || 0,
        yearsOfService,
        leaveType.max_accrual_limit
      );
    }

    const expiryDate = leaveType.carry_over_expiry_months
      ? calculateExpiryDate(
        fiscalYear,
        leaveType.carry_over_expiry_months,
        fiscalYearStartMonth
      )
      : null;

    return {
      employee_id: employeeId,
      company_id: companyId,
      leave_type_id: leaveType.id,
      fiscal_year: fiscalYear,
      total_entitlement: entitlement,
      used_days: 0,
      pending_days: 0,
      remaining_days: entitlement,
      expiry_date: expiryDate,
    };
  });

  const created = await db.leaveBalance.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return { fiscalYear, createdCount: created.count };
};

/**
 * Calculate expiry date for leave balance (2-year rule)
 */
/**
 * Calculate expiry date for leave balance (2-year rule or custom)
 * Supports both Fiscal Year and Anniversary based calculations.
 */
export const calculateExpiryDate = (
  fiscalYear: number,
  expiryMonths: number = 24,
  fiscalYearStartMonth: number = 1,
  accrualBasis: string = "ANNIVERSARY",
  joinDate?: Date | null
): Date => {
  const normalizedBasis = normalizeAccrualBasis(accrualBasis);

  if (normalizedBasis === "ANNIVERSARY" && joinDate) {
    // For Anniversary basis:
    // Period for fiscal_year N starts on AnniversaryDay in year N
    // Ends on AnniversaryDay in year N+1
    const endOfYear = new Date(joinDate);
    endOfYear.setFullYear(fiscalYear + 1);

    // expiry is X months after the end of that anniversary year
    const expiryDate = new Date(endOfYear);
    expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);
    return expiryDate;
  }

  // Default: CALENDAR_YEAR / Fiscal Year basis
  // Expiry is X months after the end of the fiscal year
  const fiscalYearEnd = new Date(fiscalYear + 1, fiscalYearStartMonth - 1, 1);
  const expiryDate = new Date(fiscalYearEnd);
  expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

  return expiryDate;
};

/**
 * Check if two date ranges overlap
 */
export const datesOverlap = (
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean => {
  return start1 <= end2 && end1 >= start2;
};

/**
 * Validate leave application dates
 */
export const validateLeaveDates = (
  startDate: Date,
  endDate: Date,
  returnDate: Date
): { valid: boolean; message?: string } => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (startDate < today) {
    return { valid: false, message: "Start date cannot be in the past" };
  }

  if (endDate < startDate) {
    return { valid: false, message: "End date must be after start date" };
  }

  if (returnDate < endDate) {
    return { valid: false, message: "Return date must be after end date" };
  }

  return { valid: true };
};

/**
 * Get the next approval level for a leave application
 */
export const getNextApprovalLevel = (
  currentStatus: string,
  employeeLevel: string
): string | null => {
  const approvalFlow: Record<string, string> = {
    PENDING_SUPERVISOR: "PENDING_HR",
    PENDING_HR: "PENDING_CEO",
    PENDING_CEO: "APPROVED",
  };

  // For non-managers, skip CEO approval
  if (
    currentStatus === "PENDING_HR" &&
    !["Manager", "Director", "Executive"].includes(employeeLevel)
  ) {
    return "APPROVED";
  }

  return approvalFlow[currentStatus] || null;
};

/**
 * Format decimal days to readable string
 */
export const formatDays = (days: number): string => {
  const wholeDays = Math.floor(days);
  const hasHalf = days % 1 === 0.5;

  if (hasHalf) {
    return wholeDays > 0 ? `${wholeDays}.5 days` : "0.5 days";
  }

  return `${wholeDays} day${wholeDays !== 1 ? "s" : ""}`;
};

export interface LeaveStats {
  totalEmployees: number;
  onLeaveToday: number;
  pendingApplications: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  byLeaveType: Array<{
    leaveType: string;
    count: number;
    totalDays: number;
  }>;
}

/**
 * Get leave statistics for dashboard
 */
export const getLeaveStatistics = async (
  companyId: number
): Promise<LeaveStats> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [
    totalEmployees,
    onLeaveToday,
    pendingApplications,
    approvedThisMonth,
    rejectedThisMonth,
    byLeaveType,
  ] = await Promise.all([
    // Total employees
    prisma.employee.count({
      where: { company_id: companyId },
    }),

    // On leave today
    prisma.leaveApplication.count({
      where: {
        company_id: companyId,
        current_status: "APPROVED",
        start_date: { lte: today },
        end_date: { gte: today },
      },
    }),

    // Pending applications
    prisma.leaveApplication.count({
      where: {
        company_id: companyId,
        current_status: {
          in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"],
        },
      },
    }),

    // Approved this month
    prisma.leaveApplication.count({
      where: {
        company_id: companyId,
        current_status: "APPROVED",
        updated_at: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }),

    // Rejected this month
    prisma.leaveApplication.count({
      where: {
        company_id: companyId,
        current_status: "REJECTED",
        updated_at: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    }),

    // By leave type
    prisma.leaveApplication.groupBy({
      by: ["leave_type_id"],
      where: {
        company_id: companyId,
        current_status: "APPROVED",
        start_date: {
          gte: startOfMonth,
        },
      },
      _count: true,
      _sum: {
        requested_days: true,
      },
    }),
  ]);

  // Get leave type names
  const leaveTypes = await prisma.leaveType.findMany({
    where: {
      company_id: companyId,
    },
  });

  const leaveTypeMap = new Map(leaveTypes.map((lt: any) => [lt.id, lt.name]));

  return {
    totalEmployees,
    onLeaveToday,
    pendingApplications,
    approvedThisMonth,
    rejectedThisMonth,
    byLeaveType: byLeaveType.map((item: any) => ({
      leaveType: leaveTypeMap.get(item.leave_type_id) || "Unknown",
      count: item._count,
      totalDays: Number(item._sum.requested_days) || 0,
    })),
  };
};

// ============================================================================
// DYNAMIC BALANCE CALCULATION (Central Source of Truth)
// ============================================================================

/**
 * Calculate retrospective accrual for past years based on tenure.
 * This sums up the annual entitlement for each completed year of service
 * from joinDate up to the simulated current period start.
 */
export const calculateRetrospectiveAccrual = (
  joinDate: Date,
  currentPeriodStart: Date,
  baseDays: number,
  incrementPeriodYears: number,
  incrementAmount: number,
  maxCap?: number | null,
  expiryMonths?: number | null,
  referenceDate: Date = new Date()
): number => {
  let totalAccrued = 0;

  // Jump year-by-year from joinDate anniversary to anniversary
  let yearStart = new Date(joinDate);
  let iterations = 0;

  while (iterations < 100) { // Safety break
    const yearEnd = new Date(yearStart);
    yearEnd.setFullYear(yearEnd.getFullYear() + 1);

    // If this service year ends after the current period starts, it's not a "past" year
    // We stop counting when we reach the start of the CURRENT accrual period.
    if (yearEnd.getTime() > currentPeriodStart.getTime()) break;

    // Tenure at the start of this year determines the entitlement
    const yearsOfService = calculatePreciseYearsOfService(joinDate, yearStart);
    const { entitlement } = calculateTenureEntitlement(
      baseDays,
      yearsOfService,
      incrementPeriodYears,
      incrementAmount,
      maxCap
    );

    // Check for Expiry
    if (expiryMonths) {
      // Anniversary-based expiry: Expire Y months after yearEnd
      const expiryDate = new Date(yearEnd);
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      // If expiry date has passed relative to reference date (today), this balance is lost
      if (expiryDate < referenceDate) {
        // This year's entitlement is expired
        yearStart = yearEnd;
        iterations++;
        continue;
      }
    }

    totalAccrued += entitlement;
    yearStart = yearEnd;
    iterations++;
  }

  return totalAccrued;
};

/**
 * Calculate retrospective accrual for past fiscal years.
 * This sums up the annual entitlement for each completed fiscal year of service
 * from joinDate up to the current fiscal year start.
 * 
 * Unlike anniversary-based accrual, this calculates based on fiscal year boundaries
 * (e.g., Jan 1 - Dec 31 if fiscal_year_start_month is 1)
 */
export const calculateFiscalYearRetrospectiveAccrual = (
  joinDate: Date,
  currentFiscalYearStart: Date,
  fiscalYearStartMonth: number,
  baseDays: number,
  incrementPeriodYears: number,
  incrementAmount: number,
  maxCap?: number | null,
  expiryMonths?: number | null,
  referenceDate: Date = new Date()
): number => {
  let totalAccrued = 0;

  // Start at the fiscal year boundary containing joinDate
  let yearStart = getFiscalYearStartDate(fiscalYearStartMonth, joinDate);
  const hireDateStartBoundary = yearStart.getTime();

  let iterations = 0;

  while (iterations < 100) { // Safety break
    const yearEnd = new Date(yearStart);
    yearEnd.setFullYear(yearEnd.getFullYear() + 1);

    // Stop if this fiscal year ends after the current fiscal year starts
    if (yearEnd.getTime() > currentFiscalYearStart.getTime()) break;

    // Check for Expiry
    if (expiryMonths) {
      // Fiscal-based expiry: Expire Y months after yearEnd
      const expiryDate = new Date(yearEnd);
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      // If expiry date has passed relative to reference date (today), this balance is lost
      if (expiryDate < referenceDate) {
        yearStart = yearEnd;
        iterations++;
        continue;
      }
    }

    // Calculation depends on tenure at start of this fiscal year
    // Note: Use slightly adjusted date to avoid boundary issues with leap years/timezones
    // by adding a small buffer (e.g. 1 hour) when calculating tenure if needed, 
    // but relying on precise calculation should be fine.
    const yearsOfService = calculatePreciseYearsOfService(joinDate, yearStart);
    const { entitlement } = calculateTenureEntitlement(
      baseDays,
      yearsOfService,
      incrementPeriodYears,
      incrementAmount,
      maxCap
    );

    if (yearStart.getTime() === hireDateStartBoundary) {
      // First year: Pro-rate it from hire date to end of fiscal year
      // But ensure daysWorked is positive
      const msInDay = 1000 * 60 * 60 * 24;
      // Use time subtraction but ensure we don't get negative
      const startTime = Math.max(joinDate.getTime(), yearStart.getTime());

      if (yearEnd.getTime() > startTime) {
        const daysWorked = Math.floor((yearEnd.getTime() - startTime) / msInDay);

        // Logic check: if employee joined Feb 1, and fiscal year starts Jan 1.
        // yearStart = Jan 1. yearEnd = Jan 1 Next Year.
        // daysWorked = Jan 1 Next - Feb 1 = ~334 days.
        // Fraction = 334/365.

        // Use 365 or 366 depending on the year length
        const daysInYear = Math.floor((yearEnd.getTime() - yearStart.getTime()) / msInDay);
        const divisor = daysInYear > 360 ? daysInYear : 365;

        const proRated = (daysWorked / divisor) * entitlement;
        totalAccrued += Math.min(entitlement, proRated);
      }
    } else {
      // Full fiscal year
      totalAccrued += entitlement;
    }

    yearStart = yearEnd;
    iterations++;
  }

  return Math.round(totalAccrued * 100) / 100;
};

export interface DynamicBalanceResult {
  totalEntitlement: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  accrualDetails?: {
    isAccrualBased: boolean;
    openingBalance: number;
    accruedDays: number;
    dailyRate: number;
    daysInFiscalYear: number;
    annualEntitlement: number;
    tenureBonusDays?: number;
    baseDays?: number;
    simulatedCarryOver?: number;
    totalServiceDays?: number;
    yearsOfService?: number;
    monthsWorked?: number; // Added for monthly frequency display
    accrualFrequency?: string; // Added to indicate DAILY or MONTHLY
    manualAdjustment?: number; // Added to track manual adjustments
  };
}



/**
 * Calculate dynamic leave balance for an employee
 * This is the CENTRAL source of truth for all balance calculations.
 * 
 * For accrual-based leave types:
 *   Total = OpeningBalance (DB) + AccruedDays (YTD)
 *   Remaining = max(0, Total - Used - Pending)
 * 
 * For fixed leave types:
 *   Total = DB entitlement
 *   Remaining = max(0, Total - Used - Pending)
 * 
 * @param leaveType - The leave type configuration
 * @param dbBalance - The stored balance record (if exists)
 * @param hireDate - Employee's hire date
 * @param companySettings - Company leave settings (for accrual_basis)
 * @param referenceDate - Date to calculate to (default: today)
 */
export const calculateDynamicLeaveBalance = (
  leaveType: {
    id: number;
    code: string;
    default_allowance_days: number;
    incremental_days_per_year?: number | null;
    incremental_period_years?: number | null;
    max_accrual_limit?: number | null;
    is_accrual_based?: boolean | null;
    accrual_frequency?: string | null;
    accrual_divisor?: number | null;
    carry_over_expiry_months?: number | null;
  },
  dbBalance: {
    total_entitlement: number | any;
    used_days: number | any;
    pending_days: number | any;
    manual_adjustment_days?: number | any;
  } | null,
  hireDate: Date,
  companySettings: {
    accrual_basis?: string | null;
    fiscal_year_start_month?: number | null;
  } | null,
  referenceDate: Date = new Date()
): DynamicBalanceResult => {
  const round2 = (v: number) => Number(v.toFixed(2));
  const toNum = (v: any) => {
    if (v && typeof v === 'object' && 'toNumber' in v) return v.toNumber();
    return Number(v ?? 0);
  };

  const usedDays = toNum(dbBalance?.used_days);
  const pendingDays = toNum(dbBalance?.pending_days);
  const openingBalance = toNum(dbBalance?.total_entitlement);
  const manualAdjustment = toNum(dbBalance?.manual_adjustment_days);

  // Check if this leave type uses accrual
  const isAccrualBased = leaveType.is_accrual_based === true;

  if (isAccrualBased) {
    // Use LeaveType-specific accrual settings
    const baseDays = leaveType.default_allowance_days;
    const incrementPeriodYears = leaveType.incremental_period_years ?? 2;
    const incrementAmount = leaveType.incremental_days_per_year ?? 1;
    const maxCap = leaveType.max_accrual_limit ?? null;
    const divisor = leaveType.accrual_divisor ?? 365;
    const accrualFrequency = leaveType.accrual_frequency ?? "DAILY";

    // Get accrual basis from company settings and normalize it
    const accrualBasis = normalizeAccrualBasis(companySettings?.accrual_basis);
    const fiscalYearStartMonth = companySettings?.fiscal_year_start_month ?? 1;

    // Calculate accrued balance for CURRENT period
    const accrualResult = calculateAccruedBalance(
      hireDate,
      referenceDate,
      baseDays,
      divisor,
      fiscalYearStartMonth,
      incrementPeriodYears,
      incrementAmount,
      maxCap,
      accrualBasis,
      accrualFrequency
    );

    // Calculate Retrospective Accrual (Dynamic Carry Over)
    // This simulates "Unused" leave from previous years based on tenure
    let retrospectiveDays = 0;

    // Calculate retrospective based on accrual basis type
    if (accrualResult.fiscalYearStart > hireDate) {
      if (accrualBasis === "ANNIVERSARY") {
        // Anniversary-based: calculate from hire date anniversaries
        retrospectiveDays = calculateRetrospectiveAccrual(
          hireDate,
          accrualResult.fiscalYearStart, // Calculate up to start of current anniversary period
          baseDays,
          incrementPeriodYears,
          incrementAmount,
          maxCap,
          leaveType.carry_over_expiry_months, // 👈 PASS EXPIRY MONTHS
          referenceDate // 👈 PASS REF DATE (TODAY)
        );
      } else if (accrualBasis === "CALENDAR_YEAR") {
        // Fiscal year-based: calculate from fiscal year boundaries
        retrospectiveDays = calculateFiscalYearRetrospectiveAccrual(
          hireDate,
          accrualResult.fiscalYearStart, // Calculate up to start of current fiscal year
          fiscalYearStartMonth,
          baseDays,
          incrementPeriodYears,
          incrementAmount,
          maxCap,
          leaveType.carry_over_expiry_months, // 👈 PASS EXPIRY MONTHS
          referenceDate // 👈 PASS REF DATE (TODAY)
        );
      }
    }
    // If hire date is after current period start (new employee in current period), 
    // retrospectiveDays stays 0 - no carry-over from previous periods

    // For accrual-based leave, we now prioritze the dynamic retrospective calculation
    // to ensure the "Carried Over" amount always reflects the correct tenure-based entitlement.
    // This resolves issues where stale DB balances (e.g., from initial migration or bugs) persist.
    
    // EXCEPTION: For new employees in their first period (where retrospectiveDays is 0),
    // we respect the openingBalance stored in the DB (initialized at hire).
    const isNewEmployeeInFirstPeriod = accrualResult.fiscalYearStart <= hireDate;
    const effectiveOpeningBalance = (isNewEmployeeInFirstPeriod && openingBalance > 0)
      ? openingBalance
      : retrospectiveDays;

    // Total Entitlement = Opening + Accrued + Manual
    const totalEntitlement = Math.max(0, round2(
      effectiveOpeningBalance +
      accrualResult.accruedDays +
      manualAdjustment
    ));
    // Remaining = Total - Used only (pending does NOT reduce remaining until approved)
    const remainingDays = round2(Math.max(0, totalEntitlement - usedDays));

    return {
      totalEntitlement,
      usedDays: round2(usedDays),
      pendingDays: round2(pendingDays),
      remainingDays,
      accrualDetails: {
        isAccrualBased: true,
        openingBalance: round2(effectiveOpeningBalance),
        accruedDays: round2(accrualResult.accruedDays),
        dailyRate: accrualResult.dailyRate,
        daysInFiscalYear: accrualResult.daysInFiscalYear,
        annualEntitlement: accrualResult.annualEntitlement,
        tenureBonusDays: accrualResult.tenureBonusDays,
        baseDays,
        simulatedCarryOver: retrospectiveDays,
        totalServiceDays: Math.floor((referenceDate.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24)),
        yearsOfService: accrualResult.yearsOfService,
        monthsWorked: accrualResult.monthsWorked, // For monthly frequency display
        accrualFrequency, // DAILY or MONTHLY
        manualAdjustment: round2(manualAdjustment),    
      },
    };
  }

  // Fixed entitlement (non-accrual)
  // Include manual adjustments here too
  const totalEntitlement = Math.max(0, round2(openingBalance + manualAdjustment));
  // Remaining = Total - Used only (pending does NOT reduce remaining until approved)
  const remainingDays = round2(Math.max(0, totalEntitlement - usedDays));

  return {
    totalEntitlement,
    usedDays: round2(usedDays),
    pendingDays: round2(pendingDays),
    remainingDays,
  };
};

/**
 * Calculate the DB value to store when admin sets a target balance.
 * Implements Option B: DB = Target - CurrentlyAccrued
 * 
 * @param targetBalance - The balance the admin wants the employee to have
 * @param leaveType - The leave type config
 * @param hireDate - Employee hire date
 * @param companySettings - Company leave settings
 * @returns The value to store in DB (total_entitlement field)
 */
export const calculateDbValueForTargetBalance = (
  targetBalance: number,
  leaveType: {
    default_allowance_days: number;
    incremental_days_per_year?: number | null;
    incremental_period_years?: number | null;
    max_accrual_limit?: number | null;
    is_accrual_based?: boolean | null;
    accrual_divisor?: number | null;
  },
  hireDate: Date,
  companySettings: {
    accrual_basis?: string | null;
    fiscal_year_start_month?: number | null;
  } | null
): number => {
  const isAccrualBased = leaveType.is_accrual_based === true;

  if (!isAccrualBased) {
    // For fixed leave types, DB value = target directly
    return Math.max(0, targetBalance);
  }

  // For accrual-based: DB = Target - CurrentlyAccrued
  const baseDays = leaveType.default_allowance_days;
  const incrementPeriodYears = leaveType.incremental_period_years ?? 2;
  const incrementAmount = leaveType.incremental_days_per_year ?? 1;
  const maxCap = leaveType.max_accrual_limit ?? null;
  const divisor = leaveType.accrual_divisor ?? 365;
  const accrualBasis = normalizeAccrualBasis(companySettings?.accrual_basis);
  const fiscalYearStartMonth = companySettings?.fiscal_year_start_month ?? 1;

  const accrualResult = calculateAccruedBalance(
    hireDate,
    new Date(),
    baseDays,
    divisor,
    fiscalYearStartMonth,
    incrementPeriodYears,
    incrementAmount,
    maxCap,
    accrualBasis
  );

  const dbValue = targetBalance - accrualResult.accruedDays;
  return Math.max(0, Number(dbValue.toFixed(2)));
};

/**
 * Recalculate leave balances for an employee based on new employment details.
 * This should be called when start_date or other key employment fields change.
 */
/**
 * Recalculate leave balances for an employee based on new employment details.
 * This should be called when start_date or other key employment fields change.
 * 
 * Strategy: Reset the entitlement calculation based on the new start date, 
 * effectively ignoring previous manual adjustments or carry-over that was based on wrong date.
 * This ensures the employee gets the full benefit of their correct tenure.
 */
export const recalculateLeaveBalancesForEmployee = async (
  employeeId: string,
  companyId: number,
  db: any = prisma
) => {
  const fiscalYear = await getFiscalYear(companyId, new Date(), db);

  // fetch active employment to get start_date
  const employee = await db.employee.findUnique({
    where: { id_company_id: { id: employeeId, company_id: companyId } },
    include: {
      employments: {
        where: { is_active: true },
        take: 1
      }
    }
  });

  const employment = employee?.employments[0];
  if (!employment) return;

  const hireDate = employment.start_date;

  // fetch current balances for this fiscal year
  const balances = await db.leaveBalance.findMany({
    where: {
      employee_id: employeeId,
      company_id: companyId,
      fiscal_year: fiscalYear
    },
    include: { leaveType: true }
  });

  // fetch company settings
  const leaveSettings = await db.leaveSettings.findUnique({
    where: { company_id: companyId },
  });

  for (const balance of balances) {
    const leaveType = balance.leaveType;

    // We only recalculate accrual-based leave types (Annual) or those that might depend on tenure.
    // Fixed leave types (Sick, etc) are usually flat, but calculating them dynamic allows updates if they depend on tenure.

    // Create a mock balance to force calculation.
    // For Accrual-Based: Start with 0 to force retrospective calculation.
    // For Fixed: Start with default allowance (so it resets to policy).

    const mockDbBalance = {
      total_entitlement: leaveType.is_accrual_based ? 0 : (leaveType.default_allowance_days || 0),
      used_days: balance.used_days,
      pending_days: balance.pending_days
    };

    const newBalanceResult = calculateDynamicLeaveBalance(
      leaveType,
      mockDbBalance,
      hireDate,
      leaveSettings,
      new Date() // Today as reference
    );

    // For accrual-based leave types, we only want to store the OPENING BALANCE (carry-over) in the DB field 'total_entitlement'.
    // The dynamic calculation in calculateDynamicLeaveBalance adds the YTD accrual on top of this.
    // If we store the sum, we would double-count the accrual in subsequent views.
    const dbEntitlement = leaveType.is_accrual_based
      ? (newBalanceResult.accrualDetails?.openingBalance ?? 0)
      : newBalanceResult.totalEntitlement;

    if (Math.abs(Number(balance.total_entitlement) - dbEntitlement) > 0.01) {
      await db.leaveBalance.update({
        where: { id: balance.id },
        data: {
          total_entitlement: dbEntitlement,
          remaining_days: newBalanceResult.remainingDays
        }
      });
    }
  }
};

/**
 * Recalculate leave balances for ALL employees in a company.
 * Triggers when company-wide settings (like accrual basis) change.
 */
export const recalculateCompanyLeaveBalances = async (
  companyId: number,
  db: any = prisma
) => {
  // Fetch all employees in the company
  const employees = await db.employee.findMany({
    where: { company_id: companyId },
    select: { id: true }
  });

  console.log(`[LeaveSettings] Recalculating balances for ${employees.length} employees due to settings change...`);

  // Execute sequentially to avoid overwhelming the DB connection pool
  // In a real production system with many employees, this should be offloaded to a background queue.
  for (const emp of employees) {
    await recalculateLeaveBalancesForEmployee(emp.id, companyId, db);
  }

  console.log(`[LeaveSettings] Recalculation complete.`);
};
