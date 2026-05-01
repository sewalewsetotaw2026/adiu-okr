import { NextFunction, Request, Response } from "express";
import * as configService from "src/services/okrConfigService";

export const listConfigurations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await configService.listConfigurationValues(
      req.user!.company_id,
    );
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const getConfigurationMenu = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await configService.getConfigurationMenu(req.user!.company_id);
    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const upsertConfigurationMenu = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const data = await configService.upsertConfigurationMenu(
      req.user!.company_id,
      req.user!.user_id,
      req.body,
    );

    res.status(200).json({ status: "success", data });
  } catch (error: any) {
    if (error.message?.includes("must be")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const getConfigurationByKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { key } = req.params;
    const data = await configService.getConfigurationByKey(
      req.user!.company_id,
      key,
    );

    if (data === null) {
      return res.status(404).json({
        status: "fail",
        message: `Configuration key '${key}' not found.`,
      });
    }

    res.status(200).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};

export const createConfigurationByKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { key } = req.params;

    if (!Object.prototype.hasOwnProperty.call(req.body || {}, "value")) {
      return res.status(400).json({
        status: "fail",
        message: "Request body must include a 'value' field.",
      });
    }

    const data = await configService.createConfigurationByKey(
      req.user!.company_id,
      req.user!.user_id,
      key,
      req.body.value,
    );

    res.status(201).json({ status: "success", data });
  } catch (error: any) {
    if (
      error.message?.includes("already exists") ||
      error.message?.includes("must be")
    ) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const updateConfigurationByKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { key } = req.params;

    if (!Object.prototype.hasOwnProperty.call(req.body || {}, "value")) {
      return res.status(400).json({
        status: "fail",
        message: "Request body must include a 'value' field.",
      });
    }

    const data = await configService.upsertConfigurationByKey(
      req.user!.company_id,
      req.user!.user_id,
      key,
      req.body.value,
    );

    res.status(200).json({ status: "success", data });
  } catch (error: any) {
    if (error.message?.includes("must be")) {
      return res.status(400).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};

export const deleteConfigurationByKey = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { key } = req.params;
    const data = await configService.deleteConfigurationByKey(
      req.user!.company_id,
      req.user!.user_id,
      key,
    );

    res.status(200).json({ status: "success", data });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return res.status(404).json({ status: "fail", message: error.message });
    }
    next(error);
  }
};
