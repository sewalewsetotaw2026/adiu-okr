import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import bcrypt from "bcryptjs";
import { OnboardingStatus } from "@prisma/client";
import { redisService } from "src/services/redisService";

export const getCompanies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companies = await prisma.company.findMany({
      where: {
        is_deleted: false,
      },
      include: {
        _count: {
          select: {
            employees: true,
            appUsers: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({
      status: "success",
      results: companies.length,
      data: {
        companies,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const registerCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      companyName,
      companyCode,
      adminName,
      adminEmail,
      adminPassword,
      phone,
      companyEmail,
      address,
      logoUrl,
      stampUrl,
      primaryColor,
      secondaryColor,
    } = req.body;

    if (!companyName || !companyCode || !adminEmail || !adminPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide all required fields",
      });
    }

    // Check if company code exists
    const existingCompany = await prisma.company.findUnique({
      where: { company_code: companyCode },
    });
    if (existingCompany) {
      return res.status(400).json({
        status: "fail",
        message: "Company code already exists",
      });
    }

    // Check if admin email exists globally (unique constraint on AppUser)
    const existingUser = await prisma.appUser.findUnique({
      where: { email: adminEmail },
    });
    if (existingUser) {
      return res.status(400).json({
        status: "fail",
        message: "Admin email already exists",
      });
    }

    // Start Transaction to create everything
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Company
      const company = await tx.company.create({
        data: {
          name: companyName,
          company_code: companyCode,
          phone: phone,
          email: companyEmail,
          logo_url: logoUrl,
          stamp_url: stampUrl,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          is_active: true,
        },
      });

      // Resolve source company (typically PLATFORM or KACHA) to copy setup from
      const platformCompany = await tx.company.findUnique({
        where: { company_code: "PLATFORM" }
      });

      const sourceCompanyId = platformCompany?.id || 1; // Fallback to 1 if not found, but log it or handle as error
      if (!platformCompany) {
        console.warn("PLATFORM company not found, falling back to ID 1 for seeding");
      }

      // 2. Copy Departments
      const sourceDepartments = await tx.department.findMany({ where: { company_id: sourceCompanyId } });
      const newDepartmentsData = sourceDepartments.map(d => ({
        company_id: company.id,
        name: d.name,
        department_code: d.department_code,
      }));
      if (newDepartmentsData.length > 0) {
        await tx.department.createMany({ data: newDepartmentsData });
      }
      const newDepartments = await tx.department.findMany({ where: { company_id: company.id } });

      // 3. Copy Job Levels
      const sourceJobLevels = await tx.jobLevel.findMany({ where: { company_id: sourceCompanyId } });
      const newJobLevelsData = sourceJobLevels.map(jl => ({
        company_id: company.id,
        name: jl.name,
      }));
      if (newJobLevelsData.length > 0) {
        await tx.jobLevel.createMany({ data: newJobLevelsData });
      }

      // 4. Copy Job Titles
      const sourceJobTitles = await tx.jobTitle.findMany({ where: { company_id: sourceCompanyId } });
      const newJobTitlesData = sourceJobTitles.map(jt => ({
        company_id: company.id,
        title: jt.title,
        level: jt.level,
      }));
      if (newJobTitlesData.length > 0) {
        await tx.jobTitle.createMany({ data: newJobTitlesData });
      }
      const newJobTitles = await tx.jobTitle.findMany({ where: { company_id: company.id } });

      // 5. Copy Leave Types
      const sourceLeaveTypes = await tx.leaveType.findMany({ where: { company_id: sourceCompanyId } });
      const newLeaveTypesData = sourceLeaveTypes.map(lt => ({
        company_id: company.id,
        name: lt.name,
        code: lt.code,
        default_allowance_days: lt.default_allowance_days,
        incremental_days_per_year: lt.incremental_days_per_year,
        incremental_period_years: lt.incremental_period_years,
        max_accrual_limit: lt.max_accrual_limit,
        is_carry_over_allowed: lt.is_carry_over_allowed,
        carry_over_expiry_months: lt.carry_over_expiry_months,
        applicable_gender: lt.applicable_gender,
        requires_attachment: lt.requires_attachment,
        is_paid: lt.is_paid,
        is_calendar_days: lt.is_calendar_days,
        is_accrual_based: lt.is_accrual_based,
        accrual_frequency: lt.accrual_frequency,
        accrual_divisor: lt.accrual_divisor,
      }));
      if (newLeaveTypesData.length > 0) {
        await tx.leaveType.createMany({ data: newLeaveTypesData });
      }

      // 6. Copy Leave Settings
      const sourceLeaveSettings = await tx.leaveSettings.findUnique({ where: { company_id: sourceCompanyId } });
      if (sourceLeaveSettings) {
        await tx.leaveSettings.create({
          data: {
            company_id: company.id,
            saturday_half_day: sourceLeaveSettings.saturday_half_day,
            sunday_off: sourceLeaveSettings.sunday_off,
            fiscal_year_start_month: sourceLeaveSettings.fiscal_year_start_month,
            accrual_basis: sourceLeaveSettings.accrual_basis,
            require_ceo_approval_for_managers: sourceLeaveSettings.require_ceo_approval_for_managers,
            auto_approve_after_days: sourceLeaveSettings.auto_approve_after_days,
            annual_leave_base_days: sourceLeaveSettings.annual_leave_base_days,
            accrual_frequency: sourceLeaveSettings.accrual_frequency,
            accrual_divisor: sourceLeaveSettings.accrual_divisor,
            increment_period_years: sourceLeaveSettings.increment_period_years,
            increment_amount: sourceLeaveSettings.increment_amount,
            max_annual_leave_cap: sourceLeaveSettings.max_annual_leave_cap,
            enable_leave_expiry: sourceLeaveSettings.enable_leave_expiry,
            expiry_notification_days: sourceLeaveSettings.expiry_notification_days,
            balance_notification_enabled: sourceLeaveSettings.balance_notification_enabled,
            notification_channels: sourceLeaveSettings.notification_channels,
            enable_encashment: sourceLeaveSettings.enable_encashment,
            encashment_salary_divisor: sourceLeaveSettings.encashment_salary_divisor,
            max_encashment_days: sourceLeaveSettings.max_encashment_days,
            encashment_rounding: sourceLeaveSettings.encashment_rounding,
            policy_effective_date: sourceLeaveSettings.policy_effective_date,
            policy_version: sourceLeaveSettings.policy_version,
          }
        });
      }

      // 7. Copy Public Holidays
      const sourceHolidays = await tx.publicHoliday.findMany({ where: { company_id: sourceCompanyId } });
      const newHolidaysData = sourceHolidays.map(ph => ({
        company_id: company.id,
        name: ph.name,
        holiday_date: ph.holiday_date,
        is_recurring: ph.is_recurring,
      }));
      if (newHolidaysData.length > 0) {
        await tx.publicHoliday.createMany({ data: newHolidaysData });
      }

      // 8. Copy Roles and Permissions
      const sourceRoles = await tx.appRole.findMany({
        where: { company_id: sourceCompanyId },
        include: { permissions: true }
      });

      const newRoles = [];
      const permissionsToCreate: { role_id: number; resource_id: number; action: string }[] = [];

      for (const role of sourceRoles) {
        const newRole = await tx.appRole.create({
          data: {
            company_id: company.id,
            name: role.name,
            description: role.description,
          }
        });
        newRoles.push({ oldId: role.id, newId: newRole.id, name: newRole.name, roleObj: newRole });

        for (const p of role.permissions) {
          permissionsToCreate.push({
            role_id: newRole.id,
            resource_id: p.resource_id,
            action: p.action,
          });
        }
      }

      if (permissionsToCreate.length > 0) {
        await tx.appPermission.createMany({ data: permissionsToCreate });
      }

      // 9. Copy AppRoleJobTitle mappings
      const sourceAppRoleJobTitles = await tx.appRoleJobTitle.findMany({ where: { company_id: sourceCompanyId } });
      if (sourceAppRoleJobTitles.length > 0) {
        const newAppRoleJobTitlesData = [];

        const jobTitleOldToNew = new Map();
        for (const oldJt of sourceJobTitles) {
          const newJt = newJobTitles.find(njt => njt.title === oldJt.title && njt.level === oldJt.level);
          if (newJt) jobTitleOldToNew.set(oldJt.id, newJt.id);
        }

        const roleOldToNew = new Map();
        for (const mr of newRoles) {
          roleOldToNew.set(mr.oldId, mr.newId);
        }

        for (const arjt of sourceAppRoleJobTitles) {
          const newRoleId = roleOldToNew.get(arjt.role_id);
          const newJobTitleId = jobTitleOldToNew.get(arjt.job_title_id);
          if (newRoleId && newJobTitleId) {
            newAppRoleJobTitlesData.push({
              company_id: company.id,
              role_id: newRoleId,
              job_title_id: newJobTitleId,
            });
          }
        }

        if (newAppRoleJobTitlesData.length > 0) {
          await tx.appRoleJobTitle.createMany({ data: newAppRoleJobTitlesData });
        }
      }

      // 10. Setup Admin User Environment
      let adminRole = newRoles.find(r => r.name.toLowerCase() === "admin")?.roleObj;
      if (!adminRole) {
        adminRole = await tx.appRole.create({
          data: {
            company_id: company.id,
            name: "Admin",
            description: "Default Admin role",
          }
        });
      }

      let hrDept = newDepartments.find(d => d.name.toLowerCase() === "human resource" || d.name.toLowerCase() === "hr" || d.name.toLowerCase() === "human resources") || newDepartments[0];
      if (!hrDept) {
        hrDept = await tx.department.create({
          data: { company_id: company.id, name: "Human Resource" }
        });
      }

      let hrTitle = newJobTitles.find(t => t.title.toLowerCase() === "hr manager" || t.title.toLowerCase() === "human resource manager" || t.title.toLowerCase() === "administrator") || newJobTitles[0];
      if (!hrTitle) {
        hrTitle = await tx.jobTitle.create({
          data: { company_id: company.id, title: "HR Manager", level: "Manager" }
        });
      }

      // 11. Create Admin Employee Record
      const adminEmployeeId = `EMP-${companyCode}-001`;
      const employee = await tx.employee.create({
        data: {
          id: adminEmployeeId,
          company_id: company.id,
          full_name: adminName,
        },
      });

      // 12. Create Employment Record
      await tx.employment.create({
        data: {
          employee_id: employee.id,
          company_id: company.id,
          department_id: hrDept.id,
          job_title_id: hrTitle.id,
          employment_type: "Full Time",
          start_date: new Date(),
          is_active: true,
        },
      });

      // 13. Create App User
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const user = await tx.appUser.create({
        data: {
          company_id: company.id,
          employee_id: employee.id,
          email: adminEmail,
          password_hash: hashedPassword,
          role_id: adminRole.id,
          is_active: true,
          onboarding_status: OnboardingStatus.COMPLETED,
        },
      });

      return { company, user };
    }, {
      maxWait: 5000, // 5 seconds to get a connection
      timeout: 30000, // 30 seconds for the transaction to complete
    });

    // Invalidate Cache for the newly created company (though likely empty)
    redisService.delByPattern(`company:${result.company.id}:*`).catch(console.error);

    res.status(201).json({
      status: "success",
      data: {
        company: result.company,
        adminUser: result.user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleCompanyStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const company = await prisma.company.update({
      where: { id: Number(id) },
      data: { is_active: isActive },
    });

    // Invalidate cache for the company
    redisService.delByPattern(`company:${id}:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      data: {
        company,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const company = await prisma.company.findUnique({
      where: { id: Number(id), is_deleted: false },
    });

    if (!company) {
      return res.status(404).json({
        status: "fail",
        message: "Company not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        company,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      companyName,
      companyCode,
      phone,
      companyEmail,
      logoUrl,
      stampUrl,
      primaryColor,
      secondaryColor,
    } = req.body;

    const company = await prisma.company.update({
      where: { id: Number(id) },
      data: {
        name: companyName,
        company_code: companyCode,
        phone,
        email: companyEmail,
        logo_url: logoUrl,
        stamp_url: stampUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      },
    });

    // Invalidate cache for the company
    redisService.delByPattern(`company:${id}:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      data: {
        company,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = Number(id);

    if (isNaN(companyId)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid company ID",
      });
    }

    // Soft Delete: Just update flags
    await prisma.company.update({
      where: { id: companyId },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
        is_active: false, // Also deactivate for good measure
      },
    });

    // Invalidate cache for the company
    redisService.delByPattern(`company:${id}:*`).catch(console.error);

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
