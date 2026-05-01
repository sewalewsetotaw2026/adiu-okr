import { Request, Response, NextFunction } from "express";
import {
  getManagerMonthPlanItemsForEmployee,
  getManagerWeeklyPlanItemsForEmployee,
} from "src/services/okrManagerPlanService";

// ─── Alignment Lookup (Employee-facing) ───────────────────────────────────────

export const getAlignmentMonthlyItems = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const monthNumber = Number(req.params.monthNumber);
    const cycleId = Number(req.query.cycle_id);
    const userId = String(req.query.user_id || (req as any).user?.employee_id);
    const companyId = (req as any).user.company_id;

    const items = await getManagerMonthPlanItemsForEmployee(
      userId,
      monthNumber,
      companyId,
      cycleId,
    );

    res.status(200).json({ status: "success", data: items });
  } catch (err) {
    next(err);
  }
};

export const getAlignmentWeeklyItems = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const weekNumber = Number(req.params.weekNumber);
    const cycleId = Number(req.query.cycle_id);
    const userId = String(req.query.user_id || (req as any).user?.employee_id);
    const companyId = (req as any).user.company_id;

    const items = await getManagerWeeklyPlanItemsForEmployee(
      userId,
      weekNumber,
      companyId,
      cycleId,
    );

    res.status(200).json({ status: "success", data: items });
  } catch (err) {
    next(err);
  }
};
