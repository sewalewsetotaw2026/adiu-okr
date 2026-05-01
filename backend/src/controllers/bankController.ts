
import { Request, Response, NextFunction } from "express";
import { prisma } from "../app";

export const getBanks = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const banks = await prisma.bank.findMany({
      where: { is_active: true },
      orderBy: { name: "asc" },
    });

    res.status(200).json({
      status: "success",
      data: {
        banks,
      },
      // Also strictly return array for direct consumption if needed by frontend service expectations
      // but usually standard response is cleaner.
    });
  } catch (error) {
    next(error);
  }
};
