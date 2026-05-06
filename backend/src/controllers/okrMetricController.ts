import { Request, Response, NextFunction } from "express";
import * as metricService from "src/services/okrMetricService";

function parseId(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a valid positive integer.`);
  }
  return parsed;
}

export const createMetric = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const metric = await metricService.createMetric({
      ...req.body,
      companyId: req.user!.company_id,
    });
    res.status(201).json({ status: "success", data: metric });
  } catch (error) {
    next(error);
  }
};

export const listMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const metrics = await metricService.listMetrics(req.user!.company_id);
    res
      .status(200)
      .json({ status: "success", results: metrics.length, data: metrics });
  } catch (error) {
    next(error);
  }
};

export const updateMetric = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const metricId = parseId(req.params.id, "Metric id");

    const metric = await metricService.updateMetric({
      metricId,
      companyId: req.user!.company_id,
      ...req.body,
    });

    res.status(200).json({ status: "success", data: metric });
  } catch (error: any) {
    if (error.message?.includes("must be a valid positive integer")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const deleteMetric = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const metricId = parseId(req.params.id, "Metric id");
    const result = await metricService.deleteMetric(
      req.user!.company_id,
      metricId,
    );
    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (message.includes("must be a valid positive integer")) {
      return res.status(400).json({ status: "fail", message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ status: "fail", message });
    }
    if (message.includes("in use")) {
      return res.status(400).json({ status: "fail", message });
    }
    next(error);
  }
};

export const listMetricCategories = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const categories = await metricService.listMetricCategories(
      req.user!.company_id,
      req.user!.user_id,
    );

    res.status(200).json({
      status: "success",
      results: categories.length,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

export const createMetricCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const category = await metricService.createMetricCategory({
      ...req.body,
      companyId: req.user!.company_id,
      actorId: req.user!.user_id,
    });

    res.status(201).json({ status: "success", data: category });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (
      message.includes("required") ||
      message.includes("could not") ||
      message.includes("Invalid")
    ) {
      return res.status(400).json({ status: "fail", message });
    }
    next(error);
  }
};

export const updateMetricCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const categoryId = parseId(req.params.id, "Category id");

    const category = await metricService.updateMetricCategory({
      categoryId,
      companyId: req.user!.company_id,
      ...req.body,
    });

    res.status(200).json({ status: "success", data: category });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (
      message.includes("must be a valid positive integer") ||
      message.includes("cannot") ||
      message.includes("Invalid") ||
      message.includes("empty")
    ) {
      return res.status(400).json({ status: "fail", message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ status: "fail", message });
    }
    next(error);
  }
};

export const deleteMetricCategory = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const categoryId = parseId(req.params.id, "Category id");
    const result = await metricService.deleteMetricCategory(
      req.user!.company_id,
      categoryId,
    );

    res.status(200).json({ status: "success", data: result });
  } catch (error: any) {
    const message = String(error?.message || "");
    if (message.includes("must be a valid positive integer")) {
      return res.status(400).json({ status: "fail", message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ status: "fail", message });
    }
    if (message.includes("in use") || message.includes("cannot")) {
      return res.status(400).json({ status: "fail", message });
    }
    next(error);
  }
};
