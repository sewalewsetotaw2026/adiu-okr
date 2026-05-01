import { Request, Response, NextFunction } from "express";
import prisma from "src/prisma";
import { sanitizeFileUrl } from "src/services/supabaseService";

import { redisService } from "src/services/redisService";

export const updatePersonalDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "Company ID missing" });
    }

    const {
      full_name,
      gender,
      date_of_birth,
      tin_number,
      pension_number,
      place_of_work,
      profile_picture,
      onboarding_status
    } = req.body;

    // Only include appUsers if we need to update them
    const includeAppUsers = profile_picture !== undefined || onboarding_status !== undefined;

    const existing = await prisma.employee.findUnique({
      where: { id_company_id: { id, company_id: companyId } },
      include: { appUsers: includeAppUsers }
    });

    if (!existing) return res.status(404).json({ status: "fail", message: "Employee not found" });

    // Check TIN uniqueness
    if (tin_number && tin_number !== existing.tin_number) {
      const dup = await prisma.employee.findFirst({
        where: {
          company_id: companyId,
          tin_number,
        },
      });
      if (dup) return res.status(400).json({ status: "fail", message: "TIN already exists" });
    }

    const parsedDob = date_of_birth ? new Date(date_of_birth) : null;

    await prisma.$transaction(async (tx) => {
      // Update Core
      await tx.employee.update({
        where: { id_company_id: { id, company_id: companyId } },
        data: {
          full_name,
          gender,
          date_of_birth: parsedDob && !isNaN(parsedDob.getTime()) ? parsedDob : undefined,
          tin_number,
          pension_number,
          place_of_work,
          ...(profile_picture !== undefined && { profile_picture_url: sanitizeFileUrl(profile_picture) || null })
        }
      });

      // Update AppUser Status
      if (onboarding_status !== undefined) {
        if (existing.appUsers.length > 0) {
          await tx.appUser.updateMany({
            where: { employee_id: id, company_id: companyId },
            data: {
              onboarding_status,
            }
          });
        }
      }
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({ status: "success", message: "Personal details updated" });
  } catch (error) {
    next(error);
  }
};

export const updateEmployeeSignature = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res
        .status(400)
        .json({ status: "fail", message: "Company ID missing" });
    }

    const { signature_url } = req.body;

    // We accept empty string or null to clear it, but undefined means no change which shouldn't happen here
    if (signature_url === undefined) {
      return res
        .status(400)
        .json({ status: "fail", message: "Signature URL is required" });
    }

    const existing = await prisma.employee.findUnique({
      where: { id_company_id: { id, company_id: companyId } },
    });

    if (!existing)
      return res
        .status(404)
        .json({ status: "fail", message: "Employee not found" });

    await prisma.employee.update({
      where: { id_company_id: { id, company_id: companyId } },
      data: {
        signature_url,
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

    res
      .status(200)
      .json({ status: "success", message: "Signature updated successfully" });
  } catch (error) {
    next(error);
  }
};
