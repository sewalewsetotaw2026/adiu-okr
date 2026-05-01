import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { calculateWorkingDays, addDays, getFiscalYear } from "src/utils/leaveUtils";
import { redisService } from "src/services/redisService";
import {
  notifyRecallRequest,
  notifyRecallResponse,
} from "src/services/leaveNotificationService";

/**
 * Get all leave recalls (Admin/HR)
 */
export const getAllLeaveRecalls = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const status = req.query.status as string;

    const employeeId = req.user?.employee_id;
    const isAdminOrHR = ['Admin', 'HR'].includes(req.user?.role || '');

    const where: any = {
      leaveApplication: {
        company_id: companyId,
        ...(employeeId && !isAdminOrHR && {
          employee: {
            employments: {
              some: {
                manager_id: employeeId,
                is_active: true,
              },
            },
          },
        }),
      },
    };

    if (status) {
      where.status = status;
    }

    const [recalls, total] = await Promise.all([
      prisma.leaveRecall.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          leaveApplication: {
            include: {
              employee: {
                select: {
                  id: true,
                  full_name: true,
                  employments: {
                    where: { is_active: true },
                    select: {
                      department: { select: { name: true } },
                    },
                    take: 1,
                  },
                },
              },
              leaveType: true,
            },
          },
          recalledBy: {
            select: {
              id: true,
              full_name: true,
            },
          },
        },
      }),
      prisma.leaveRecall.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Leave recalls fetched successfully",
      data: {
        recalls,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my recall notifications (Employee)
 */
export const getMyRecallNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;

    if (!companyId || !employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const recalls = await prisma.leaveRecall.findMany({
      where: {
        leaveApplication: {
          employee_id: employeeId,
          company_id: companyId,
        },
        status: "PENDING",
      },
      include: {
        leaveApplication: {
          include: {
            leaveType: true,
          },
        },
        recalledBy: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({
      status: "success",
      message: "Recall notifications fetched successfully",
      data: { recalls },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get employees currently on leave (for recall)
 */
export const getEmployeesOnLeaveForRecall = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;
    const isAdminOrHR = ['Admin', 'HR'].includes(req.user?.role || '');

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get leaves that are currently active and can be recalled
    // (exclude leaves that already have a pending recall)
    const applications = await prisma.leaveApplication.findMany({
      where: {
        company_id: companyId,
        current_status: "APPROVED",
        start_date: { lte: today },
        end_date: { gte: today },
        requested_days: { gt: 0 }, // Exclude recalled/cancelled leaves
        // Exclude already recalled or recalled pending
        leaveRecalls: {
          none: {
            status: "PENDING",
          },
        },
        // For managers: only show direct reports
        ...(employeeId && !isAdminOrHR && {
          employee: {
            employments: {
              some: {
                manager_id: employeeId,
                is_active: true,
              },
            },
          },
        }),
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            phones: {
              where: { is_primary: true },
              select: { phone_number: true },
              take: 1,
            },
            employments: {
              where: { is_active: true },
              select: {
                department: { select: { name: true } },
                jobTitle: { select: { title: true } },
              },
              take: 1,
            },
          },
        },
        leaveType: true,
      },
    });

    res.status(200).json({
      status: "success",
      message: "Employees on leave fetched successfully",
      data: { applications },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a leave recall request (Manager/HR)
 */
export const createLeaveRecall = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.user?.company_id;
    const recalledById = req.user?.employee_id;

    if (!companyId || !recalledById) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    // Authorization Check: Admin/HR or the Employee's Active Manager
    const isAdminOrHR = ['Admin', 'HR'].includes(req.user?.role || '');

    const { leave_application_id, reason, recall_date } = req.body;

    // Get the leave application to check ownership/management
    const application = await prisma.leaveApplication.findFirst({
      where: {
        id: Number(leave_application_id),
        company_id: companyId,
        current_status: "APPROVED",
      },
      include: {
        employee: {
          include: {
            employments: {
              where: { is_active: true },
              select: { manager_id: true },
              take: 1,
            }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({
        status: "fail",
        message: "Leave application not found or not approved",
      });
    }

    const targetEmployeeManagerId = application.employee.employments?.[0]?.manager_id;
    const isManager = recalledById === targetEmployeeManagerId;

    if (!isAdminOrHR && !isManager) {
      return res.status(403).json({
        status: "fail",
        message: "You are not authorized to recall this employee's leave",
      });
    }

    // Validation
    if (!leave_application_id || !reason || !recall_date) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide leave_application_id, reason, and recall_date",
      });
    }


    // Check if employee is currently on leave
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(application.start_date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(application.end_date);
    endDate.setHours(0, 0, 0, 0);

    if (startDate > today || endDate < today) {
      return res.status(400).json({
        status: "fail",
        message: "Employee is not currently on leave",
      });
    }

    // Check if recall date is valid
    const recallDateObj = new Date(recall_date);
    if (recallDateObj < today) {
      return res.status(400).json({
        status: "fail",
        message: "Recall date cannot be in the past",
      });
    }

    if (recallDateObj > new Date(application.end_date)) {
      return res.status(400).json({
        status: "fail",
        message: "Recall date cannot be after the leave end date",
      });
    }

    // Check if there's already a pending recall
    const existingRecall = await prisma.leaveRecall.findFirst({
      where: {
        leave_application_id: Number(leave_application_id),
        status: "PENDING",
      },
    });

    if (existingRecall) {
      return res.status(400).json({
        status: "fail",
        message: "There is already a pending recall for this leave",
      });
    }

    const recall = await prisma.leaveRecall.create({
      data: {
        leave_application_id: Number(leave_application_id),
        recalled_by: recalledById,
        recalled_by_company_id: companyId,
        reason,
        recall_date: recallDateObj,
        status: "PENDING",
      },
      include: {
        leaveApplication: {
          include: {
            employee: {
              select: { id: true, full_name: true },
            },
            leaveType: true,
          },
        },
        recalledBy: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Send notification to employee
    try {
      await notifyRecallRequest(recall);
    } catch (notifError) {
      console.error("[LeaveRecall] Error sending recall notification:", notifError);
    }

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(201).json({
      status: "success",
      message: "Leave recall request created successfully",
      data: { recall },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Respond to a leave recall (Employee)
 */
export const respondToRecall = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;

    if (!companyId || !employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const { response, employee_response, actual_return_date } = req.body;

    if (!response || !["ACCEPTED", "DECLINED"].includes(response)) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide response as 'ACCEPTED' or 'DECLINED'",
      });
    }

    // Get the recall
    const recall = await prisma.leaveRecall.findFirst({
      where: {
        id: Number(id),
        status: "PENDING",
        leaveApplication: {
          employee_id: employeeId,
          company_id: companyId,
        },
      },
      include: {
        leaveApplication: true,
      },
    });

    if (!recall) {
      console.error("[LeaveRecall] Recall not found. Params:", {
        recallId: id,
        employeeId,
        companyId,
        status: "PENDING"
      });
      return res.status(404).json({
        status: "fail",
        message: "Recall request not found or already processed",
      });
    }

    let daysRestored = 0;

    // If accepted, calculate days to restore
    if (response === "ACCEPTED") {
      const returnDate = actual_return_date
        ? new Date(actual_return_date)
        : new Date(recall.recall_date);

      const originalEndDate = new Date(recall.leaveApplication.end_date);

      // Calculate days from return date to original end date
      if (returnDate < originalEndDate) {
        daysRestored = await calculateWorkingDays(
          returnDate,
          originalEndDate,
          companyId
        );

        // Restore days to leave balance for the CORRECT fiscal year
        const appFiscalYear = await getFiscalYear(recall.leaveApplication.company_id, recall.leaveApplication.start_date);

        await prisma.leaveBalance.updateMany({
          where: {
            employee_id: recall.leaveApplication.employee_id,
            leave_type_id: recall.leaveApplication.leave_type_id,
            fiscal_year: appFiscalYear,
          },
          data: {
            used_days: {
              decrement: daysRestored,
            },
          },
        });

        // Update leave application end date and days
        const newRequestedDays =
          Number(recall.leaveApplication.requested_days) - daysRestored;

        await prisma.leaveApplication.update({
          where: { id: recall.leaveApplication.id },
          data: {
            end_date: addDays(returnDate, -1),
            return_date: returnDate,
            requested_days: newRequestedDays,
            current_status: "CANCELLED", // Update status to CANCELLED as requested
          },
        });
      }
    }

    // Update recall status
    const updatedRecall = await prisma.leaveRecall.update({
      where: { id: Number(id) },
      data: {
        status: response,
        employee_response: employee_response || null,
        responded_at: new Date(),
        actual_return_date: response === "ACCEPTED"
          ? (actual_return_date ? new Date(actual_return_date) : recall.recall_date)
          : null,
        days_restored: daysRestored,
      },
      include: {
        leaveApplication: {
          include: {
            employee: {
              select: { id: true, full_name: true },
            },
            leaveType: true,
          },
        },
        recalledBy: {
          select: { id: true, full_name: true },
        },
      },
    });

    // Notify manager/recalled_by of response
    try {
      await notifyRecallResponse(updatedRecall, response);
    } catch (notifError) {
      console.error("[LeaveRecall] Error sending recall response notification:", notifError);
    }

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: `Recall ${response.toLowerCase()} successfully${response === "ACCEPTED" && daysRestored > 0
        ? `. ${daysRestored} days restored to leave balance.`
        : ""
        }`,
      data: { recall: updatedRecall },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recall by ID
 */
export const getRecallById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;
    const isAdminOrHR = ['Admin', 'HR'].includes(req.user?.role || '');

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const recall = await prisma.leaveRecall.findFirst({
      where: {
        id: Number(id),
        leaveApplication: {
          company_id: companyId,
          ...(employeeId && !isAdminOrHR && {
            employee: {
              employments: {
                some: {
                  manager_id: employeeId,
                  is_active: true,
                },
              },
            },
          }),
        },
      },
      include: {
        leaveApplication: {
          include: {
            employee: {
              select: {
                id: true,
                full_name: true,
                employments: {
                  where: { is_active: true },
                  select: {
                    department: { select: { name: true } },
                    jobTitle: { select: { title: true } },
                  },
                  take: 1,
                },
              },
            },
            leaveType: true,
          },
        },
        recalledBy: {
          select: { id: true, full_name: true },
        },
      },
    });

    if (!recall) {
      return res.status(404).json({
        status: "fail",
        message: "Recall not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Recall fetched successfully",
      data: { recall },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a recall request (Manager - before employee responds)
 */
export const cancelRecall = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;
    const isAdminOrHR = ['Admin', 'HR'].includes(req.user?.role || '');

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Get the recall
    const recall = await prisma.leaveRecall.findFirst({
      where: {
        id: Number(id),
        status: "PENDING",
        leaveApplication: {
          company_id: companyId,
        },
        ...(!isAdminOrHR && { recalled_by: employeeId || "NONE" })
      },
    });

    if (!recall) {
      return res.status(404).json({
        status: "fail",
        message: "Recall not found or already processed",
      });
    }

    await prisma.leaveRecall.delete({
      where: { id: Number(id) },
    });

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:employees:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:analytics:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Recall cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
};

