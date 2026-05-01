import { Request, Response } from "express";
import * as archiveService from "src/services/okrArchiveService";

// ─── Close Cycle ──────────────────────────────────────────────────────────────

export async function closeCycleCtrl(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.params.id);
    const actorId = req.user!.user_id;

    const data = await archiveService.closeCycle(cycleId, companyId, actorId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(400).json({ status: "fail", message: err.message });
  }
}

// ─── Archive Quarter ──────────────────────────────────────────────────────────

export async function archiveQuarter(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const cycleId = Number(req.body.cycle_id);
    const actorId = req.user!.user_id;
    if (!cycleId) return res.status(400).json({ status: "fail", message: "cycle_id is required." });

    const data = await archiveService.archiveQuarter(companyId, cycleId, actorId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(400).json({ status: "fail", message: err.message });
  }
}

// ─── List Archives ────────────────────────────────────────────────────────────

export async function listArchives(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const data = await archiveService.listArchives(companyId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(500).json({ status: "error", message: err.message });
  }
}

// ─── Get Archive Detail ───────────────────────────────────────────────────────

export async function getArchiveDetail(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const archiveId = Number(req.params.id);

    const data = await archiveService.getArchiveDetail(archiveId, companyId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(400).json({ status: "fail", message: err.message });
  }
}

// ─── Generate Report ──────────────────────────────────────────────────────────

export async function generateReport(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const archiveId = Number(req.params.id);
    const { report_type } = req.body;
    const actorId = req.user!.user_id;
    if (!report_type) return res.status(400).json({ status: "fail", message: "report_type is required." });

    const data = await archiveService.generateArchiveReport(archiveId, companyId, report_type, actorId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(400).json({ status: "fail", message: err.message });
  }
}

// ─── Generate Insight ─────────────────────────────────────────────────────────

export async function generateInsight(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const archiveId = Number(req.params.id);
    const { insight_type } = req.body;
    const actorId = req.user!.user_id;
    if (!insight_type) return res.status(400).json({ status: "fail", message: "insight_type is required." });

    const data = await archiveService.generateArchiveInsight(archiveId, companyId, insight_type, actorId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(400).json({ status: "fail", message: err.message });
  }
}

// ─── Create Export Job ────────────────────────────────────────────────────────

export async function createExportJob(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const archiveId = Number(req.params.id);
    const { export_type, format } = req.body;
    const actorId = req.user!.user_id;
    if (!export_type || !format) {
      return res.status(400).json({ status: "fail", message: "export_type and format are required." });
    }

    const data = await archiveService.createExportJob(archiveId, companyId, export_type, format, actorId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(400).json({ status: "fail", message: err.message });
  }
}

// ─── Get Export Job ───────────────────────────────────────────────────────────

export async function getExportJobCtrl(req: Request, res: Response) {
  try {
    const companyId = req.user!.company_id;
    const jobId = Number(req.params.id);

    const data = await archiveService.getExportJob(jobId, companyId);
    return res.json({ status: "success", data });
  } catch (err: any) {
    return res.status(400).json({ status: "fail", message: err.message });
  }
}
