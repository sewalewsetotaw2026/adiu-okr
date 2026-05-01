import { Request, Response, NextFunction } from "express";
import * as cycleService from "src/services/okrCycleService";

export const createCycle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, quarter_label, start_date, end_date, description } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({
        status: "fail",
        message: "name, start_date, and end_date are required.",
      });
    }

    const cycle = await cycleService.createCycle({
      companyId: req.user!.company_id,
      name,
      quarterLabel: quarter_label,
      startDate: start_date,
      endDate: end_date,
      description,
      createdBy: req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: cycle });
  } catch (error: any) {
    if (error.message?.includes("already exists")) {
      return res.status(409).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const updateCycle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const { name, quarter_label, start_date, end_date, description } = req.body;

    const cycle = await cycleService.updateCycle(id, req.user!.company_id, {
      name,
      quarterLabel: quarter_label,
      startDate: start_date,
      endDate: end_date,
      description,
    });

    res.status(200).json({ status: "success", data: cycle });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    if (error.message?.includes("Only DRAFT")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const listCycles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cycles = await cycleService.listCycles(req.user!.company_id);
    res.status(200).json({ status: "success", results: cycles.length, data: cycles });
  } catch (error) {
    next(error);
  }
};

export const getCycleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const cycle = await cycleService.getCycleById(id, req.user!.company_id);
    res.status(200).json({ status: "success", data: cycle });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const openCycle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const cycle = await cycleService.openCycle(id, req.user!.company_id, req.user!.user_id);
    res.status(200).json({ status: "success", data: cycle });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    if (error.message?.includes("already open") || error.message?.includes("Only DRAFT")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const closeCycle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const cycle = await cycleService.closeCycle(id, req.user!.company_id, req.user!.user_id);
    res.status(200).json({ status: "success", data: cycle });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    if (error.message?.includes("Only OPEN")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const getCurrentOpenCycle = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cycle = await cycleService.getCurrentOpenCycle(req.user!.company_id);
    if (!cycle) {
      return res.status(200).json({ status: "success", data: null, message: "No open cycle." });
    }
    res.status(200).json({ status: "success", data: cycle });
  } catch (error) {
    next(error);
  }
};

export const getArchiveReadySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    const summary = await cycleService.getArchiveReadySummary(id, req.user!.company_id);
    res.status(200).json({ status: "success", data: summary });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};
