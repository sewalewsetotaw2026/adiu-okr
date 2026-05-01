import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { ResignedCertificateOfServiceService } from "../services/resignationLetter";

import { RoleNames, isSuperAdminRole } from "../utils/roleConstants";

export const generateResignationLetter = async (
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

    // Fetch employee details
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

    // Prepare employee data for the PDF
    const activeEmployment =
      (employee as any).employments.find((e: any) => e.is_active) ||
      (employee as any).employments[0];

    // Determine signer from configuration or fallback to current user
    let signerName = undefined;
    let signerTitle = undefined;
    let signerSignatureUrl = undefined;

    // Try to get configured signer first
    const signerConfig = await prisma.documentSignerConfig.findUnique({
      where: {
        company_id_document_type: {
          company_id: companyId,
          document_type: "CERTIFICATE_OF_SERVICE_RESIGNED",
        },
      },
      include: {
        employee: {
          include: {
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
      signerConfig?.employee &&
      signerConfig.employee.employments.length > 0
    ) {
      signerName = signerConfig.employee.full_name;
      signerTitle = signerConfig.employee.employments[0]?.jobTitle?.title;
      signerSignatureUrl = signerConfig.employee.signature_url;
    } else {
      // Fallback: Use current user if they have appropriate roles
      const currentUserRole = (req as any).user?.role;
      const currentEmployeeId = (req as any).user?.employee_id;

      if (
        currentUserRole === RoleNames.HR ||
        currentUserRole === RoleNames.ADMIN ||
        isSuperAdminRole(currentUserRole || "")
      ) {
        if (currentEmployeeId) {
          const fallbackSigner = await prisma.employee.findUnique({
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
          if (fallbackSigner) {
            signerName = fallbackSigner.full_name;
            signerTitle = fallbackSigner.employments[0]?.jobTitle?.title;
            signerSignatureUrl = fallbackSigner.signature_url;
          }
        }
      }
    }

    const employeeData = {
      ...employee,
      start_date: activeEmployment?.start_date,
      end_date: activeEmployment?.end_date,
      signer_name: signerName,
      signer_title: signerTitle,
      signer_signature_url: signerSignatureUrl,
    };

    // Generate PDF buffer
    const pdfBuffer =
      await ResignedCertificateOfServiceService.generate(employeeData);

    // Send PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Certificate Of Service For A Resigned Employee (Multiple Roles).pdf"',
    );

    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("[ResignationLetterController] Error:", error);
    next(error);
  }
};
