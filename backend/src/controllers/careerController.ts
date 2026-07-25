/**
 * Career Controller for Kacha HRIS
 *
 * Handles promotion, demotion, and transfer operations for employees.
 * Uses the existing EmployeeCareerEvent model for tracking career changes.
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { Prisma } from "@prisma/client"; // Add this for the Decimal type
import { getCareerEventEmailHtml } from "src/utils/emailTemplates";
import { sendEmail } from "src/utils/email";
import * as celebrationService from "src/services/celebrationService";
import * as notificationService from "src/services/notificationService";
import { redisService } from "src/services/redisService";

// ============================================
// PROMOTE EMPLOYEE
// ============================================

export const promoteEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const recordedBy = req.user?.employee_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const {
      employee_id,
      new_job_title_id,
      new_job_title_name,
      new_job_level_name,
      new_gross_salary,
      new_basic_salary,
      new_department_id,
      new_department_name,
      effective_date,
      justification,
      notes,
      approved_by,
      new_allowances,
      document_urls,
    } = req.body;

    // Validate required fields
    if (!employee_id || !new_gross_salary || !effective_date) {
      return res.status(400).json({
        status: "fail",
        message:
          "employee_id, new_gross_salary, and effective_date are required",
      });
    }

    // Validate that either job title ID or name is provided
    if (!new_job_title_id && !new_job_title_name) {
      return res.status(400).json({
        status: "fail",
        message: "Either new_job_title_id or new_job_title_name is required",
      });
    }

    // Get current employment
    const currentEmployment = await prisma.employment.findFirst({
      where: {
        employee_id,
        company_id: companyId,
        is_active: true,
      },
      include: {
        employee: true,
        jobTitle: true,
        department: true,
      },
    });

    if (!currentEmployment) {
      return res.status(404).json({
        status: "fail",
        message: "Active employment not found for this employee",
      });
    }

    // Resolve job title - first try by ID, then by name (upsert)
    let resolvedJobTitleId: number | null = null;
    let newJobTitle: any = null;

    if (new_job_title_id && !isNaN(parseInt(new_job_title_id))) {
      resolvedJobTitleId = parseInt(new_job_title_id);
      newJobTitle = await prisma.jobTitle.findFirst({
        where: { id: resolvedJobTitleId, company_id: companyId },
      });
    }

    if (!newJobTitle && new_job_title_name) {
      // Upsert job title by name
      const jobLevel = new_job_level_name || "";

      // ALSO: Ensure this level exists in JobLevel table
      if (jobLevel) {
        await prisma.jobLevel.upsert({
          where: {
            company_id_name: {
              company_id: companyId,
              name: jobLevel,
            },
          },
          update: {},
          create: {
            company_id: companyId,
            name: jobLevel,
          },
        });
      }

      newJobTitle = await prisma.jobTitle.upsert({
        where: {
          company_id_title_level: {
            company_id: companyId,
            title: new_job_title_name,
            level: jobLevel,
          },
        },
        update: {},
        create: {
          company_id: companyId,
          title: new_job_title_name,
          level: jobLevel,
        },
      });
      resolvedJobTitleId = newJobTitle.id;
    }

    if (!newJobTitle || !resolvedJobTitleId) {
      return res.status(404).json({
        status: "fail",
        message: "New job title not found and could not be created",
      });
    }

    // Resolve department - by ID or by name
    let resolvedDeptId: number | null = null;
    if (new_department_id && !isNaN(parseInt(new_department_id))) {
      resolvedDeptId = parseInt(new_department_id);
    } else if (new_department_name) {
      const dept = await prisma.department.upsert({
        where: {
          company_id_name: {
            company_id: companyId,
            name: new_department_name,
          },
        },
        update: {},
        create: {
          company_id: companyId,
          name: new_department_name,
        },
      });
      resolvedDeptId = dept.id;
    }

    const parsedDeptId = resolvedDeptId;
    const parsedJobId = resolvedJobTitleId;

    // Create career event and update employment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Deactivate ALL active employments to prevent duplicates
      await tx.employment.updateMany({
        where: {
          employee_id: employee_id,
          company_id: companyId,
          is_active: true
        },
        data: {
          is_active: false,
          end_date: new Date(effective_date),
        },
      });

      // 2. Create NEW employment record (snapshot)
      const newEmploymentRecord = await tx.employment.create({
        data: {
          employee_id: employee_id,
          company_id: companyId,
          manager_id: currentEmployment.manager_id,
          department_id: parsedDeptId || currentEmployment.department_id,
          job_title_id: parsedJobId,
          employment_type: currentEmployment.employment_type,
          start_date: new Date(effective_date),
          gross_salary: parseFloat(new_gross_salary),
          basic_salary: new_basic_salary
            ? parseFloat(new_basic_salary)
            : currentEmployment.basic_salary,
          is_active: true,
        },
      });

      // 3. Create the career event record linking history
      const careerEvent = await tx.employeeCareerEvent.create({
        data: {
          employee_id,
          event_type: "Promotion",
          event_date: new Date(),
          effective_date: new Date(effective_date),
          previous_employment_id: currentEmployment.id,
          new_employment_id: newEmploymentRecord.id,
          previous_job_title_id: currentEmployment.job_title_id,
          new_job_title_id: parsedJobId,
          previous_salary: currentEmployment.gross_salary,
          new_salary: parseFloat(new_gross_salary),
          department_changed:
            parsedDeptId !== null &&
            parsedDeptId !== currentEmployment.department_id,
          justification,
          notes,
          document_urls,
          approved_by,
          recorded_by: recordedBy,
        },
        include: {
          employee: true,
          previousJobTitle: true,
          newJobTitle: true,
        },
      });

      // 4. Handle Allowances - link to NEW employment
      if (new_allowances && Array.isArray(new_allowances)) {
        // Deactivate old ones
        await tx.employeeAllowance.updateMany({
          where: { employment_id: currentEmployment.id, is_active: true },
          data: { is_active: false, end_date: new Date(effective_date) },
        });

        // Create new ones
        if (new_allowances.length > 0) {
          await tx.employeeAllowance.createMany({
            data: new_allowances.map((a: any) => ({
              employment_id: newEmploymentRecord.id,
              allowance_type_id: a.allowance_type_id,
              amount: a.amount,
              currency: a.currency || "ETB",
              is_active: true,
              effective_date: new Date(effective_date),
            })),
          });
        }
      } else {
        // Carry forward existing allowances if not explicitly updated
        const currentAllowances = await tx.employeeAllowance.findMany({
          where: { employment_id: currentEmployment.id, is_active: true },
        });
        if (currentAllowances.length > 0) {
          await tx.employeeAllowance.createMany({
            data: currentAllowances.map((a) => ({
              employment_id: newEmploymentRecord.id,
              allowance_type_id: a.allowance_type_id,
              amount: a.amount,
              currency: a.currency,
              is_active: true,
              effective_date: new Date(effective_date),
            })),
          });
          await tx.employeeAllowance.updateMany({
            where: { employment_id: currentEmployment.id, is_active: true },
            data: { is_active: false, end_date: new Date(effective_date) },
          });
        }
      }

      return { careerEvent, updatedEmployment: newEmploymentRecord };
    });

    // Send notification email
    const employeeUser = await prisma.appUser.findFirst({
      where: { employee_id, company_id: companyId },
      select: { email: true },
    });

    if (employeeUser?.email) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          primary_color: true,
          secondary_color: true,
          logo_url: true,
        },
      });

      const companyName = company?.name || "Kacha HRIS";
      const primaryColor = company?.primary_color || "#e55400";
      const secondaryColor = company?.secondary_color || "#ffda00";
      const logoUrl = company?.logo_url || undefined;

      const emailHtml = getCareerEventEmailHtml(
        currentEmployment.employee.full_name,
        "promotion",
        currentEmployment.jobTitle?.title || "Previous Position",
        newJobTitle.title,
        effective_date,
        parseFloat(new_gross_salary),
        justification,
        companyName,
        logoUrl,
        primaryColor,
        secondaryColor
      );

      await sendEmail({
        to: employeeUser.email,
        subject: `Congratulations on Your Promotion! - ${companyName}`,
        html: emailHtml,
      });
    }

    // Trigger Celebration for PROMOTION
    try {
      console.log(
        "[Celebration] Creating promotion celebration for employee:",
        employee_id,
        "company:",
        companyId,
      );

      const prevTitle =
        currentEmployment.jobTitle?.title || "Previous Position";
      const newTitle = newJobTitle.title || "New Position";

      const celebration = await celebrationService.createPromotionCelebration(
        employee_id,
        companyId,
        prevTitle,
        newTitle,
      );

      console.log(
        "[Celebration] Celebration created successfully, ID:",
        celebration.id,
      );

      // Use dynamic import to avoid circular dependency
      const celebrationController =
        await import("src/controllers/celebrationController");
      celebrationController.broadcastNewCelebration(companyId, celebration);
      console.log("[Celebration] Broadcast completed");

      // Personalized Notification for the promoted employee
      await notificationService.createNotification({
        company_id: companyId,
        recipient_id: employee_id,
        type: notificationService.NotificationType.PROMOTION,
        title: "Congratulations on Your Promotion!",
        message: `You have been promoted from ${prevTitle} to ${newTitle}. Check out your celebration post!`,
        action_url: `/celebrations/${celebration.id}`,
        related_entity_type: "Celebration",
        related_entity_id: celebration.id,
      });
    } catch (celebrationError) {
      console.error(
        "[Celebration] Failed to trigger promotion celebration:",
        celebrationError,
      );
    }


    // Invalidate Cache for Employee data
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
      message: "Employee promoted successfully",
      data: {
        careerEvent: result.careerEvent,
        employment: result.updatedEmployment,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// DEMOTE EMPLOYEE
// ============================================

export const demoteEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const recordedBy = req.user?.employee_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const {
      employee_id,
      new_job_title_id,
      new_gross_salary,
      new_basic_salary,
      new_department_id,
      effective_date,
      justification,
      notes,
      approved_by,
      new_allowances,
      document_urls,
    } = req.body;

    const parsedDeptId = new_department_id ? parseInt(new_department_id) : null;
    const parsedJobId = parseInt(new_job_title_id);

    if (
      !employee_id ||
      !new_job_title_id ||
      !new_gross_salary ||
      !effective_date ||
      !justification
    ) {
      return res.status(400).json({
        status: "fail",
        message:
          "employee_id, new_job_title_id, new_gross_salary, effective_date, and justification are required",
      });
    }

    const currentEmployment = await prisma.employment.findFirst({
      where: { employee_id, company_id: companyId, is_active: true },
      include: { employee: true, jobTitle: true, department: true },
    });

    if (!currentEmployment) {
      return res
        .status(404)
        .json({ status: "fail", message: "Active employment not found" });
    }

    const newJobTitle = await prisma.jobTitle.findFirst({
      where: { id: parsedJobId, company_id: companyId },
    });

    if (!newJobTitle) {
      return res
        .status(404)
        .json({ status: "fail", message: "New job title not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Deactivate ALL active employments
      await tx.employment.updateMany({
        where: {
          employee_id: employee_id,
          company_id: companyId,
          is_active: true
        },
        data: { is_active: false, end_date: new Date(effective_date) },
      });

      const newEmploymentRecord = await tx.employment.create({
        data: {
          employee_id: employee_id,
          company_id: companyId,
          manager_id: currentEmployment.manager_id,
          department_id: parsedDeptId || currentEmployment.department_id,
          job_title_id: parsedJobId,
          employment_type: currentEmployment.employment_type,
          start_date: new Date(effective_date),
          gross_salary: parseFloat(new_gross_salary),
          basic_salary: new_basic_salary
            ? parseFloat(new_basic_salary)
            : currentEmployment.basic_salary,
          is_active: true,
        },
      });

      const careerEvent = await tx.employeeCareerEvent.create({
        data: {
          employee_id,
          event_type: "Demotion",
          event_date: new Date(),
          effective_date: new Date(effective_date),
          previous_employment_id: currentEmployment.id,
          new_employment_id: newEmploymentRecord.id,
          previous_job_title_id: currentEmployment.job_title_id,
          new_job_title_id: parsedJobId,
          previous_salary: currentEmployment.gross_salary,
          new_salary: parseFloat(new_gross_salary),
          department_changed:
            parsedDeptId !== null &&
            parsedDeptId !== currentEmployment.department_id,
          justification,
          notes,
          document_urls,
          approved_by,
          recorded_by: recordedBy,
        },
        include: { employee: true, previousJobTitle: true, newJobTitle: true },
      });

      if (new_allowances && Array.isArray(new_allowances)) {
        await tx.employeeAllowance.updateMany({
          where: { employment_id: currentEmployment.id, is_active: true },
          data: { is_active: false, end_date: new Date(effective_date) },
        });
        if (new_allowances.length > 0) {
          await tx.employeeAllowance.createMany({
            data: new_allowances.map((a: any) => ({
              employment_id: newEmploymentRecord.id,
              allowance_type_id: a.allowance_type_id,
              amount: a.amount,
              currency: a.currency || "ETB",
              is_active: true,
              effective_date: new Date(effective_date),
            })),
          });
        }
      } else {
        const currentAllowances = await tx.employeeAllowance.findMany({
          where: { employment_id: currentEmployment.id, is_active: true },
        });
        if (currentAllowances.length > 0) {
          await tx.employeeAllowance.createMany({
            data: currentAllowances.map((a) => ({
              employment_id: newEmploymentRecord.id,
              allowance_type_id: a.allowance_type_id,
              amount: a.amount,
              currency: a.currency,
              is_active: true,
              effective_date: new Date(effective_date),
            })),
          });
          await tx.employeeAllowance.updateMany({
            where: { employment_id: currentEmployment.id, is_active: true },
            data: { is_active: false, end_date: new Date(effective_date) },
          });
        }
      }

      return { careerEvent, updatedEmployment: newEmploymentRecord };
    });

    const employeeUser = await prisma.appUser.findFirst({
      where: { employee_id, company_id: companyId },
      select: { email: true },
    });

    if (employeeUser?.email) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          primary_color: true,
          secondary_color: true,
          logo_url: true,
        },
      });

      const companyName = company?.name || "Kacha HRIS";
      const primaryColor = company?.primary_color || "#e55400";
      const secondaryColor = company?.secondary_color || "#ffda00";
      const logoUrl = company?.logo_url || undefined;

      const emailHtml = getCareerEventEmailHtml(
        currentEmployment.employee.full_name,
        "demotion",
        currentEmployment.jobTitle?.title || "Previous Position",
        newJobTitle.title,
        effective_date,
        parseFloat(new_gross_salary),
        justification,
        companyName,
        logoUrl,
        primaryColor,
        secondaryColor
      );
      await sendEmail({
        to: employeeUser.email,
        subject: `Position Change Notice - ${companyName}`,
        html: emailHtml,
      });
    }


    // Invalidate Cache for Employee data
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
      message: "Employee demotion recorded successfully",
      data: {
        careerEvent: result.careerEvent,
        employment: result.updatedEmployment,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// TRANSFER EMPLOYEE
// ============================================

export const transferEmployee = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const recordedBy = req.user?.employee_id;

    if (!companyId) {
      return res
        .status(400)
        .json({ status: "fail", message: "Company ID not found" });
    }

    const {
      employee_id,
      new_department_id,
      new_job_title_id,
      effective_date,
      justification,
      notes,
      approved_by,
      new_allowances,
      document_urls,
    } = req.body;

    const parsedDeptId = parseInt(new_department_id);
    const parsedJobId = new_job_title_id ? parseInt(new_job_title_id) : null;

    if (!employee_id || !new_department_id || !effective_date) {
      return res.status(400).json({
        status: "fail",
        message:
          "employee_id, new_department_id, and effective_date are required",
      });
    }

    const currentEmployment = await prisma.employment.findFirst({
      where: { employee_id, company_id: companyId, is_active: true },
      include: { employee: true, jobTitle: true, department: true },
    });

    if (!currentEmployment) {
      return res
        .status(404)
        .json({ status: "fail", message: "Active employment not found" });
    }

    const newDepartment = await prisma.department.findUnique({
      where: { id: parseInt(new_department_id) },
    });

    if (!newDepartment) {
      return res
        .status(404)
        .json({ status: "fail", message: "New department not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Deactivate ALL active employments
      await tx.employment.updateMany({
        where: {
          employee_id: employee_id,
          company_id: companyId,
          is_active: true
        },
        data: { is_active: false, end_date: new Date(effective_date) },
      });

      const newEmploymentRecord = await tx.employment.create({
        data: {
          employee_id: employee_id,
          company_id: companyId,
          manager_id: currentEmployment.manager_id,
          department_id: parsedDeptId,
          job_title_id: parsedJobId || currentEmployment.job_title_id,
          employment_type: currentEmployment.employment_type,
          start_date: new Date(effective_date),
          gross_salary: currentEmployment.gross_salary,
          basic_salary: currentEmployment.basic_salary,
          is_active: true,
        },
      });

      const careerEvent = await tx.employeeCareerEvent.create({
        data: {
          employee_id,
          event_type: "Transfer",
          event_date: new Date(),
          effective_date: new Date(effective_date),
          previous_employment_id: currentEmployment.id,
          new_employment_id: newEmploymentRecord.id,
          previous_job_title_id: currentEmployment.job_title_id,
          new_job_title_id: parsedJobId || currentEmployment.job_title_id,
          previous_salary: currentEmployment.gross_salary,
          new_salary: currentEmployment.gross_salary,
          department_changed: true,
          justification,
          notes,
          document_urls,
          approved_by,
          recorded_by: recordedBy,
        },
        include: { employee: true, previousJobTitle: true, newJobTitle: true },
      });

      // Handle Allowances (Carry forward)
      if (new_allowances && Array.isArray(new_allowances)) {
        await tx.employeeAllowance.updateMany({
          where: { employment_id: currentEmployment.id, is_active: true },
          data: { is_active: false, end_date: new Date(effective_date) },
        });
        if (new_allowances.length > 0) {
          await tx.employeeAllowance.createMany({
            data: new_allowances.map((a: any) => ({
              employment_id: newEmploymentRecord.id,
              allowance_type_id: a.allowance_type_id,
              amount: a.amount,
              currency: a.currency || "ETB",
              is_active: true,
              effective_date: new Date(effective_date),
            })),
          });
        }
      } else {
        const currentAllowances = await tx.employeeAllowance.findMany({
          where: { employment_id: currentEmployment.id, is_active: true },
        });
        if (currentAllowances.length > 0) {
          await tx.employeeAllowance.createMany({
            data: currentAllowances.map((a) => ({
              employment_id: newEmploymentRecord.id,
              allowance_type_id: a.allowance_type_id,
              amount: a.amount,
              currency: a.currency,
              is_active: true,
              effective_date: new Date(effective_date),
            })),
          });
          await tx.employeeAllowance.updateMany({
            where: { employment_id: currentEmployment.id, is_active: true },
            data: { is_active: false, end_date: new Date(effective_date) },
          });
        }
      }

      return { careerEvent, updatedEmployment: newEmploymentRecord };
    });

    const employeeUser = await prisma.appUser.findFirst({
      where: { employee_id, company_id: companyId },
      select: { email: true },
    });

    if (employeeUser?.email) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          primary_color: true,
          secondary_color: true,
          logo_url: true,
        },
      });

      const companyName = company?.name || "Kacha HRIS";
      const primaryColor = company?.primary_color || "#e55400";
      const secondaryColor = company?.secondary_color || "#ffda00";
      const logoUrl = company?.logo_url || undefined;

      const emailHtml = getCareerEventEmailHtml(
        currentEmployment.employee.full_name,
        "transfer",
        `${currentEmployment.jobTitle?.title || "Position"} (${currentEmployment.department?.name || "Dept"})`,
        `${currentEmployment.jobTitle?.title || "Position"} (${newDepartment.name})`,
        effective_date,
        undefined,
        justification,
        companyName,
        logoUrl,
        primaryColor,
        secondaryColor
      );
      await sendEmail({
        to: employeeUser.email,
        subject: `Department Transfer Notice - ${companyName}`,
        html: emailHtml,
      });
    }


    // Invalidate Cache for Employee data
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
      message: "Employee transfer recorded successfully",
      data: {
        careerEvent: result.careerEvent,
        employment: result.updatedEmployment,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET CAREER EVENTS FOR EMPLOYEE
// ============================================

export const getEmployeeCareerEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const { employeeId } = req.params;

    if (!companyId) {
      return res
        .status(400)
        .json({ status: "fail", message: "Company ID not found" });
    }

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, company_id: companyId },
    });

    if (!employee) {
      return res
        .status(404)
        .json({ status: "fail", message: "Employee not found" });
    }

    const careerEvents = await prisma.employeeCareerEvent.findMany({
      where: { employee_id: employeeId },
      include: {
        previousJobTitle: true,
        newJobTitle: true,
        previousEmployment: {
          include: {
            department: true,
            manager: {
              select: {
                id: true,
                full_name: true
              }
            }
          },
        },
        newEmployment: {
          include: {
            department: true,
            manager: {
              select: {
                id: true,
                full_name: true
              }
            }
          },
        },
        approver: { select: { id: true, full_name: true } },
        recorder: { select: { id: true, full_name: true } },
      },
      orderBy: { effective_date: "desc" },
    });

    res.status(200).json({
      status: "success",
      data: {
        employee: { id: employee.id, full_name: employee.full_name },
        careerEvents,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// GET ALL CAREER EVENTS (PAGINATED)
// ============================================

export const getAllCareerEvents = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res
        .status(400)
        .json({ status: "fail", message: "Company ID not found" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const eventType = req.query.event_type as string;
    const employeeId = req.query.employee_id as string;

    const where: any = {
      employee: { company_id: companyId },
    };

    if (eventType) where.event_type = eventType;
    if (employeeId) where.employee_id = employeeId;

    const [careerEvents, total] = await Promise.all([
      prisma.employeeCareerEvent.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: { select: { id: true, full_name: true } },
          previousJobTitle: true,
          newJobTitle: true,
          approver: { select: { id: true, full_name: true } },
          previousEmployment: { include: { department: true } },
          newEmployment: { include: { department: true } },
        },
        orderBy: { event_date: "desc" },
      }),
      prisma.employeeCareerEvent.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      data: {
        careerEvents,
        pagination: { total, page, limit, totalPages },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing Career Event
 */
export const updateCareerEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const recordedBy = req.user?.employee_id;

    const {
      careerEventId,
      new_job_title_id,
      new_job_title_name,
      new_department_id,
      new_department_name,
      new_gross_salary,
      new_basic_salary,
      effective_date,
      justification,
      notes,
      approved_by,
      new_allowances,
      document_urls,
    } = req.body;

    if (!careerEventId) {
      return res.status(400).json({
        status: "fail",
        message: "careerEventId is required",
      });
    }

    // Fetch existing career event with employment data
    const careerEvent = await prisma.employeeCareerEvent.findUnique({
      where: { id: careerEventId },
      include: {
        newEmployment: true,
        previousEmployment: true,
      },
    });

    if (!careerEvent) {
      return res.status(404).json({
        status: "fail",
        message: "Career event not found",
      });
    }

    const updatedResult = await prisma.$transaction(async (tx) => {
      // Resolve job title
      let resolvedJobTitleId = new_job_title_id
        ? parseInt(new_job_title_id)
        : careerEvent.new_job_title_id;

      if (!resolvedJobTitleId && new_job_title_name) {
        const jobTitle = await tx.jobTitle.upsert({
          where: {
            company_id_title_level: {
              company_id: companyId!,
              title: new_job_title_name,
              level: "",
            },
          },
          create: { company_id: companyId!, title: new_job_title_name, level: "" },
          update: {},
        });
        resolvedJobTitleId = jobTitle.id;
      }

      // Resolve department
      let resolvedDeptId = new_department_id
        ? parseInt(new_department_id)
        : careerEvent.newEmployment?.department_id;

      if (!resolvedDeptId && new_department_name) {
        const department = await tx.department.upsert({
          where: {
            company_id_name: {
              company_id: companyId!,
              name: new_department_name,
            },
          },
          create: { company_id: companyId!, name: new_department_name },
          update: {},
        });
        resolvedDeptId = department.id;
      }

      // Update the linked employment
      const updatedEmployment = await tx.employment.update({
        where: { id: careerEvent.new_employment_id! },
        data: {
          job_title_id: resolvedJobTitleId!,
          department_id: resolvedDeptId!,
          gross_salary: new_gross_salary
            ? new Prisma.Decimal(new_gross_salary)
            : careerEvent.newEmployment?.gross_salary,
          basic_salary: new_basic_salary
            ? new Prisma.Decimal(new_basic_salary)
            : careerEvent.newEmployment?.basic_salary,
          start_date: effective_date
            ? new Date(effective_date)
            : careerEvent.newEmployment?.start_date,
        },
      });

      // Update career event
      const updatedCareerEvent = await tx.employeeCareerEvent.update({
        where: { id: careerEventId },
        data: {
          new_job_title_id: resolvedJobTitleId!,
          new_employment_id: updatedEmployment.id,
          new_salary: new_gross_salary
            ? new Prisma.Decimal(new_gross_salary)
            : careerEvent.new_salary,
          previous_salary: careerEvent.previous_salary,
          department_changed:
            resolvedDeptId !== careerEvent.previousEmployment?.department_id,
          effective_date: effective_date
            ? new Date(effective_date)
            : careerEvent.effective_date,
          justification: justification || careerEvent.justification,
          notes: notes || careerEvent.notes,
          approved_by: approved_by || careerEvent.approved_by,
          document_urls: document_urls || careerEvent.document_urls,
        },
      });

      // Handle Allowances - DELETE, UPDATE, CREATE
      if (new_allowances && Array.isArray(new_allowances)) {
        // Get existing allowances
        const existingAllowances = await tx.employeeAllowance.findMany({
          where: {
            employment_id: careerEvent.new_employment_id!,
            is_active: true,
          },
        });

        const existingAllowanceIds = existingAllowances.map(a => a.id);
        const submittedAllowanceIds = new_allowances.filter(a => a.id).map(a => a.id);
        
        // DELETE allowances that are no longer in the submission
        const allowancesToDelete = existingAllowanceIds.filter(id => !submittedAllowanceIds.includes(id));
        
        if (allowancesToDelete.length > 0) {
          console.log(`Deleting allowances: ${allowancesToDelete.join(', ')}`);
          await tx.employeeAllowance.deleteMany({
            where: {
              id: { in: allowancesToDelete },
            },
          });
        }
        
        // UPDATE or CREATE allowances
        for (const allowance of new_allowances) {
          if (allowance.id) {
            // Check if allowance exists
            const existingAllowance = await tx.employeeAllowance.findUnique({
              where: { id: allowance.id },
            });
            
            if (existingAllowance) {
              // Update existing allowance
              console.log(`Updating allowance ${allowance.id}`);
              await tx.employeeAllowance.update({
                where: { id: allowance.id },
                data: {
                  allowance_type_id: allowance.allowance_type_id,
                  amount: allowance.amount,
                  currency: allowance.currency || "ETB",
                  effective_date: effective_date ? new Date(effective_date) : new Date(),
                },
              });
            } else {
              // Create new allowance (ID provided but doesn't exist)
              console.log(`Creating new allowance for ID ${allowance.id} (didn't exist)`);
              await tx.employeeAllowance.create({
                data: {
                  employment_id: updatedEmployment.id,
                  allowance_type_id: allowance.allowance_type_id,
                  amount: allowance.amount,
                  currency: allowance.currency || "ETB",
                  is_active: true,
                  effective_date: effective_date ? new Date(effective_date) : new Date(),
                },
              });
            }
          } else {
            // Create brand new allowance
            console.log(`Creating brand new allowance`);
            await tx.employeeAllowance.create({
              data: {
                employment_id: updatedEmployment.id,
                allowance_type_id: allowance.allowance_type_id,
                amount: allowance.amount,
                currency: allowance.currency || "ETB",
                is_active: true,
                effective_date: effective_date ? new Date(effective_date) : new Date(),
              },
            });
          }
        }
      }

      return { updatedCareerEvent, updatedEmployment };
    });

    res.status(200).json({
      status: "success",
      message: "Career event updated successfully",
      data: updatedResult,
    });
  } catch (error) {
    next(error);
  }
};
