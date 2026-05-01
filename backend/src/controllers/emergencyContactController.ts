import { Request, Response, NextFunction } from "express";
import { prisma } from "../app";
import { redisService } from "../services/redisService";

export const createEmergencyContact = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId } = req.params;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "Company ID missing" });
    }

    const { full_name, relationship, phone_number, email, is_primary } = req.body;

    const { validateFullName, validatePhoneNumber, normalizePhoneNumber } = require("../utils/validation");
    if (full_name && !validateFullName(full_name)) {
      return res.status(400).json({
        status: "fail",
        message: "Full Name must contain exactly three words (First Middle Last)",
      });
    }

    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (phone_number && !normalizedPhone) {
      return res.status(400).json({
        status: "fail",
        message: `Invalid phone number format: ${phone_number}. Please use international format (e.g., +251...) or local format (09...).`,
      });
    }

    const newContact = await prisma.emergencyContact.create({
      data: {
        employee_id: employeeId,
        company_id: companyId,
        full_name,
        relationship,
        phone_number: normalizedPhone || phone_number,
        email,
        is_primary: is_primary || false,
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

    res.status(201).json({
      status: "success",
      message: "Emergency contact created successfully",
      data: {
        emergencyContact: newContact,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getEmergencyContacts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId } = req.params;
    const companyId = (req as any).user?.company_id;

    const contacts = await prisma.emergencyContact.findMany({
      where: {
        employee_id: employeeId,
        company_id: companyId,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      status: "success",
      data: {
        contacts,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmergencyContact = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id; // Added for cache invalidation
    const { full_name, relationship, phone_number, email, is_primary } = req.body;

    const { validateFullName, validatePhoneNumber, normalizePhoneNumber } = require("../utils/validation");
    if (full_name && !validateFullName(full_name)) {
      return res.status(400).json({
        status: "fail",
        message: "Full Name must contain exactly three words (First Middle Last)",
      });
    }

    let normalizedPhone: string | null = null;
    if (phone_number) {
      normalizedPhone = normalizePhoneNumber(phone_number);
      if (!normalizedPhone) {
        return res.status(400).json({
          status: "fail",
          message: `Invalid phone number format: ${phone_number}. Please use international format (e.g., +251...) or local format (09...).`,
        });
      }
    }

    const updatedContact = await prisma.emergencyContact.update({
      where: { id: parseInt(id) },
      data: {
        full_name,
        relationship,
        phone_number: normalizedPhone || undefined,
        email,
        is_primary,
      },
    });

    // If setting as primary, unset others for this employee? 
    // Usually only one primary emergency contact or allow multiple? 
    // Requirement said "at least one", implied maybe primary. 
    // Logic for single primary:
    if (is_primary) {
      await prisma.emergencyContact.updateMany({
        where: {
          employee_id: updatedContact.employee_id,
          company_id: updatedContact.company_id,
          id: { not: updatedContact.id },
        },
        data: { is_primary: false },
      });
    }

    // Invalidate Cache
    if (companyId) { // Ensure companyId is available
      redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    }

    res.status(200).json({
      status: "success",
      data: {
        contact: updatedContact,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmergencyContact = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id; // Added for cache invalidation

    await prisma.emergencyContact.delete({
      where: { id: parseInt(id) },
    });

    // Invalidate Cache
    if (companyId) { // Ensure companyId is available
      redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
export const replaceEmployeeEmergencyContacts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: employeeId } = req.params;
    const companyId = (req as any).user?.company_id;
    const { emergencyContacts } = req.body;

    if (!Array.isArray(emergencyContacts)) {
      return res.status(400).json({
        status: "fail",
        message: "emergencyContacts must be an array",
      });
    }

    const { validateFullName, validatePhoneNumber, normalizePhoneNumber } = require("../utils/validation");
    // Pre-process contacts for validation and normalization
    const processedContacts: any[] = [];

    for (const contact of emergencyContacts) {
      const name = contact.full_name || contact.fullName;
      const phone = contact.phone_number || contact.phoneNumber;

      if (name && !validateFullName(name)) {
        return res.status(400).json({
          status: "fail",
          message: `Full Name '${name}' must contain exactly three words (First Middle Last)`,
        });
      }

      const normalizedPhone = normalizePhoneNumber(phone);
      if (phone && !normalizedPhone) {
        return res.status(400).json({
          status: "fail",
          message: `Invalid phone number format: ${phone}. Please use international format (e.g., +251...) or local format (09...).`,
        });
      }

      processedContacts.push({
        ...contact,
        phone_number: normalizedPhone || phone
      });
    }

    // Use transaction to delete and recreate
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing
      await tx.emergencyContact.deleteMany({
        where: {
          employee_id: employeeId,
          company_id: companyId,
        },
      });

      // 2. Create new ones
      if (processedContacts.length > 0) {
        await tx.emergencyContact.createMany({
          data: processedContacts.map((contact: any) => ({
            employee_id: employeeId,
            company_id: companyId,
            full_name: contact.full_name || contact.fullName,
            relationship: contact.relationship,
            phone_number: contact.phone_number,
            email: contact.email,
            is_primary: contact.is_primary || contact.isPrimary || false,
          })),
        });
      }
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Emergency contacts updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
