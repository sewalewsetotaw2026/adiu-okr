import { prisma } from "../app";
import { createNotification, NotificationType } from "./notificationService";
import { sendEmail } from "../utils/email";
import {
  getLeaveApplicationEmailHtml,
  getLeaveRecallRequestEmailHtml,
  getLeaveRecallResponseEmailHtml,
  getLeaveExpiringEmailHtml,
  getLeaveRequestManagerEmailHtml,
  getLeaveCancellationRequestEmailHtml,
  getLeaveCancellationStatusEmailHtml,
} from "../utils/emailTemplates";

/**
 * Leave Notification Service
 * Handles all leave-related notifications (in-app + email)
 */

/**
 * Helper to fetch company branding
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

/**
 * Notify manager when employee submits leave
 */
export const notifyLeaveSubmitted = async (
  leaveApplication: any,
): Promise<void> => {
  try {
    // Get employee's manager from active employment
    const employment = await prisma.employment.findFirst({
      where: {
        employee_id: leaveApplication.employee_id,
        company_id: leaveApplication.company_id,
        is_active: true,
      },
      select: {
        manager_id: true,
        manager: {
          select: {
            id: true,
            full_name: true,
            appUsers: {
              select: {
                email: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    // if (!employment?.manager_id) {
    //   console.log(
    //     "[LeaveNotificationService] No manager found for employee, skipping notification"
    //   );
    //   return;
    // }

    const manager = employment?.manager;
    // Removed strict return if no manager, to allow Admin/HR notification
    // if (!manager) return;

    // Get employee details (Full Profile for Manager Email)
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: leaveApplication.employee_id,
          company_id: leaveApplication.company_id,
        },
      },
      select: {
        full_name: true,
        appUsers: {
          select: { email: true },
          take: 1,
        },
        phones: {
          where: { is_primary: true },
          select: { phone_number: true },
          take: 1,
        },
        employments: {
          where: { is_active: true },
          select: {
            jobTitle: { select: { title: true } },
            department: { select: { name: true } },
          },
          take: 1,
        },
      },
    });

    // Get leave type
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveApplication.leave_type_id },
      select: { name: true },
    });

    const title = `New Leave Request from ${employee?.full_name}`;
    const message = `${employee?.full_name} has submitted a ${leaveType?.name} request for ${leaveApplication.requested_days} days (${formatDate(leaveApplication.start_date)} - ${formatDate(leaveApplication.end_date)}). Please review and approve.`;

    // Create in-app notification for Manager if exists
    if (manager) {
      await createNotification({
        company_id: leaveApplication.company_id,
        recipient_id: manager.id,
        type: NotificationType.LEAVE_SUBMITTED,
        title,
        message,
        action_url: `/manager/team-leaves?tab=pending&applicationId=${leaveApplication.id}`,
        related_entity_type: "leave_application",
        related_entity_id: leaveApplication.id,
        email_sent: true,
      });
    }

    // 1. Send Email to Manager (Action Required with Employee Details)
    if (manager && manager.appUsers?.[0]?.email && employee) {
      const branding = await getCompanyBranding(leaveApplication.company_id);
      const employment = employee.employments?.[0];
      const managerEmailHtml = getLeaveRequestManagerEmailHtml(
        manager.full_name,
        {
          name: employee.full_name,
          jobTitle: employment?.jobTitle?.title || "-",
          department: employment?.department?.name || "-",
          phone: employee.phones?.[0]?.phone_number || "-",
          email: employee.appUsers?.[0]?.email || "-",
        },
        {
          type: leaveType?.name || "Leave",
          startDate: leaveApplication.start_date,
          endDate: leaveApplication.end_date,
          totalDays: leaveApplication.requested_days,
          reason: leaveApplication.reason,
        },
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor,
      );

      await sendEmail({
        to: manager.appUsers[0].email,
        subject: `Action Required: New Leave Request from ${employee.full_name} - ${branding.companyName}`,
        html: managerEmailHtml,
      });
    }

    // 2. Send Email to Employee (Confirmation)
    if (employee?.appUsers?.[0]?.email) {
      const branding = await getCompanyBranding(leaveApplication.company_id);
      const employeeEmailHtml = getLeaveApplicationEmailHtml(
        employee.full_name,
        leaveType?.name || "Leave",
        formatDate(leaveApplication.start_date),
        formatDate(leaveApplication.end_date),
        leaveApplication.requested_days,
        "submitted",
        leaveApplication.reason,
        manager ? manager.full_name : "HR/Admin",
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor,
      );

      await sendEmail({
        to: employee.appUsers[0].email,
        subject: `Leave Application Submitted - ${branding.companyName}`,
        html: employeeEmailHtml,
      });
    }

    if (manager) {
      console.log(
        `[LeaveNotificationService] Leave submission notification sent to manager ${manager.id}`,
      );
      // No need to notify HR or Admin at this stage if there is a manager
    } else {
      // If no manager is assigned, notify HR and Admin directly
      await notifyAdminLeaveSubmitted(
        leaveApplication,
        employee?.full_name,
        leaveType?.name,
      );
      await notifyHRLeaveSubmitted(leaveApplication);
    }
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyLeaveSubmitted:",
      error,
    );
  }
};

/**
 * Notify all HR users when employee submits leave (if no manager/escalated)
 */
export const notifyHRLeaveSubmitted = async (
  leaveApplication: any,
): Promise<void> => {
  try {
    // Get all HR users
    const hrRole = await prisma.appRole.findFirst({
      where: {
        company_id: leaveApplication.company_id,
        name: "HR",
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

    if (!hrRole || !hrRole.appUsers || hrRole.appUsers.length === 0) {
      console.log(
        "[LeaveNotificationService] No HR users found for leave submission notification",
      );
      return;
    }

    // Get employee details
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: leaveApplication.employee_id,
          company_id: leaveApplication.company_id,
        },
      },
      select: { full_name: true },
    });

    // Get leave type
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveApplication.leave_type_id },
      select: { name: true },
    });

    const title = `New Leave Request: ${employee?.full_name}`;
    const message = `${employee?.full_name} has submitted a ${leaveType?.name} request for ${leaveApplication.requested_days} days (${formatDate(leaveApplication.start_date)} - ${formatDate(leaveApplication.end_date)}). Pending your review.`;

    // Send notification to each HR user
    for (const hrUser of hrRole.appUsers) {
      if (!hrUser.employee_id) continue;

      await createNotification({
        company_id: leaveApplication.company_id,
        recipient_id: hrUser.employee_id,
        type: NotificationType.LEAVE_SUBMITTED,
        title,
        message,
        action_url: `/admin/leaves?tab=pending&applicationId=${leaveApplication.id}`,
        related_entity_type: "leave_application",
        related_entity_id: leaveApplication.id,
        email_sent: true,
      });

      // Send email
      if (hrUser.email) {
        const branding = await getCompanyBranding(leaveApplication.company_id);
        const emailHtml = getLeaveApplicationEmailHtml(
          employee?.full_name || "An employee",
          leaveType?.name || "Leave",
          formatDate(leaveApplication.start_date),
          formatDate(leaveApplication.end_date),
          leaveApplication.requested_days,
          "submitted",
          leaveApplication.reason,
          undefined,
          branding.companyName,
          branding.logoUrl,
          branding.primaryColor,
          branding.secondaryColor,
        );

        await sendEmail({
          to: hrUser.email,
          subject: `${title} - ${branding.companyName}`,
          html: emailHtml,
        });
      }
    }

    console.log(
      `[LeaveNotificationService] Leave submission notification sent to ${hrRole.appUsers.length} HR users`,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyHRLeaveSubmitted:",
      error,
    );
  }
};

/**
 * Notify all admin users when employee submits leave
 */
export const notifyAdminLeaveSubmitted = async (
  leaveApplication: any,
  employeeName?: string,
  leaveTypeName?: string,
): Promise<void> => {
  try {
    // Get all admin users
    const adminRole = await prisma.appRole.findFirst({
      where: {
        company_id: leaveApplication.company_id,
        name: { in: ["Admin", "ADMIN", "Super Admin"] },
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

    if (!adminRole || !adminRole.appUsers || adminRole.appUsers.length === 0) {
      console.log(
        "[LeaveNotificationService] No admin users found for leave submission notification",
      );
      return;
    }

    const title = `New Leave Request: ${employeeName}`;
    const message = `${employeeName} has submitted a ${leaveTypeName} request for ${leaveApplication.requested_days} days (${formatDate(leaveApplication.start_date)} - ${formatDate(leaveApplication.end_date)}).`;

    // Send notification to each admin user
    for (const adminUser of adminRole.appUsers) {
      if (!adminUser.employee_id) continue;

      await createNotification({
        company_id: leaveApplication.company_id,
        recipient_id: adminUser.employee_id,
        type: NotificationType.LEAVE_SUBMITTED,
        title,
        message,
        action_url: `/admin/leaves?tab=pending&applicationId=${leaveApplication.id}`,
        related_entity_type: "leave_application",
        related_entity_id: leaveApplication.id,
        email_sent: false, // Admin in-app only for submissions, email goes to manager
      });
    }

    console.log(
      `[LeaveNotificationService] Leave submission notification sent to ${adminRole.appUsers.length} admin users`,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyAdminLeaveSubmitted:",
      error,
    );
  }
};

/**
 *  Notify HR after manager approves (PENDING_HR status)
 */
export const notifyLeaveApprovedByManager = async (
  leaveApplication: any,
): Promise<void> => {
  try {
    // Get all HR users
    const hrRole = await prisma.appRole.findFirst({
      where: {
        company_id: leaveApplication.company_id,
        name: "HR",
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

    if (!hrRole || !hrRole.appUsers || hrRole.appUsers.length === 0) {
      console.log("[LeaveNotificationService] No HR users found");
      return;
    }

    // Get employee and leave type details
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: leaveApplication.employee_id,
          company_id: leaveApplication.company_id,
        },
      },
      select: { full_name: true },
    });

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveApplication.leave_type_id },
      select: { name: true },
    });

    const title = `Leave Request Pending HR Approval`;
    const message = `${employee?.full_name}'s ${leaveType?.name} request (${leaveApplication.requested_days} days) has been approved by their manager and is now pending HR approval.`;

    // Send notification to each HR user
    for (const hrUser of hrRole.appUsers) {
      if (!hrUser.employee_id) continue;

      await createNotification({
        company_id: leaveApplication.company_id,
        recipient_id: hrUser.employee_id,
        type: NotificationType.LEAVE_SUBMITTED,
        title,
        message,
        action_url: `/admin/leaves?tab=pending&applicationId=${leaveApplication.id}`,
        related_entity_type: "leave_application",
        related_entity_id: leaveApplication.id,
        email_sent: true,
      });

      // Send email
      if (hrUser.email) {
        const branding = await getCompanyBranding(leaveApplication.company_id);
        const emailHtml = getLeaveApplicationEmailHtml(
          employee?.full_name || "An employee",
          leaveType?.name || "Leave",
          formatDate(leaveApplication.start_date),
          formatDate(leaveApplication.end_date),
          leaveApplication.requested_days,
          "submitted",
          leaveApplication.reason,
          undefined,
          branding.companyName,
          branding.logoUrl,
          branding.primaryColor,
          branding.secondaryColor,
        );

        await sendEmail({
          to: hrUser.email,
          subject: `${title} - ${branding.companyName}`,
          html: emailHtml,
        });
      }
    }

    console.log(
      `[LeaveNotificationService] Leave pending HR notification sent to ${hrRole.appUsers.length} HR users`,
    );

    // Also notify admin users about the escalation
    await notifyAdminLeaveEscalated(
      leaveApplication,
      employee?.full_name,
      leaveType?.name,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyLeaveApprovedByManager:",
      error,
    );
  }
};

/**
 * Notify admin users when leave is escalated to HR after manager approval
 */
export const notifyAdminLeaveEscalated = async (
  leaveApplication: any,
  employeeName?: string,
  leaveTypeName?: string,
): Promise<void> => {
  try {
    // Get all admin users
    const adminRole = await prisma.appRole.findFirst({
      where: {
        company_id: leaveApplication.company_id,
        name: { in: ["Admin", "ADMIN", "Super Admin"] },
      },
      select: {
        appUsers: {
          select: {
            employee_id: true,
          },
        },
      },
    });

    if (!adminRole || !adminRole.appUsers || adminRole.appUsers.length === 0) {
      return;
    }

    const title = `Leave Approved by Manager: ${employeeName}`;
    const message = `${employeeName}'s ${leaveTypeName} request (${leaveApplication.requested_days} days) has been approved by their manager and is now pending HR approval.`;

    for (const adminUser of adminRole.appUsers) {
      if (!adminUser.employee_id) continue;

      await createNotification({
        company_id: leaveApplication.company_id,
        recipient_id: adminUser.employee_id,
        type: NotificationType.LEAVE_APPROVED,
        title,
        message,
        action_url: `/admin/leaves?tab=pending&applicationId=${leaveApplication.id}`,
        related_entity_type: "leave_application",
        related_entity_id: leaveApplication.id,
        email_sent: false,
      });
    }

    console.log(
      `[LeaveNotificationService] Leave escalation notification sent to ${adminRole.appUsers.length} admin users`,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyAdminLeaveEscalated:",
      error,
    );
  }
};

/**
 * Notify employee when leave is approved
 */
export const notifyLeaveApproved = async (
  leaveApplication: any,
  approverName: string,
): Promise<void> => {
  try {
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: leaveApplication.employee_id,
          company_id: leaveApplication.company_id,
        },
      },
      select: {
        full_name: true,
        appUsers: {
          select: { email: true },
          take: 1,
        },
      },
    });

    if (!employee) return;

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveApplication.leave_type_id },
      select: { name: true },
    });

    const title = `Leave Request Approved`;
    const message = `Your ${leaveType?.name} request for ${leaveApplication.requested_days} days (${formatDate(leaveApplication.start_date)} - ${formatDate(leaveApplication.end_date)}) has been approved.`;

    // Create in-app notification
    await createNotification({
      company_id: leaveApplication.company_id,
      recipient_id: leaveApplication.employee_id,
      type: NotificationType.LEAVE_APPROVED,
      title,
      message,
      action_url: `/employee/leave/history`,
      related_entity_type: "leave_application",
      related_entity_id: leaveApplication.id,
      email_sent: true,
    });

    // Send email
    if (employee.appUsers?.[0]?.email) {
      const branding = await getCompanyBranding(leaveApplication.company_id);
      const emailHtml = getLeaveApplicationEmailHtml(
        employee.full_name,
        leaveType?.name || "Leave",
        formatDate(leaveApplication.start_date),
        formatDate(leaveApplication.end_date),
        leaveApplication.requested_days,
        "approved",
        undefined,
        approverName,
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor,
      );

      await sendEmail({
        to: employee.appUsers[0].email,
        subject: `${title} - ${branding.companyName}`,
        html: emailHtml,
      });
    }

    console.log(
      `[LeaveNotificationService] Leave approval notification sent to employee ${leaveApplication.employee_id}`,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyLeaveApproved:",
      error,
    );
  }
};

/**
 * Notify employee when leave is rejected
 */
export const notifyLeaveRejected = async (
  leaveApplication: any,
  rejectionReason: string,
  rejectedBy: string,
): Promise<void> => {
  try {
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: leaveApplication.employee_id,
          company_id: leaveApplication.company_id,
        },
      },
      select: {
        full_name: true,
        appUsers: {
          select: { email: true },
          take: 1,
        },
      },
    });

    if (!employee) return;

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveApplication.leave_type_id },
      select: { name: true },
    });

    const title = `Leave Request Rejected`;
    const message = `Your ${leaveType?.name} request for ${leaveApplication.requested_days} days has been rejected. Reason: ${rejectionReason}`;

    // Create in-app notification
    await createNotification({
      company_id: leaveApplication.company_id,
      recipient_id: leaveApplication.employee_id,
      type: NotificationType.LEAVE_REJECTED,
      title,
      message,
      action_url: `/employee/leave/history`,
      related_entity_type: "leave_application",
      related_entity_id: leaveApplication.id,
      email_sent: true,
    });

    // Send email
    if (employee.appUsers?.[0]?.email) {
      const branding = await getCompanyBranding(leaveApplication.company_id);
      const emailHtml = getLeaveApplicationEmailHtml(
        employee.full_name,
        leaveType?.name || "Leave",
        formatDate(leaveApplication.start_date),
        formatDate(leaveApplication.end_date),
        leaveApplication.requested_days,
        "rejected",
        rejectionReason,
        rejectedBy,
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor,
      );

      await sendEmail({
        to: employee.appUsers[0].email,
        subject: `${title} - ${branding.companyName}`,
        html: emailHtml,
      });
    }

    console.log(
      `[LeaveNotificationService] Leave rejection notification sent to employee ${leaveApplication.employee_id}`,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyLeaveRejected:",
      error,
    );
  }
};

/**
 * Notify employee of recall request
 */
export const notifyRecallRequest = async (recall: any): Promise<void> => {
  try {
    // Get leave application details
    const leaveApplication = await prisma.leaveApplication.findUnique({
      where: { id: recall.leave_application_id },
      include: {
        employee: {
          select: {
            full_name: true,
            appUsers: {
              select: { email: true },
              take: 1,
            },
          },
        },
        leaveType: {
          select: { name: true },
        },
      },
    });

    if (!leaveApplication) return;

    // Get manager/recaller details
    const recalledBy = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: recall.recalled_by,
          company_id: recall.recalled_by_company_id,
        },
      },
      select: { full_name: true },
    });

    const title = `Leave Recall Request`;
    const message = `${recalledBy?.full_name || "Your manager"} has requested you to return early from your ${leaveApplication.leaveType?.name} on ${formatDate(recall.recall_date)}. Reason: ${recall.reason}`;

    // Create in-app notification
    await createNotification({
      company_id: leaveApplication.company_id,
      recipient_id: leaveApplication.employee_id,
      type: NotificationType.RECALL_REQUEST,
      title,
      message,
      action_url: `/employee/leave/history`,
      related_entity_type: "leave_recall",
      related_entity_id: recall.id,
      email_sent: true,
    });

    // Send email
    if (leaveApplication.employee?.appUsers?.[0]?.email) {
      const branding = await getCompanyBranding(leaveApplication.company_id);
      const emailHtml = getLeaveRecallRequestEmailHtml(
        leaveApplication.employee.full_name,
        recalledBy?.full_name || "Your manager",
        formatDate(recall.recall_date),
        recall.reason,
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor,
      );

      await sendEmail({
        to: leaveApplication.employee.appUsers[0].email,
        subject: `${title} - ${branding.companyName}`,
        html: emailHtml,
      });
    }

    console.log(
      `[LeaveNotificationService] Recall request notification sent to employee ${leaveApplication.employee_id}`,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyRecallRequest:",
      error,
    );
  }
};

/**
 * Notify manager/HR of recall response
 */
export const notifyRecallResponse = async (
  recall: any,
  response: "ACCEPTED" | "DECLINED",
): Promise<void> => {
  try {
    // Get leave application and employee details
    const leaveApplication = await prisma.leaveApplication.findUnique({
      where: { id: recall.leave_application_id },
      include: {
        employee: {
          select: { full_name: true },
        },
      },
    });

    if (!leaveApplication) return;

    // Get recaller (manager/HR) details
    const recaller = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: recall.recalled_by,
          company_id: recall.recalled_by_company_id,
        },
      },
      select: {
        full_name: true,
        appUsers: {
          select: { email: true },
          take: 1,
        },
      },
    });

    if (!recaller) return;

    const title = `Recall ${response === "ACCEPTED" ? "Accepted" : "Declined"}`;
    const message = `${leaveApplication.employee?.full_name} has ${response === "ACCEPTED" ? "accepted" : "declined"} the recall request${recall.actual_return_date ? ` and will return on ${formatDate(recall.actual_return_date)}` : ""}.`;

    // Create in-app notification
    await createNotification({
      company_id: recall.recalled_by_company_id,
      recipient_id: recall.recalled_by,
      type:
        response === "ACCEPTED"
          ? NotificationType.RECALL_ACCEPTED
          : NotificationType.RECALL_DECLINED,
      title,
      message,
      action_url: `/admin/leave-management`,
      related_entity_type: "leave_recall",
      related_entity_id: recall.id,
      email_sent: true,
    });

    // Send email
    if (recaller.appUsers?.[0]?.email) {
      const branding = await getCompanyBranding(recall.recalled_by_company_id);
      const emailHtml = getLeaveRecallResponseEmailHtml(
        recaller.full_name,
        leaveApplication.employee?.full_name || "The employee",
        response,
        recall.actual_return_date
          ? formatDate(recall.actual_return_date)
          : undefined,
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor,
      );

      await sendEmail({
        to: recaller.appUsers[0].email,
        subject: `${title} - ${branding.companyName}`,
        html: emailHtml,
      });
    }

    console.log(
      `[LeaveNotificationService] Recall response notification sent to ${recall.recalled_by}`,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyRecallResponse:",
      error,
    );
  }
};

/**
 * Check and notify employees about expiring leave balances.
 * This should be scheduled to run daily.
 */
export const checkAndNotifyExpiringLeaves = async (): Promise<void> => {
  try {
    console.log(
      "[LeaveNotificationService] Checking for expiring leave balances...",
    );

    // Get all companies with expiry notifications enabled
    const companies = await prisma.company.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
    });

    for (const company of companies) {
      const settings = await prisma.leaveSettings.findUnique({
        where: { company_id: company.id },
      });

      if (
        !settings?.enable_leave_expiry ||
        !settings?.balance_notification_enabled
      ) {
        continue;
      }

      const notificationDays = settings.expiry_notification_days || 30;

      // Calculate the target notification date (Today + N days)
      // We look for expiry dates matching exactly this date to avoid spamming every day
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + notificationDays);

      // Find balances expiring exactly on the target date
      // Note: expiry_date in DB is just Date (no time), need to handle potential time component issues depending on how prisma treats it
      const expiringBalances = await prisma.leaveBalance.findMany({
        where: {
          company_id: company.id,
          expiry_date: targetDate,
          remaining_days: { gt: 0 }, // Only notify if they have balance to lose
        },
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              appUsers: { select: { email: true }, take: 1 },
            },
          },
          leaveType: { select: { name: true } },
        },
      });

      if (expiringBalances.length === 0) continue;

      console.log(
        `[LeaveNotificationService] Found ${expiringBalances.length} expiring balances for company ${company.name}`,
      );

      for (const balance of expiringBalances) {
        const { employee, leaveType, expiry_date, remaining_days } = balance;

        if (!expiry_date) continue;

        const daysLeft = Math.ceil(
          (expiry_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        const title = `Leave Expiration Warning: ${leaveType.name}`;
        const message = `You have ${remaining_days} days of ${leaveType.name} expiring on ${formatDate(expiry_date)}. Please use them before they expire.`;

        // Send In-App Notification (and try email)
        // But first check if we already sent one for this balance/expiry date recently (Idempotency)
        // We check for any notification for this balance created in the last 20 hours (to allow for daily retries if missed, but prevent double send on same run)
        const existingNotification = await prisma.notification.findFirst({
          where: {
            related_entity_id: balance.id,
            related_entity_type: "leave_balance",
            type: NotificationType.LEAVE_EXPIRING,
            created_at: {
              gte: new Date(Date.now() - 20 * 60 * 60 * 1000),
            },
          },
        });

        if (existingNotification) {
          console.log(
            `[LeaveNotificationService] Notification already sent for balance ${balance.id} today. Skipping.`,
          );
          continue;
        }

        await createNotification({
          company_id: company.id,
          recipient_id: employee.id,
          type: NotificationType.LEAVE_EXPIRING,
          title,
          message,
          action_url: `/employee/leave/history`,
          related_entity_type: "leave_balance",
          related_entity_id: balance.id,
          email_sent: false, // Initially false
        }).then(async (notification) => {
          // Send Email
          if (employee.appUsers?.[0]?.email) {
            const branding = await getCompanyBranding(company.id);
            const emailHtml = getLeaveExpiringEmailHtml(
              employee.full_name,
              leaveType.name,
              Number(remaining_days || 0),
              formatDate(expiry_date),
              branding.companyName,
              branding.logoUrl,
              branding.primaryColor,
              branding.secondaryColor,
            );

            try {
              await sendEmail({
                to: employee.appUsers[0].email,
                subject: `Action Required: Your ${leaveType.name} is expiring soon - ${branding.companyName}`,
                html: emailHtml,
              });

              // Update status
              await prisma.notification.update({
                where: { id: notification.id },
                data: { email_sent: true },
              });
            } catch (err) {
              console.error(
                `[LeaveNotificationService] Failed to send expiry email for balance ${balance.id}`,
                err,
              );
            }
          }
        });
      }
    }
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in checkAndNotifyExpiringLeaves:",
      error,
    );
  }
};

/**
 * Notify employee of expiring leave balance
 */
export const notifyLeaveExpiring = async (balance: any): Promise<void> => {
  try {
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: balance.employee_id,
          company_id: balance.company_id,
        },
      },
      select: {
        full_name: true,
        appUsers: {
          select: { email: true },
          take: 1,
        },
      },
    });

    if (!employee) return;

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: balance.leave_type_id },
      select: { name: true },
    });

    const title = `Leave Balance Expiring Soon`;
    const message = `Your ${leaveType?.name} balance of ${balance.remaining_days} days will expire on ${formatDate(balance.expiry_date)}. Please use them before they expire.`;

    // Create in-app notification (email_sent = false initially)
    const notification = await createNotification({
      company_id: balance.company_id,
      recipient_id: balance.employee_id,
      type: NotificationType.LEAVE_EXPIRING,
      title,
      message,
      action_url: `/employee/leave/apply`,
      related_entity_type: "leave_balance",
      related_entity_id: balance.id,
      email_sent: false,
    });

    // Send email
    if (employee.appUsers?.[0]?.email) {
      const branding = await getCompanyBranding(balance.company_id);
      const emailHtml = getLeaveExpiringEmailHtml(
        employee.full_name,
        leaveType?.name || "Leave",
        balance.remaining_days,
        formatDate(balance.expiry_date),
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor,
      );

      await sendEmail({
        to: employee.appUsers[0].email,
        subject: `${title} - ${branding.companyName}`,
        html: emailHtml,
      });

      // Update notification to indicate email sent successfully
      await prisma.notification.update({
        where: { id: notification.id },
        data: { email_sent: true },
      });
    }

    console.log(
      `[LeaveNotificationService] Expiring leave notification sent to employee ${balance.employee_id}`,
    );
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in notifyLeaveExpiring:",
      error,
    );
  }
};

/**
 * Retry failed email notifications
 * Should be scheduled to run periodically (e.g. hourly)
 */
export const retryFailedEmails = async (): Promise<void> => {
  try {
    console.log(
      "[LeaveNotificationService] Checking for failed email notifications...",
    );

    // Find notifications where email_sent is false, type is LEAVE_EXPIRING, created within last 48 hours
    const failedNotifications = await prisma.notification.findMany({
      where: {
        type: NotificationType.LEAVE_EXPIRING,
        email_sent: false,
        created_at: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000), // Last 48 hours
        },
      },
      take: 50, // process in batches
    });

    if (failedNotifications.length === 0) return;

    console.log(
      `[LeaveNotificationService] Found ${failedNotifications.length} failed notifications to retry`,
    );

    for (const notification of failedNotifications) {
      if (!notification.related_entity_id) continue;

      // Fetch balance details to reconstruct email
      const balance = await prisma.leaveBalance.findUnique({
        where: { id: notification.related_entity_id },
      });

      if (!balance) continue;

      // Re-trigger notification logic (which handles email sending)
      // But we need to use the existing notification ID or updating logic
      // Easier approach: Just re-call notifyLeaveExpiring?
      // No, notifyLeaveExpiring creates a NEW notification. We want to update the existing one or retry sending.
      // Let's implement specific retry logic here.

      const employee = await prisma.employee.findUnique({
        where: {
          id_company_id: {
            id: notification.recipient_id,
            company_id: notification.company_id,
          },
        },
        select: {
          full_name: true,
          appUsers: { select: { email: true }, take: 1 },
        },
      });

      const leaveType = await prisma.leaveType.findUnique({
        where: { id: balance.leave_type_id },
        select: { name: true },
      });

      if (employee && employee.appUsers?.[0]?.email && leaveType) {
        const branding = await getCompanyBranding(notification.company_id);
        const emailHtml = getLeaveExpiringEmailHtml(
          employee.full_name,
          leaveType.name,
          Number(balance.remaining_days || 0),
          formatDate(balance.expiry_date || new Date()),
          branding.companyName,
          branding.logoUrl,
          branding.primaryColor,
          branding.secondaryColor,
        );

        try {
          await sendEmail({
            to: employee.appUsers[0].email,
            subject: `${notification.title} - ${branding.companyName}`,
            html: emailHtml,
          });

          // Update status on success
          await prisma.notification.update({
            where: { id: notification.id },
            data: { email_sent: true },
          });

          console.log(
            `[LeaveNotificationService] Successfully retried email for notification ${notification.id}`,
          );
        } catch (sendError) {
          console.error(
            `[LeaveNotificationService] Failed to retry email for notification ${notification.id}`,
            sendError,
          );
        }
      }
    }
  } catch (error) {
    console.error(
      "[LeaveNotificationService] Error in retryFailedEmails:",
      error,
    );
  }
};

/**
 * Helper function to format dates
 */
const formatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * Notify manager when employee requests leave cancellation
 */
export const notifyLeaveCancellationRequested = async (
  leaveApplication: any,
): Promise<void> => {
  try {
    const branding = await getCompanyBranding(leaveApplication.company_id);
    
    // Get employee and manager details
    const employee = await prisma.employee.findUnique({
      where: { id: leaveApplication.employee_id },
      include: {
        employments: { where: { is_active: true }, take: 1, include: { manager: { include: { appUsers: { select: { email: true }, take: 1 } } } } },
        appUsers: { select: { email: true }, take: 1 }
      }
    });

    const manager = employee?.employments[0]?.manager;
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveApplication.leave_type_id } });

    const title = `Early Return Request: ${employee?.full_name}`;
    const message = `${employee?.full_name} has requested an early return from their ${leaveType?.name} leave on ${formatDate(leaveApplication.requested_return_date)}.`;

    // 1. In-app notification for Manager
    if (manager) {
      await createNotification({
        company_id: leaveApplication.company_id,
        recipient_id: manager.id,
        type: NotificationType.LEAVE_SUBMITTED, // Reuse submitted type or add new one
        title,
        message,
        action_url: `/manager/team-leaves?tab=pending&applicationId=${leaveApplication.id}`,
        related_entity_type: "leave_application",
        related_entity_id: leaveApplication.id,
        email_sent: true,
      });

      // 2. Email to Manager
      if (manager.appUsers?.[0]?.email) {
        const emailHtml = getLeaveCancellationRequestEmailHtml(
          manager.full_name,
          employee?.full_name || "Employee",
          leaveType?.name || "Leave",
          leaveApplication.end_date,
          leaveApplication.requested_return_date,
          leaveApplication.cancellation_reason || "No reason provided",
          branding.companyName,
          branding.logoUrl,
          branding.primaryColor,
          branding.secondaryColor
        );

        await sendEmail({
          to: manager.appUsers[0].email,
          subject: `Action Required: Early Return Request - ${branding.companyName}`,
          html: emailHtml
        });
      }
    } else {
      // Notify HR if no manager
      await notifyHRLeaveCancellationRequested(leaveApplication);
    }
  } catch (error) {
    console.error("[LeaveNotificationService] Error in notifyLeaveCancellationRequested:", error);
  }
};

/**
 * Notify HR when employee requests leave cancellation (if no manager)
 */
export const notifyHRLeaveCancellationRequested = async (
  leaveApplication: any,
): Promise<void> => {
  try {
    const hrRole = await prisma.appRole.findFirst({
      where: { company_id: leaveApplication.company_id, name: "HR" },
      select: { appUsers: { select: { employee_id: true, email: true } } }
    });

    if (!hrRole?.appUsers?.length) return;

    const employee = await prisma.employee.findUnique({ where: { id: leaveApplication.employee_id }, select: { full_name: true } });
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveApplication.leave_type_id } });

    const title = `Early Return Request: ${employee?.full_name}`;
    const message = `${employee?.full_name} has requested an early return from their ${leaveType?.name} leave. Pending HR approval.`;

    for (const hrUser of hrRole.appUsers) {
      if (!hrUser.employee_id) continue;

      await createNotification({
        company_id: leaveApplication.company_id,
        recipient_id: hrUser.employee_id,
        type: NotificationType.LEAVE_SUBMITTED,
        title,
        message,
        action_url: `/admin/leaves?tab=pending&applicationId=${leaveApplication.id}`,
        related_entity_type: "leave_application",
        related_entity_id: leaveApplication.id,
        email_sent: true,
      });

      if (hrUser.email) {
        const branding = await getCompanyBranding(leaveApplication.company_id);
        const emailHtml = getLeaveCancellationRequestEmailHtml(
          "HR Team",
          employee?.full_name || "Employee",
          leaveType?.name || "Leave",
          leaveApplication.end_date,
          leaveApplication.requested_return_date,
          leaveApplication.cancellation_reason || "No reason provided",
          branding.companyName,
          branding.logoUrl,
          branding.primaryColor,
          branding.secondaryColor
        );

        await sendEmail({
          to: hrUser.email,
          subject: `Action Required: Early Return Request - ${branding.companyName}`,
          html: emailHtml
        });
      }
    }
  } catch (error) {
    console.error("[LeaveNotificationService] Error in notifyHRLeaveCancellationRequested:", error);
  }
};

/**
 * Notify employee when leave cancellation is approved/signed
 */
export const notifyLeaveCancellationApproved = async (
  leaveApplication: any,
  approverName: string,
  isFinal: boolean
): Promise<void> => {
  try {
    const branding = await getCompanyBranding(leaveApplication.company_id);
    const employee = await prisma.employee.findUnique({
      where: { id: leaveApplication.employee_id },
      include: { appUsers: { select: { email: true }, take: 1 } }
    });

    if (!employee) return;

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveApplication.leave_type_id } });
    const status: "approved" | "signed" = isFinal ? "approved" : "signed";

    const title = isFinal ? "Early Return Fully Approved" : "Early Return Approved by Manager";
    const message = isFinal 
      ? `Your early return from ${leaveType?.name} leave has been fully approved. Your new return date is ${formatDate(leaveApplication.requested_return_date)}.`
      : `Your early return request for ${leaveType?.name} leave has been approved by your manager and moved to HR for final sign-off.`;

    await createNotification({
      company_id: leaveApplication.company_id,
      recipient_id: employee.id,
      type: NotificationType.LEAVE_APPROVED,
      title,
      message,
      action_url: "/employee/leave/history",
      related_entity_type: "leave_application",
      related_entity_id: leaveApplication.id,
      email_sent: true,
    });

    if (employee.appUsers?.[0]?.email) {
      const emailHtml = getLeaveCancellationStatusEmailHtml(
        employee.full_name,
        leaveType?.name || "Leave",
        status,
        {
          returnDate: leaveApplication.requested_return_date,
          actionBy: approverName
        },
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor
      );

      await sendEmail({
        to: employee.appUsers[0].email,
        subject: `${title} - ${branding.companyName}`,
        html: emailHtml
      });
    }
  } catch (error) {
    console.error("[LeaveNotificationService] Error in notifyLeaveCancellationApproved:", error);
  }
};

/**
 * Notify employee when leave cancellation is rejected
 */
export const notifyLeaveCancellationRejected = async (
  leaveApplication: any,
  rejectedBy: string,
  reason: string
): Promise<void> => {
  try {
    const branding = await getCompanyBranding(leaveApplication.company_id);
    const employee = await prisma.employee.findUnique({
      where: { id: leaveApplication.employee_id },
      include: { appUsers: { select: { email: true }, take: 1 } }
    });

    if (!employee) return;

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveApplication.leave_type_id } });

    const title = "Early Return Request Rejected";
    const message = `Your request to return early from ${leaveType?.name} leave has been rejected. Reason: ${reason}`;

    await createNotification({
      company_id: leaveApplication.company_id,
      recipient_id: employee.id,
      type: NotificationType.LEAVE_REJECTED,
      title,
      message,
      action_url: "/employee/leave/history",
      related_entity_type: "leave_application",
      related_entity_id: leaveApplication.id,
      email_sent: true,
    });

    if (employee.appUsers?.[0]?.email) {
      const emailHtml = getLeaveCancellationStatusEmailHtml(
        employee.full_name,
        leaveType?.name || "Leave",
        "rejected",
        {
          reason,
          actionBy: rejectedBy
        },
        branding.companyName,
        branding.logoUrl,
        branding.primaryColor,
        branding.secondaryColor
      );

      await sendEmail({
        to: employee.appUsers[0].email,
        subject: `${title} - ${branding.companyName}`,
        html: emailHtml
      });
    }
  } catch (error) {
    console.error("[LeaveNotificationService] Error in notifyLeaveCancellationRejected:", error);
  }
};
