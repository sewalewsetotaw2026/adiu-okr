import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";

export const createFieldOfStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide field of study name",
      });
    }

    const existing = await prisma.fieldOfStudy.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(409).json({
        status: "fail",
        message: "Field of Study already exists",
        data: { fieldOfStudy: existing },
      });
    }

    const fieldOfStudy = await prisma.fieldOfStudy.create({
      data: { name },
    });

    // Invalidate Cache
    const companyId = req.user?.company_id;
    if (companyId) {
      redisService.delByPattern(`company:${companyId}:*`).catch(console.error);
    }

    res.status(201).json({
      status: "success",
      message: "Field of Study created successfully",
      data: { fieldOfStudy },
    });
  } catch (error) {
    next(error);
  }
};
