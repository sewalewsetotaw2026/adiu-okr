import { prisma } from "../app";
import { createNotification, NotificationType } from "./notificationService";
import { sendEmail } from "../utils/email";

/**
 * Probation Notification Service
 * Handles alerts for probation milestones
 */

const getCompanyBranding = async (companyId: number) => {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      primary_color: true,
      secondary_color: true,
      logo_url: true,
    },
  });

  return {
    companyName: company?.name || "Kacha HRIS",
    primaryColor: company?.primary_color || "#e55400",
    secondaryColor: company?.secondary_color || "#ffda00",
    logoUrl: company?.logo_url || undefined,
  };
};

export const checkAndNotifyProbationMilestones = async (): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all active employments
    const employments = await prisma.employment.findMany({
      where: {
        is_active: true,
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            company_id: true,
          },
        },
      },
    });

    // Cache for company settings to avoid redundant DB calls
    const companySettingsMap = new Map<number, { probation_period_days: number, probation_notification_days: number }>();

    for (const emp of employments) {
      if (!emp.employee) continue;
      const companyId = emp.employee.company_id;

      let settings = companySettingsMap.get(companyId);
      if (!settings) {
        const dbSettings = await prisma.employeeSettings.findUnique({
          where: { company_id: companyId },
        });
        settings = {
          probation_period_days: dbSettings?.probation_period_days ?? 90,
          probation_notification_days: dbSettings?.probation_notification_days ?? 5,
        };
        companySettingsMap.set(companyId, settings);
      }

      const startDate = new Date(emp.start_date);
      startDate.setHours(0, 0, 0, 0);

      const probationEndDate = emp.probation_end_date
        ? new Date(emp.probation_end_date)
        : new Date(startDate.getTime() + settings.probation_period_days * 24 * 60 * 60 * 1000);
      
      probationEndDate.setHours(0, 0, 0, 0);

      const totalDays = Math.ceil((probationEndDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      const remainingDays = Math.ceil((probationEndDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
      const elapsedDays = totalDays - remainingDays;
      const halfWay = Math.floor(totalDays / 2);

      let milestoneReached = false;
      let milestoneLabel = "";

      if (elapsedDays === halfWay - settings.probation_notification_days) {
        milestoneReached = true;
        milestoneLabel = `is approaching its halfway point (${remainingDays} days remaining)`;
      } else if (elapsedDays === halfWay) {
        milestoneReached = true;
        milestoneLabel = `has reached the halfway point (${remainingDays} days remaining)`;
      } else if (remainingDays === settings.probation_notification_days) {
        milestoneReached = true;
        milestoneLabel = `is ending in ${settings.probation_notification_days} days`;
      } else if (remainingDays === 1) {
        milestoneReached = true;
        milestoneLabel = "is ending tomorrow";
      } else if (remainingDays === 0) {
        milestoneReached = true;
        milestoneLabel = "is ending today";
      }

      if (milestoneReached) {
        await notifyHRAndAdmins(emp, milestoneLabel);
      }
    }
  } catch (error) {
    console.error("[ProbationNotificationService] Error in checkAndNotifyProbationMilestones:", error);
  }
};

const notifyHRAndAdmins = async (employment: any, milestoneLabel: string) => {
  const companyId = employment.company_id;
  const employeeName = employment.employee.full_name;

  // Get HR and Admin roles
  const roles = await prisma.appRole.findMany({
    where: {
      company_id: companyId,
      name: { in: ["HR", "Admin", "ADMIN", "Super Admin"] },
    },
    select: {
      appUsers: {
        select: {
          employee_id: true,
          email: true,
        },
      },
    },
  });

  const recipients = new Set<{ employee_id: string; email: string | null }>();
  roles.forEach((role) => {
    role.appUsers.forEach((user) => {
      if (user.employee_id) {
        recipients.add({ employee_id: user.employee_id, email: user.email });
      }
    });
  });

  const title = `Probation Milestone: ${employeeName}`;
  const message = `Employee ${employeeName} has reached a probation milestone: ${milestoneLabel}.`;

  const branding = await getCompanyBranding(companyId);

  for (const recipient of recipients) {
    // In-app notification
    await createNotification({
      company_id: companyId,
      recipient_id: recipient.employee_id,
      type: NotificationType.PROBATION_MILESTONE,
      title,
      message,
      action_url: `/admin/employees/${employment.employee.id}?tab=probation`,
      related_entity_type: "employment",
      related_entity_id: employment.id,
      email_sent: !!recipient.email,
    });

    // Email
    if (recipient.email) {
      await sendEmail({
        to: recipient.email,
        subject: `${title} - ${branding.companyName}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: ${branding.primaryColor};">${title}</h2>
            <p>${message}</p>
            <p>Please review the employee's performance and take necessary action.</p>
            <a href="${process.env.FRONTEND_URL}/admin/employees/${employment.employee.id}?tab=probation" 
               style="display: inline-block; padding: 10px 20px; background-color: ${branding.primaryColor}; color: white; text-decoration: none; border-radius: 4px; margin-top: 10px;">
               View Employee Profile
            </a>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">Sent by ${branding.companyName} HRIS</p>
          </div>
        `,
      });
    }
  }
};
