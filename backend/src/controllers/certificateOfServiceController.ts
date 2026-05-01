import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { CertificateOfServiceService } from "../services/certificateOfServiceService";
import { RoleNames, isSuperAdminRole } from "../utils/roleConstants";

/**
 * Generate a Certificate of Service PDF for an employee
 * 
 * Certificate of Service is a formal, factual document containing:
 * - Employee name
 * - Job title(s) and dates
 * - Salary information
 * - Tax/pension confirmation
 * 
 * Used for: Legal/administrative purposes, proof of employment, HR records
 */
export const generateCertificateOfService = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = (req as any).user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Fetch employee details with full career history
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: id,
          company_id: companyId,
        },
      },
      include: {
        employments: {
          include: {
            department: true,
            jobTitle: true,
          },
          orderBy: {
            start_date: "asc",
          },
        },
        careerEvents: {
          include: {
            newJobTitle: true,
            previousJobTitle: true,
            newEmployment: {
              include: {
                department: true,
              },
            },
            previousEmployment: {
              include: {
                department: true,
              },
            },
          },
          orderBy: {
            effective_date: "asc",
          },
        },
        company: {
          select: {
            name: true,
            logo_url: true,
            stamp_url: true,
            primary_color: true,
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    // Extract basic fields needed for the certificate
    const activeEmployment = (employee as any).employments.find((e: any) => e.is_active) || (employee as any).employments[0];

    // Determine signer
    let signerName = undefined;
    let signerTitle = undefined;
    let signerSignatureUrl = undefined;
    const currentUserRole = (req as any).user?.role;
    const currentEmployeeId = (req as any).user?.employee_id;

    const isActive = (employee as any).employments.some((e: any) => e.is_active);
    const docType = isActive ? "CERTIFICATE_OF_SERVICE" : "CERTIFICATE_OF_SERVICE_RESIGNED";

    // 1. Try to get configured signer
    const signerConfig = await prisma.documentSignerConfig.findUnique({
      where: {
        company_id_document_type: {
          company_id: companyId,
          document_type: docType,
        },
      },
      include: {
        employee: {
          select: {
            full_name: true,
            signature_url: true,
            employments: {
              where: { is_active: true },
              take: 1,
              include: { jobTitle: true },
            },
          },
        },
      },
    });

    if (
      signerConfig &&
      signerConfig.employee &&
      signerConfig.employee.employments.length > 0
    ) {
      signerName = signerConfig.employee.full_name;
      signerTitle =
        signerConfig.signer_title ||
        signerConfig.employee.employments[0]?.jobTitle?.title;
      signerSignatureUrl = signerConfig.employee.signature_url;
    } else {
      if (
        currentUserRole === RoleNames.HR ||
        currentUserRole === RoleNames.ADMIN ||
        isSuperAdminRole(currentUserRole || "")
      ) {
        if (currentEmployeeId) {
          const signer = await prisma.employee.findUnique({
            where: { id: currentEmployeeId },
            select: {
              full_name: true,
              signature_url: true,
              employments: {
                where: { is_active: true },
                take: 1,
                include: { jobTitle: true },
              },
            },
          });
          if (signer) {
            signerName = signer.full_name;
            signerTitle = signer.employments[0]?.jobTitle?.title;
            signerSignatureUrl = signer.signature_url;
          }
        }
      }
    }

    const employeeData = {
      ...employee,
      start_date: activeEmployment?.start_date,
      signer_name: signerName,
      signer_title: signerTitle,
      signer_signature_url: signerSignatureUrl,
    };

    const pdfBuffer = await CertificateOfServiceService.generate(employeeData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Certificate_of_Service_${employee.full_name.replace(/\s+/g, "_")}.pdf"`,
    );
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("[CertificateOfServiceController] Error:", error);
    next(error);
  }
};
