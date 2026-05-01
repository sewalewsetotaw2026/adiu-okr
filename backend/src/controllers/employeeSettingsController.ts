import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";

/**
 * Get employee settings for the company
 */
export const getEmployeeSettings = async (
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

    let settings = await (prisma.employeeSettings.findUnique({
      where: { company_id: companyId },
    }) as any);

    // If settings don't exist, create defaults
    if (!settings) {
      settings = await (prisma.employeeSettings.create({
        data: {
          company_id: companyId,
          probation_period_days: 90,
          probation_notification_days: 5,
          pension_age: 60,
          pension_notification_days: 30,
        },
      }) as any);
    }

    return res.status(200).json({
      status: "success",
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manually trigger pension checks (for testing)
 */
export const runPensionCheck = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { checkAndNotifyPensionMilestones } = await import(
      "../services/pensionNotificationService"
    );
    await checkAndNotifyPensionMilestones();
    return res.status(200).json({
      status: "success",
      message: "Pension checks triggered successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update employee settings for the company
 */
export const updateEmployeeSettings = async (
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
      probation_period_days,
      probation_notification_days,
      pension_age,
      pension_notification_days,
    } = req.body;

    const settings = await (prisma.employeeSettings.upsert({
      where: { company_id: companyId },
      update: {
        probation_period_days:
          probation_period_days !== undefined
            ? Number(probation_period_days)
            : undefined,
        probation_notification_days:
          probation_notification_days !== undefined
            ? Number(probation_notification_days)
            : undefined,
        pension_age:
          pension_age !== undefined ? Number(pension_age) : undefined,
        pension_notification_days:
          pension_notification_days !== undefined
            ? Number(pension_notification_days)
            : undefined,
      },
      create: {
        company_id: companyId,
        probation_period_days:
          probation_period_days !== undefined
            ? Number(probation_period_days)
            : 90,
        probation_notification_days:
          probation_notification_days !== undefined
            ? Number(probation_notification_days)
            : 5,
        pension_age:
          pension_age !== undefined ? Number(pension_age) : 60,
        pension_notification_days:
          pension_notification_days !== undefined
            ? Number(pension_notification_days)
            : 30,
      },
    }) as any);

    return res.status(200).json({
      status: "success",
      message: "Employee settings updated successfully",
      data: { settings },
    });
  } catch (error) {
    next(error);
  }
};
