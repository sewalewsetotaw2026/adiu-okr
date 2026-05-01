import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";

export const createInstitution = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide institution name",
      });
    }

    const existing = await prisma.institution.findUnique({
      where: { name },
    });

    if (existing) {
      return res.status(409).json({
        status: "fail",
        message: "Institution already exists",
        data: { institution: existing },
      });
    }

    const institution = await prisma.institution.create({
      data: {
        name,
        category: 'Private' // Default, user can't select type in fast create
      },
    });

    // Invalidate Cache
    const companyId = req.user?.company_id;
    if (companyId) {
      redisService.delByPattern(`company:${companyId}:*`).catch(console.error);
    }

    res.status(201).json({
      status: "success",
      message: "Institution created successfully",
      data: { institution },
    });
  } catch (error) {
    next(error);
  }
};
