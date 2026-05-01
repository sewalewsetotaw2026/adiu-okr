import { Request, Response, NextFunction } from "express";
import * as metricService from "src/services/okrMetricService";

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
