import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { recalculateCompanyLeaveBalances } from "src/utils/leaveUtils";
import { redisService } from "src/services/redisService";

/**
 * Get leave settings for the company
 */
export const getLeaveSettings = async (
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

    let settings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });

    // If no settings exist, return defaults
    if (!settings) {
      settings = {
        id: 0,
        company_id: companyId,
        saturday_half_day: true,
        sunday_off: true,
        fiscal_year_start_month: 1,
        accrual_basis: "ANNIVERSARY",
        require_ceo_approval_for_managers: true,
        auto_approve_after_days: null,
        // Accrual Configuration
        annual_leave_base_days: 16,
        accrual_frequency: "DAILY",
        accrual_divisor: 365,
        increment_period_years: 2,
        increment_amount: 1,
        max_annual_leave_cap: null,
        // Notification Configuration
        enable_leave_expiry: true,
        expiry_notification_days: 30,
        balance_notification_enabled: true,
        notification_channels: "EMAIL",
        // Cash-Out Configuration
        enable_encashment: false,
        encashment_salary_divisor: 30,
        max_encashment_days: null,
        encashment_rounding: "ROUND",
        // Policy Versioning
        policy_effective_date: new Date(),
        policy_version: 1,
        created_at: null,
        updated_at: null,
      } as any;
    }

    res.status(200).json({
      status: "success",
      message: "Leave settings fetched successfully",
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update leave settings
 */
export const upsertLeaveSettings = async (
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

    let {
      // Work Week Configuration
      saturday_half_day,
      sunday_off,
      fiscal_year_start_month,
      accrual_basis,
      require_ceo_approval_for_managers,
      auto_approve_after_days,
      // Accrual Configuration
      annual_leave_base_days,
      accrual_frequency,
      accrual_divisor,
      increment_period_years,
      increment_amount,
      max_annual_leave_cap,
      // Notification Configuration
      enable_leave_expiry,
      expiry_notification_days,
      balance_notification_enabled,
      notification_channels,
      // Cash-Out Configuration
      enable_encashment,
      encashment_salary_divisor,
      max_encashment_days,
      encashment_rounding,
      // Policy Versioning
      policy_effective_date,
    } = req.body;

    // Type Casting: Ensure numeric fields are numbers (not strings)
    const toNum = (val: any) => (val !== undefined && val !== null && val !== "" ? Number(val) : val);

    fiscal_year_start_month = toNum(fiscal_year_start_month);
    auto_approve_after_days = toNum(auto_approve_after_days);
    annual_leave_base_days = toNum(annual_leave_base_days);
    accrual_divisor = toNum(accrual_divisor);
    increment_period_years = toNum(increment_period_years);
    increment_amount = toNum(increment_amount);
    max_annual_leave_cap = toNum(max_annual_leave_cap);
    expiry_notification_days = toNum(expiry_notification_days);
    encashment_salary_divisor = toNum(encashment_salary_divisor);
    max_encashment_days = toNum(max_encashment_days);

    // Type Casting: Ensure booleans are booleans
    const toBool = (val: any) => (val !== undefined && val !== null ? (typeof val === 'string' ? val === 'true' : Boolean(val)) : val);

    saturday_half_day = toBool(saturday_half_day);
    sunday_off = toBool(sunday_off);
    require_ceo_approval_for_managers = toBool(require_ceo_approval_for_managers);
    enable_leave_expiry = toBool(enable_leave_expiry);
    balance_notification_enabled = toBool(balance_notification_enabled);
    enable_encashment = toBool(enable_encashment);

    // Validation: fiscal_year_start_month
    if (
      fiscal_year_start_month !== undefined &&
      (fiscal_year_start_month < 1 || fiscal_year_start_month > 12)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "fiscal_year_start_month must be between 1 and 12",
      });
    }

    // Validation: accrual_basis
    if (
      accrual_basis !== undefined &&
      !["ANNIVERSARY", "CALENDAR_YEAR"].includes(accrual_basis)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "accrual_basis must be 'ANNIVERSARY' or 'CALENDAR_YEAR'",
      });
    }

    // Validation: accrual_frequency
    if (
      accrual_frequency !== undefined &&
      !["DAILY", "MONTHLY"].includes(accrual_frequency)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "accrual_frequency must be 'DAILY' or 'MONTHLY'",
      });
    }

    // Validation: accrual_divisor
    if (
      accrual_divisor !== undefined &&
      (accrual_divisor < 1 || accrual_divisor > 400)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "accrual_divisor must be between 1 and 400",
      });
    }

    // Validation: encashment_rounding
    if (
      encashment_rounding !== undefined &&
      !["ROUND", "FLOOR", "CEIL"].includes(encashment_rounding)
    ) {
      return res.status(400).json({
        status: "fail",
        message: "encashment_rounding must be 'ROUND', 'FLOOR', or 'CEIL'",
      });
    }

    // Get existing settings to handle version increment
    const existingSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });

    const existing = existingSettings as any;
    const newVersion = (existing?.policy_version ?? 0) + 1;

    const settings = await prisma.leaveSettings.upsert({
      where: { company_id: companyId },
      update: {
        // Cast to any to handle schema update lag
        // Work Week Configuration
        ...(saturday_half_day !== undefined && { saturday_half_day }),
        ...(sunday_off !== undefined && { sunday_off }),
        ...(fiscal_year_start_month !== undefined && { fiscal_year_start_month }),
        ...(accrual_basis !== undefined && { accrual_basis }),
        ...(require_ceo_approval_for_managers !== undefined && {
          require_ceo_approval_for_managers,
        }),
        ...(auto_approve_after_days !== undefined && { auto_approve_after_days }),
        // Accrual Configuration
        ...(annual_leave_base_days !== undefined && { annual_leave_base_days }),
        ...(accrual_frequency !== undefined && { accrual_frequency }),
        ...(accrual_divisor !== undefined && { accrual_divisor }),
        ...(increment_period_years !== undefined && { increment_period_years }),
        ...(increment_amount !== undefined && { increment_amount }),
        ...(max_annual_leave_cap !== undefined && { max_annual_leave_cap }),
        // Notification Configuration
        ...(enable_leave_expiry !== undefined && { enable_leave_expiry }),
        ...(expiry_notification_days !== undefined && { expiry_notification_days }),
        ...(balance_notification_enabled !== undefined && { balance_notification_enabled }),
        ...(notification_channels !== undefined && { notification_channels }),
        // Cash-Out Configuration
        ...(enable_encashment !== undefined && { enable_encashment }),
        ...(encashment_salary_divisor !== undefined && { encashment_salary_divisor }),
        ...(max_encashment_days !== undefined && { max_encashment_days }),
        ...(encashment_rounding !== undefined && { encashment_rounding }),
        // Policy Versioning
        ...(policy_effective_date !== undefined && {
          policy_effective_date: new Date(policy_effective_date),
        }),
        policy_version: newVersion,
        updated_at: new Date(),
      } as any,
      create: {
        company_id: companyId,
        // Work Week Configuration
        saturday_half_day: saturday_half_day ?? true,
        sunday_off: sunday_off ?? true,
        fiscal_year_start_month: fiscal_year_start_month ?? 1,
        accrual_basis: accrual_basis ?? "ANNIVERSARY",
        require_ceo_approval_for_managers: require_ceo_approval_for_managers ?? true,
        auto_approve_after_days: auto_approve_after_days ?? null,
        // Accrual Configuration
        annual_leave_base_days: annual_leave_base_days ?? 16,
        accrual_frequency: accrual_frequency ?? "DAILY",
        accrual_divisor: accrual_divisor ?? 365,
        increment_period_years: increment_period_years ?? 2,
        increment_amount: increment_amount ?? 1,
        max_annual_leave_cap: max_annual_leave_cap ?? null,
        // Notification Configuration
        enable_leave_expiry: enable_leave_expiry ?? true,
        expiry_notification_days: expiry_notification_days ?? 30,
        balance_notification_enabled: balance_notification_enabled ?? true,
        notification_channels: notification_channels ?? "EMAIL",
        // Cash-Out Configuration
        enable_encashment: enable_encashment ?? false,
        encashment_salary_divisor: encashment_salary_divisor ?? 30,
        max_encashment_days: max_encashment_days ?? null,
        encashment_rounding: encashment_rounding ?? "ROUND",
        // Policy Versioning
        policy_effective_date: policy_effective_date
          ? new Date(policy_effective_date)
          : new Date(),
        policy_version: 1,
      } as any,
    });

    // Trigger recalculation of leave balances for all employees
    // This ensures that changes to accrual basis, base days, etc. are immediately reflected
    await recalculateCompanyLeaveBalances(companyId, prisma);

    // Invalidate Cache
    // Since settings change affects all employees and balances, we clear all relevant patterns
    // Invalidate Cache
    const patterns = [
      `company:${companyId}:leave_list:*`,
      `company:${companyId}:leave_stats:*`,
      `company:${companyId}:leave_my:*`,
      `company:${companyId}:analytics:*`,
      `company:${companyId}:team_leave:*`,
      `company:${companyId}:leave_balance_list:*`,
      `company:${companyId}:leave_balance_my:*`,
      `leave_balance:${companyId}:*`,
    ];
    Promise.all(patterns.map(p => redisService.delByPattern(p))).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Leave settings saved successfully",
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leave settings history/versions (for audit)
 */
export const getLeaveSettingsVersion = async (
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

    const settings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
      select: {
        policy_version: true,
        policy_effective_date: true,
        updated_at: true,
      },
    });

    const versionSettings = settings as any;

    res.status(200).json({
      status: "success",
      message: "Leave settings version fetched successfully",
      data: {
        current_version: versionSettings?.policy_version ?? 1,
        effective_date: versionSettings?.policy_effective_date ?? null,
        last_updated: versionSettings?.updated_at ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
};
