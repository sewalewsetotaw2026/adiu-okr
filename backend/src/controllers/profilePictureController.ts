import { Request, Response, NextFunction } from "express";
import { prisma } from "../app";
import { redisService } from "src/services/redisService";

export const updateProfilePicture = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params; // Employee ID
    const companyId = (req as any).user?.company_id;
    const { profile_picture_url } = req.body;

    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "Company ID missing" });
    }

    const updatedEmployee = await prisma.employee.update({
      where: {
        id_company_id: {
          id: id,
          company_id: companyId,
        },
      },
      data: {
        profile_picture_url,
      },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      data: {
        profile_picture_url: updatedEmployee.profile_picture_url,
      },
    });
  } catch (error) {
    next(error);
  }
};
