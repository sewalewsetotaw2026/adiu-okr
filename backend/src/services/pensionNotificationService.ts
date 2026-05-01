import { prisma } from "../app";
import { createNotification, NotificationType } from "./notificationService";
import { sendEmail } from "../utils/email";

/**
 * Pension Notification Service
 * Handles alerts for upcoming employee retirement (pension)
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

export const checkAndNotifyPensionMilestones = async (): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all active employees
    const employees = await prisma.employee.findMany({
      where: {
        employments: {
          some: { is_active: true }
        }
      },
      select: {
        id: true,
        full_name: true,
        company_id: true,
        date_of_birth: true,
      }
    });

    console.log(`[PensionNotificationService] Checking ${employees.length} employees for retirement milestones.`);

    // Cache for company settings to avoid redundant DB calls
    const companySettingsMap = new Map<number, { pension_age: number, pension_notification_days: number }>();

    for (const emp of employees) {
      if (!emp.date_of_birth) {
        console.log(`[PensionNotificationService] Skipping ${emp.full_name} - DOB missing.`);
        continue;
      }
      const companyId = emp.company_id;

      let settings = companySettingsMap.get(companyId);
      if (!settings) {
        const dbSettings = await (prisma.employeeSettings.findUnique({
          where: { company_id: companyId },
        }) as any);
        settings = {
          pension_age: dbSettings?.pension_age ?? 60,
          pension_notification_days: dbSettings?.pension_notification_days ?? 30,
        };
        companySettingsMap.set(companyId, settings);
      }

      const dob = new Date(emp.date_of_birth);
      const pensionDate = new Date(dob);
      pensionDate.setFullYear(dob.getFullYear() + settings.pension_age);
      pensionDate.setHours(0, 0, 0, 0);

      const remainingDays = Math.ceil((pensionDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

      console.log(`[PensionNotificationService] ${emp.full_name}: Retirement in ${remainingDays} days (Age ${settings.pension_age}, Target: ${pensionDate.toDateString()})`);

      let milestoneReached = false;
      let milestoneLabel = "";

      // Trigger milestones: User-defined day, and some standard ones
      const milestones = [settings.pension_notification_days, 14, 7, 3, 1, 0];
      console.log(`[PensionNotificationService] Checking milestones: ${milestones.join(", ")} against remainingDays: ${remainingDays}`);

      if (milestones.includes(remainingDays)) {
        milestoneReached = true;
        if (remainingDays === 0) milestoneLabel = "reaches retirement age today";
        else if (remainingDays === 1) milestoneLabel = "is reaching retirement age tomorrow";
        else milestoneLabel = `is reaching retirement age in ${remainingDays} days`;
        console.log(`[PensionNotificationService] Milestone REACHED for ${emp.full_name}: ${milestoneLabel}`);
      }

      if (milestoneReached) {
        await notifyHRAndAdmins(emp, milestoneLabel, pensionDate, settings);
      } else {
        console.log(`[PensionNotificationService] No milestone reached for ${emp.full_name}.`);
      }
    }
  } catch (error) {
    console.error("[PensionNotificationService] Error in checkAndNotifyPensionMilestones:", error);
  }
};

const notifyHRAndAdmins = async (employee: any, milestoneLabel: string, pensionDate: Date, settings: any) => {
  const companyId = employee.company_id;
  const employeeName = employee.full_name;

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

  const recipientMap = new Map<string, { employee_id: string; email: string | null }>();
  roles.forEach((role) => {
    role.appUsers.forEach((user) => {
      if (user.employee_id) {
        recipientMap.set(user.employee_id, { employee_id: user.employee_id, email: user.email });
      }
    });
  });

  const title = `Retirement Reminder (${settings.pension_age} Years): ${employeeName}`;
  const message = `Employee ${employeeName} ${milestoneLabel} (Target: ${pensionDate.toLocaleDateString()}). Configured retirement age: ${settings.pension_age}.`;

  const branding = await getCompanyBranding(companyId);

  for (const recipient of recipientMap.values()) {
    // In-app notification
    await createNotification({
      company_id: companyId,
      recipient_id: recipient.employee_id,
      type: NotificationType.PENSION_REMINDER, // General info for retirement
      title,
      message,
      action_url: `/admin/employees/${employee.id}`,
      related_entity_type: "employee",
      related_entity_id: employee.id,
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
            <p>Please begin the necessary offboarding or transition procedures for this employee.</p>
            <a href="${process.env.FRONTEND_URL}/admin/employees/${employee.id}" 
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
