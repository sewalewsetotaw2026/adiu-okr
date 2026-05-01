import { Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { ExperienceLetterService } from "../services/experienceLetterService";

export const generateExperienceLetter = async (
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

    // Extract basic fields needed for the letter
    const activeEmployment = (employee as any).employments.find((e: any) => e.is_active) || (employee as any).employments[0];

    const employeeData = {
      ...employee,
      start_date: activeEmployment?.start_date,
    };

    const pdfBuffer = await ExperienceLetterService.generate(employeeData);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Experience_Letter_${employee.full_name.replace(/\s+/g, "_")}.pdf"`,
    );
    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
