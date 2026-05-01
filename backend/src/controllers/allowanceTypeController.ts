import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";

export const getAllowanceTypes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const allowanceTypes = await prisma.allowanceType.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        is_taxable: true,
      },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      status: "success",
      results: allowanceTypes.length,
      data: {
        allowanceTypes,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createAllowanceType = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, description, is_taxable } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide allowance type name",
      });
    }

    // Check if already exists
    const existing = await prisma.allowanceType.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(409).json({
        status: "fail",
        message: "Allowance type with this name already exists",
        data: { allowanceType: existing },
      });
    }

    const allowanceType = await prisma.allowanceType.create({
      data: {
        name,
        description: description || null,
        is_taxable: is_taxable !== undefined ? is_taxable : true,
      },
    });

    res.status(201).json({
      status: "success",
      message: "Allowance type created successfully",
      data: {
        allowanceType,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllowanceTypeById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const allowanceType = await prisma.allowanceType.findUnique({
      where: { id: parseInt(id) },
    });

    if (!allowanceType) {
      return res.status(404).json({
        status: "fail",
        message: "Allowance type not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        allowanceType,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAllowanceType = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description, is_taxable } = req.body;

    const existing = await prisma.allowanceType.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existing) {
      return res.status(404).json({
        status: "fail",
        message: "Allowance type not found",
      });
    }

    const allowanceType = await prisma.allowanceType.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(is_taxable !== undefined && { is_taxable }),
      },
    });

    res.status(200).json({
      status: "success",
      message: "Allowance type updated successfully",
      data: {
        allowanceType,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAllowanceType = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const existing = await prisma.allowanceType.findUnique({
      where: { id: parseInt(id) },
      include: { allowances: true },
    });

    if (!existing) {
      return res.status(404).json({
        status: "fail",
        message: "Allowance type not found",
      });
    }

    if (existing.allowances.length > 0) {
      return res.status(400).json({
        status: "fail",
        message: "Cannot delete allowance type that is in use by employees",
      });
    }

    await prisma.allowanceType.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      status: "success",
      message: "Allowance type deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
