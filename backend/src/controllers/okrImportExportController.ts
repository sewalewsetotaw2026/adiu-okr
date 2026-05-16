import { Request, Response, NextFunction } from "express";
import {
  importQuarterlyOKR,
  importMonthlyPlans,
  importWeeklyPlans,
} from "src/services/okrImportService";
import {
  exportQuarterlyOKR,
  exportMonthlyPlans,
  exportWeeklyPlans,
} from "src/services/okrExportService";
import {
  generateQuarterlyTemplate,
  generateMonthlyTemplate,
  generateWeeklyTemplate,
  generateCompanyTemplate,
} from "src/services/okrTemplateService";
import { importCompanyObjectives } from "src/services/okrImportService";
import { exportCompanyObjectives } from "src/services/okrExportService";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ─── Import Handlers ─────────────────────────────────────────────────────────

export const importQuarterly = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ status: "fail", message: "No file uploaded." });
    }
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ status: "fail", message: "File size exceeds 5MB limit." });
    }

    const mode = (req.body.mode || "strict") as "strict" | "partial";
    const report = await importQuarterlyOKR(
      file.buffer,
      file.originalname,
      req.user!.company_id,
      req.user!.employee_id || req.user!.user_id,
      req.user!.user_id,
      mode,
    );

    const statusCode = report.failed > 0 && report.succeeded === 0 ? 422 : 200;
    res.status(statusCode).json({ status: "success", data: report });
  } catch (error: any) {
    next(error);
  }
};

export const importCompany = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ status: "fail", message: "No file uploaded." });
    }
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ status: "fail", message: "File size exceeds 5MB limit." });
    }

    const mode = (req.body.mode || "strict") as "strict" | "partial";
    const report = await importCompanyObjectives(
      file.buffer,
      file.originalname,
      req.user!.company_id,
      req.user!.user_id as string,
      mode,
    );

    const statusCode = report.failed > 0 && report.succeeded === 0 ? 422 : 200;
    res.status(statusCode).json({ status: "success", data: report });
  } catch (error: any) {
    next(error);
  }
};

export const importMonthly = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ status: "fail", message: "No file uploaded." });
    }
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ status: "fail", message: "File size exceeds 5MB limit." });
    }

    const mode = (req.body.mode || "strict") as "strict" | "partial";
    const report = await importMonthlyPlans(
      file.buffer,
      file.originalname,
      req.user!.company_id,
      req.user!.employee_id || req.user!.user_id,
      req.user!.user_id,
      mode,
    );

    const statusCode = report.failed > 0 && report.succeeded === 0 ? 422 : 200;
    res.status(statusCode).json({ status: "success", data: report });
  } catch (error: any) {
    next(error);
  }
};

export const importWeekly = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ status: "fail", message: "No file uploaded." });
    }
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ status: "fail", message: "File size exceeds 5MB limit." });
    }

    const mode = (req.body.mode || "strict") as "strict" | "partial";
    const report = await importWeeklyPlans(
      file.buffer,
      file.originalname,
      req.user!.company_id,
      req.user!.employee_id || req.user!.user_id,
      req.user!.user_id,
      mode,
    );

    const statusCode = report.failed > 0 && report.succeeded === 0 ? 422 : 200;
    res.status(statusCode).json({ status: "success", data: report });
  } catch (error: any) {
    next(error);
  }
};

// ─── Export Handlers ─────────────────────────────────────────────────────────

export const exportQuarterly = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    if (!cycleId || isNaN(cycleId)) {
      return res.status(400).json({ status: "fail", message: "cycle_id query parameter is required." });
    }

    const { buffer, filename } = await exportQuarterlyOKR(
      req.user!.company_id,
      req.user!.employee_id || req.user!.user_id,
      cycleId,
    );

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer as unknown as ArrayBuffer));
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const exportCompany = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    if (!cycleId || isNaN(cycleId)) {
      return res.status(400).json({ status: "fail", message: "cycle_id query parameter is required." });
    }

    const buffer = await exportCompanyObjectives(cycleId);
    const filename = `company_okrs_cycle_${cycleId}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer as any);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const exportMonthly = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const cycleId = parseInt(req.query.cycle_id as string);
    if (!cycleId || isNaN(cycleId)) {
      return res.status(400).json({ status: "fail", message: "cycle_id query parameter is required." });
    }

    const monthNumber = req.query.month_number
      ? parseInt(req.query.month_number as string)
      : undefined;
    const employeeKrId = req.query.employee_kr_id
      ? parseInt(req.query.employee_kr_id as string)
      : undefined;

    const { buffer, filename } = await exportMonthlyPlans(
      req.user!.company_id,
      req.user!.employee_id || req.user!.user_id,
      cycleId,
      monthNumber,
      employeeKrId,
    );

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer as any);
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const exportWeekly = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const employeeMonthPlanId = parseInt(req.query.employee_month_plan_id as string);
    if (!employeeMonthPlanId || isNaN(employeeMonthPlanId)) {
      return res.status(400).json({
        status: "fail",
        message: "employee_month_plan_id query parameter is required.",
      });
    }

    const weekNumber = req.query.week_number
      ? parseInt(req.query.week_number as string)
      : undefined;

    const { buffer, filename } = await exportWeeklyPlans(
      req.user!.company_id,
      req.user!.employee_id || req.user!.user_id,
      employeeMonthPlanId,
      weekNumber,
    );

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer as any);
  } catch (error: any) {
    if (error.message?.includes("not found") || error.message?.includes("not owned")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

// ─── Template Download Handlers ──────────────────────────────────────────────

export const downloadQuarterlyTemplate = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const buffer = await generateQuarterlyTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="quarterly_okr_template.xlsx"');
    res.send(buffer as any);
  } catch (error: any) {
    next(error);
  }
};

export const downloadCompanyTemplate = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const buffer = await generateCompanyTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="company_okr_template.xlsx"');
    res.send(buffer as any);
  } catch (error: any) {
    next(error);
  }
};

export const downloadMonthlyTemplate = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const buffer = await generateMonthlyTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="monthly_plan_template.xlsx"');
    res.send(buffer as any);
  } catch (error: any) {
    next(error);
  }
};

export const downloadWeeklyTemplate = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const buffer = await generateWeeklyTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="weekly_plan_template.xlsx"');
    res.send(buffer as any);
  } catch (error: any) {
    next(error);
  }
};
