import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { redisService } from "src/services/redisService";

export const createJobTitle = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const { title, level } = req.body;

    // Validation
    if (!title) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide job title",
      });
    }

    // Use empty string as default for level to satisfy composite key
    const resolvedLevel = level || "";

    // Check if job title already exists
    const jobtitle = await prisma.jobTitle.findUnique({
      where: {
        company_id_title_level: {
          company_id: companyId,
          title: title,
          level: resolvedLevel,
        },
      },
    });

    if (jobtitle) {
      return res.status(409).json({
        status: "fail",
        message: "job title already exists",
      });
    }

    const jobTitle = await prisma.jobTitle.create({
      data: {
        company_id: companyId,
        title: title,
        level: resolvedLevel,
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
      message: "job title created created successfully",
      data: {
        jobTitle,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getJobTitles = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session"
      });
    }

    const whereClause: any = { company_id: companyId };

    const jobTitles = await prisma.jobTitle.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        level: true,
        company_id: true,
      },
    });

    res.status(200).json({
      status: "success",
      results: jobTitles.length,
      data: {
        jobTitles,
      },
    });
  } catch (error) {
    next(error);
  }
};
