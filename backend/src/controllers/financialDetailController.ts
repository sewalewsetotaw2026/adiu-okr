
import { Request, Response, NextFunction } from "express";
import { prisma } from "../app";
import { redisService } from "src/services/redisService";

export const createFinancialDetail = async (
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

    const { bank_id, account_number, account_holder_name, is_primary } = req.body;

    const { validateIsNumeric } = require("../utils/validation");
    if (account_number && !validateIsNumeric(account_number)) {
      return res.status(400).json({
        status: "fail",
        message: `Account number '${account_number}' must be numeric`,
      });
    }

    const newDetail = await prisma.financialDetail.create({
      data: {
        employee_id: employeeId,
        company_id: companyId,
        bank_id: parseInt(bank_id),
        account_number,
        account_holder_name,
        is_primary: is_primary || true, // Default to true if first or unspecified
      },
      include: {
        bank: true,
      },
    });

    if (newDetail.is_primary) {
      await prisma.financialDetail.updateMany({
        where: {
          employee_id: employeeId,
          company_id: companyId,
          id: { not: newDetail.id }
        },
        data: { is_primary: false }
      });
    }

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
      data: {
        financialDetail: newDetail,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getFinancialDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { employeeId } = req.params;
    const companyId = (req as any).user?.company_id;

    const details = await prisma.financialDetail.findMany({
      where: {
        employee_id: employeeId,
        company_id: companyId,
      },
      include: {
        bank: true,
      },
      orderBy: {
        created_at: "desc",
      },
    });

    res.status(200).json({
      status: "success",
      data: {
        financialDetails: details,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateFinancialDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { bank_id, account_number, account_holder_name, is_primary } = req.body;

    const { validateIsNumeric } = require("../utils/validation");
    if (account_number && !validateIsNumeric(account_number)) {
      return res.status(400).json({
        status: "fail",
        message: `Account number '${account_number}' must be numeric`,
      });
    }

    const updatedDetail = await prisma.financialDetail.update({
      where: { id: parseInt(id) },
      data: {
        bank_id: bank_id ? parseInt(bank_id) : undefined,
        account_number,
        account_holder_name,
        is_primary,
      },
      include: {
        bank: true,
      },
    });

    if (is_primary) {
      await prisma.financialDetail.updateMany({
        where: {
          employee_id: updatedDetail.employee_id,
          company_id: updatedDetail.company_id,
          id: { not: updatedDetail.id },
        },
        data: { is_primary: false },
      });
    }

    // Invalidate Cache
    const companyId = updatedDetail.company_id;
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
        financialDetail: updatedDetail,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFinancialDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    await prisma.financialDetail.delete({
      where: { id: parseInt(id) },
    });

    // We need companyId to invalidate cache. 
    // Ideally we should get it from the record before deleting, or from req.user if we trust the middleware check.
    // The middleware check isn't explicit here but usually protected.
    // Let's safe fetch or use req.user
    const companyId = (req as any).user?.company_id;

    if (companyId) {
      redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:managers:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:teams:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:team_member:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:team_members_list:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:employees_search:*`).catch(console.error);
      redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const replaceEmployeeFinancialDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id: employeeId } = req.params;
    const companyId = (req as any).user?.company_id;
    const { financialDetails } = req.body;

    if (!companyId) {
      return res.status(400).json({ status: "fail", message: "Company ID missing" });
    }

    if (!Array.isArray(financialDetails)) {
      return res.status(400).json({
        status: "fail",
        message: "financialDetails must be an array",
      });
    }

    const { validateIsNumeric } = require("../utils/validation");

    // Pre-validate all entries
    for (const detail of financialDetails) {
      const accountNumber = detail.account_number || detail.accountNumber;
      if (accountNumber && !validateIsNumeric(accountNumber)) {
        return res.status(400).json({
          status: "fail",
          message: `Account number '${accountNumber}' must be numeric`,
        });
      }
    }

    // Use transaction to delete and recreate
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing
      await tx.financialDetail.deleteMany({
        where: {
          employee_id: employeeId,
          company_id: companyId,
        },
      });

      // 2. Create new ones
      if (financialDetails.length > 0) {
        await tx.financialDetail.createMany({
          data: financialDetails.map((detail: any) => ({
            employee_id: employeeId,
            company_id: companyId,
            bank_id: parseInt(detail.bank_id || detail.bankId),
            account_number: detail.account_number || detail.accountNumber,
            account_holder_name: detail.account_holder_name || detail.accountHolderName,
            is_primary: detail.is_primary || detail.isPrimary || false,
          })),
        });
      }
    });



    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Financial details updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
