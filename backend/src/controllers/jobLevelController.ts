
import { Request, Response, NextFunction } from "express";
import { prisma } from "../app";
import { redisService } from "src/services/redisService";

export const createJobLevel = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide job level name",
      });
    }

    const existing = await prisma.jobLevel.findUnique({
      where: {
        company_id_name: {
          company_id: companyId,
          name: name,
        },
      },
    });

    if (existing) {
      return res.status(200).json({
        status: "success",
        message: "Job level already exists",
        data: {
          jobLevel: existing,
        },
      });
    }

    const jobLevel = await prisma.jobLevel.create({
      data: {
        company_id: companyId,
        name: name,
      },
    });

    // Invalidate Cache
    const patterns = [
      `company:${companyId}:employees:*`,
      `company:${companyId}:managers:*`,
      `company:${companyId}:teams:*`,
      `company:${companyId}:team_member:*`,
      `company:${companyId}:team_members_list:*`,
      `company:${companyId}:employees_search:*`,
      `company:${companyId}:analytics:*`,
    ];
    Promise.all(patterns.map(p => redisService.delByPattern(p))).catch(console.error);

    res.status(201).json({
      status: "success",
      message: "Job level created successfully",
      data: {
        jobLevel,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getJobLevels = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;

    const where: any = {};
    if (companyId) where.company_id = companyId;

    const jobLevels = await prisma.jobLevel.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    res.status(200).json({
      status: "success",
      results: jobLevels.length,
      data: {
        jobLevels,
      },
    });
  } catch (error) {
    next(error);
  }
};
