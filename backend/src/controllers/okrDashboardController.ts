import { Request, Response } from "express";
import * as dashboardService from "src/services/okrDashboardService";
import {
  refreshFullRollup,
  getCompletionStatus,
  getFinancialBreakdown,
} from "src/services/okrRollupService";
import { prisma } from "src/app";

// ─── CEO Dashboard ────────────────────────────────────────────────────────────

export async function getCeoDashboard(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.query.cycle_id);
    if (!cycleId)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });

    const data = await dashboardService.getCeoDashboard(companyId, cycleId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

// ─── Department Comparison ────────────────────────────────────────────────────

export async function getDepartmentComparison(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.query.cycle_id);
    if (!cycleId)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });

    const data = await dashboardService.getDepartmentComparison(
      companyId,
      cycleId,
    );
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

// ─── Company OKR Gallery ──────────────────────────────────────────────────────

export async function getCompanyOkrGallery(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.query.cycle_id);
    if (!cycleId)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });

    const data = await dashboardService.getCompanyOkrGallery(
      companyId,
      cycleId,
    );
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

// ─── Financial Breakdown ──────────────────────────────────────────────────────

export async function getFinancialBreakdownCtrl(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.query.cycle_id);
    if (!cycleId)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });

    const data = await getFinancialBreakdown(companyId, cycleId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

// ─── At-Risk Summary ──────────────────────────────────────────────────────────

export async function getAtRiskSummary(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.query.cycle_id);
    if (!cycleId)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });

    const data = await dashboardService.getAtRiskSummary(companyId, cycleId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

// ─── Completion Status ────────────────────────────────────────────────────────

export async function getCompletionStatusCtrl(req: Request, res: Response) {
  try {
    const level = (req.query.level as string)?.toUpperCase() as
      | "EMPLOYEE"
      | "DEPARTMENT"
      | "COMPANY";
    if (!level || !["EMPLOYEE", "DEPARTMENT", "COMPANY"].includes(level)) {
      return res.status(400).json({
        status: "fail",
        message:
          "level query param required: EMPLOYEE, DEPARTMENT, or COMPANY.",
      });
    }

    const idParam = req.params.id || (req.query.id as string);
    let entityId = Number(idParam);

    // Backward compatibility: allow /completion?level=EMPLOYEE without :id
    if (!entityId && level === "EMPLOYEE") {
      const cycleId = Number(req.query.cycle_id);
      let objective = await prisma.employeeObjective.findFirst({
        where: {
          company_id: req.user!.company_id,
          user_id: req.user!.user_id,
          ...(cycleId ? { cycle_id: cycleId } : {}),
        },
        orderBy: [{ updated_at: "desc" }, { id: "desc" }],
        select: { id: true },
      });

      // Admin/manager compatibility for runner flows where employee objective
      // belongs to a different user than requester.
      if (!objective) {
        objective = await prisma.employeeObjective.findFirst({
          where: {
            company_id: req.user!.company_id,
            ...(cycleId ? { cycle_id: cycleId } : {}),
          },
          orderBy: [{ updated_at: "desc" }, { id: "desc" }],
          select: { id: true },
        });
      }

      if (!objective) {
        return res.status(404).json({
          status: "fail",
          message: "No employee objective found for completion status.",
        });
      }

      entityId = objective.id;
    }

    if (!entityId) {
      return res.status(400).json({
        status: "fail",
        message: "id is required in path or query for completion status.",
      });
    }

    const data = await getCompletionStatus(entityId, level);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

// ─── Trigger Full Rollup ──────────────────────────────────────────────────────

export async function triggerRollupRefresh(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.body.cycle_id);
    if (!cycleId)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });

    const data = await refreshFullRollup(companyId, cycleId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

// ─── Generate Snapshot ────────────────────────────────────────────────────────

export async function generateSnapshotCtrl(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.body.cycle_id);
    const actorId = req.user!.user_id;
    if (!cycleId)
      return res
        .status(400)
        .json({ status: "fail", message: "cycle_id is required." });

    const data = await dashboardService.generateSnapshot(
      companyId,
      cycleId,
      actorId,
    );
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}
