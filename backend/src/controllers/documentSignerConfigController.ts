import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { redisService } from "src/services/redisService";

export const upsertConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { document_type, signer_employee_id, signer_title } = req.body;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    if (!document_type || !signer_employee_id) {
      return res.status(400).json({
        status: "fail",
        message: "Document Type and Signer Employee ID are required",
      });
    }

    // Verify employee exists and belongs to company
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: signer_employee_id,
          company_id: companyId,
        },
      },
      include: {
        employments: {
          where: { is_active: true },
          include: { jobTitle: true },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Signer employee not found",
      });
    }

    // If no specific title provided, use their current job title
    let resolvedTitle = signer_title;
    if (!resolvedTitle) {
      const activeEmployment = employee.employments[0];
      resolvedTitle = activeEmployment?.jobTitle?.title || "Authorized Signatory";
    }

    const config = await prisma.documentSignerConfig.upsert({
      where: {
        company_id_document_type: {
          company_id: companyId,
          document_type,
        },
      },
      update: {
        signer_employee_id,
        signer_title: resolvedTitle,
      },
      create: {
        company_id: companyId,
        document_type,
        signer_employee_id,
        signer_title: resolvedTitle,
      },
      include: {
        employee: {
          select: {
            full_name: true,
          }
        }
      }
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

export const getConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = (req as any).user?.company_id;
    const { document_type } = req.query;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found",
      });
    }

    if (!document_type) {
      // Return all configs if no type specified
      const configs = await prisma.documentSignerConfig.findMany({
        where: { company_id: companyId },
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
            }
          }
        }
      });
      return res.status(200).json({
        status: "success",
        data: configs
      });
    }

    const config = await prisma.documentSignerConfig.findUnique({
      where: {
        company_id_document_type: {
          company_id: companyId,
          document_type: String(document_type),
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            signature_url: true
          },
        },
      },
    });

    res.status(200).json({
      status: "success",
      data: config,
    });
  } catch (error) {
    next(error);
  }
};
