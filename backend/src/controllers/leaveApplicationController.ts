import { Request, Response, NextFunction } from "express";
import { prisma } from "src/app";
import { sendEmail } from "src/utils/email";
import {
  calculateWorkingDays,
  calculateReturnDate,
  validateLeaveDates,
  datesOverlap,
  getLeaveStatistics,
  getFiscalYear,
  calculateYearsOfService,
  calculateLeaveEntitlement,
  calculateDynamicLeaveBalance,
} from "src/utils/leaveUtils";
import { getLeaveApplicationEmailHtml } from "src/utils/emailTemplates";
import { RoleNames } from "src/utils/roleConstants";
import {
  notifyLeaveSubmitted,
  notifyLeaveApprovedByManager,
  notifyLeaveApproved,
  notifyLeaveRejected,
  notifyLeaveCancellationRequested,
  notifyLeaveCancellationApproved,
  notifyLeaveCancellationRejected,
} from "src/services/leaveNotificationService";
import { redisService } from "src/services/redisService";

/**
 * Get all leave applications (Admin/HR view)
 */
export const getAllLeaveApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    // Filters
    const status = req.query.status as string;
    const leaveTypeId = req.query.leave_type_id as string;
    const employeeId = req.query.employee_id as string;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;
    // Advanced filters
    const departmentId = req.query.department_id as string;
    const jobTitleId = req.query.job_title_id as string;
    const gender = req.query.gender as string;
    const managerId = req.query.manager_id as string;
    const search = req.query.search as string;
    const cancellationStatus = req.query.cancellation_status as string;

    const where: any = {
      company_id: companyId,
    };

    if (status) {
      where.current_status = status;
    }

    if (cancellationStatus) {
      where.cancellation_status = cancellationStatus;
    }

    if (leaveTypeId) {
      where.leave_type_id = Number(leaveTypeId);
    }

    if (employeeId) {
      where.employee_id = employeeId;
    }

    if (startDate) {
      where.start_date = { gte: new Date(startDate) };
    }

    if (endDate) {
      where.end_date = { ...(where.end_date || {}), lte: new Date(endDate) };
    }

    // Advanced filter: Employee-related filters via nested relation
    const employeeFilter: any = {};

    if (departmentId) {
      employeeFilter.employments = {
        some: {
          is_active: true,
          department_id: Number(departmentId),
        },
      };
    }

    if (jobTitleId) {
      employeeFilter.employments = {
        some: {
          ...(employeeFilter.employments?.some || { is_active: true }),
          job_title_id: Number(jobTitleId),
        },
      };
    }

    if (managerId) {
      employeeFilter.employments = {
        some: {
          ...(employeeFilter.employments?.some || { is_active: true }),
          manager_id: managerId,
        },
      };
    }

    if (gender) {
      // Normalize gender for comparison
      const normalizedGender = gender.trim().toLowerCase();
      if (normalizedGender === "male" || normalizedGender === "m") {
        employeeFilter.gender = { in: ["Male", "M", "male", "m"] };
      } else if (normalizedGender === "female" || normalizedGender === "f") {
        employeeFilter.gender = { in: ["Female", "F", "female", "f"] };
      }
    }

    if (search) {
      employeeFilter.full_name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Apply employee filter if any advanced filters are set
    if (Object.keys(employeeFilter).length > 0) {
      where.employee = employeeFilter;
    }

    // Sorting
    const sortBy = (req.query.sortBy as string) || "created_at";
    const order = (req.query.order as string) || "desc";

    let orderBy: any = {};
    if (sortBy === "full_name") {
      orderBy = { employee: { full_name: order } };
    } else {
      orderBy = { [sortBy]: order };
    }

    const [applications, total] = await Promise.all([
      prisma.leaveApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              gender: true,
              profile_picture_url: true,
              employments: {
                where: { is_active: true },
                select: {
                  department: { select: { name: true } },
                  jobTitle: { select: { title: true, level: true } },
                  gross_salary: true,
                  start_date: true,
                },
                take: 1,
              },
            },
          },
          leaveType: true,
          reliefOfficer: {
            select: {
              id: true,
              full_name: true,
            },
          },
          approvalLogs: {
            orderBy: { action_date: "desc" },
            include: {
              approver: {
                select: {
                  id: true,
                  full_name: true,
                },
              },
            },
          },
        },
      }),
      prisma.leaveApplication.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Leave applications fetched successfully",
      data: {
        applications,
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
 * Get my leave applications (Employee view)
 */
export const getMyLeaveApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    // Pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const status = req.query.status as string;
    const year = req.query.year as string;

    const where: any = {
      company_id: companyId,
      employee_id: employeeId,
    };

    if (status) {
      where.current_status = status;
    }

    if (year) {
      const yearStart = new Date(Number(year), 0, 1);
      const yearEnd = new Date(Number(year), 11, 31);
      where.start_date = {
        gte: yearStart,
        lte: yearEnd,
      };
    }

    const [applications, total] = await Promise.all([
      prisma.leaveApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
            },
          },
          leaveType: true,
          reliefOfficer: {
            select: {
              id: true,
              full_name: true,
            },
          },
          approvalLogs: {
            orderBy: { action_date: "desc" },
            include: {
              approver: {
                select: {
                  id: true,
                  full_name: true,
                },
              },
            },
          },
        },
      }),
      prisma.leaveApplication.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Leave applications fetched successfully",
      data: {
        applications,
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
 * Get pending leave applications (for approvers)
 */
export const getPendingLeaveApplications = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;
    const userRole = req.user?.role;

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

    // Advanced filters
    const leaveTypeId = req.query.leave_type_id as string;
    const departmentId = req.query.department_id as string;
    const jobTitleId = req.query.job_title_id as string;
    const gender = req.query.gender as string;
    const search = req.query.search as string;

    let where: any = {
      company_id: companyId,
    };

    // Filter based on user role and approval level - NORMAL APPLICATIONS ONLY
    if (userRole === RoleNames.HR) {
      where.current_status = "PENDING_HR";
    } else if (
      ["CEO", "Managing Director", "General Manager"].includes(userRole || "")
    ) {
      where.current_status = "PENDING_CEO";
    } else if (
      employeeId &&
      userRole !== RoleNames.ADMIN &&
      userRole !== RoleNames.SUPERADMIN
    ) {
      // Supervisor - get applications from direct reports
      where.current_status = "PENDING_SUPERVISOR";
      where.employee = {
        employments: {
          some: {
            manager_id: employeeId,
            is_active: true,
          },
        },
      };
    } else {
      // Default - show all pending
      where.current_status = {
        in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"],
      };
    }

    // Leave type filter
    if (leaveTypeId) {
      where.leave_type_id = Number(leaveTypeId);
    }

    // Employee-related filters via nested relation
    const employeeFilter: any = {};

    if (departmentId) {
      employeeFilter.employments = {
        some: {
          is_active: true,
          department_id: Number(departmentId),
        },
      };
    }

    if (jobTitleId) {
      employeeFilter.employments = {
        some: {
          ...(employeeFilter.employments?.some || { is_active: true }),
          job_title_id: Number(jobTitleId),
        },
      };
    }

    if (gender) {
      const normalizedGender = gender.trim().toLowerCase();
      if (normalizedGender === "male" || normalizedGender === "m") {
        employeeFilter.gender = { in: ["Male", "M", "male", "m"] };
      } else if (normalizedGender === "female" || normalizedGender === "f") {
        employeeFilter.gender = { in: ["Female", "F", "female", "f"] };
      }
    }

    if (search) {
      employeeFilter.full_name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Merge employee filter with any existing where.employee (supervisor case)
    if (Object.keys(employeeFilter).length > 0) {
      if (where.employee) {
        // Deep merge: preserve existing supervisor constraint and add new filters
        where.employee = {
          ...where.employee,
          ...employeeFilter,
          // If both have employments.some, merge those too
          ...(where.employee.employments && employeeFilter.employments
            ? {
                employments: {
                  some: {
                    ...where.employee.employments.some,
                    ...employeeFilter.employments.some,
                  },
                },
              }
            : {}),
        };
      } else {
        where.employee = employeeFilter;
      }
    }

    const [applications, total] = await Promise.all([
      prisma.leaveApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "asc" }, // FIFO
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              gender: true,
              profile_picture_url: true,
              employments: {
                where: { is_active: true },
                select: {
                  department: { select: { name: true } },
                  jobTitle: { select: { title: true, level: true } },
                },
                take: 1,
              },
            },
          },
          leaveType: true,
          reliefOfficer: {
            select: {
              id: true,
              full_name: true,
            },
          },
        },
      }),
      prisma.leaveApplication.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Pending leave applications fetched successfully",
      data: {
        applications,
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
 * Get pending leave cancellations (for approvers)
 */
export const getPendingLeaveCancellations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;
    const userRole = req.user?.role;

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

    // Advanced filters
    const leaveTypeId = req.query.leave_type_id as string;
    const departmentId = req.query.department_id as string;
    const jobTitleId = req.query.job_title_id as string;
    const gender = req.query.gender as string;
    const search = req.query.search as string;

    let where: any = {
      company_id: companyId,
    };

    // Filter based on user role and approval level - CANCELLATION REQUESTS ONLY
    if (userRole === RoleNames.HR) {
      where.cancellation_status = "PENDING_HR";
    } else if (
      ["CEO", "Managing Director", "General Manager"].includes(userRole || "")
    ) {
      where.cancellation_status = "PENDING_CEO";
    } else if (
      employeeId &&
      userRole !== RoleNames.ADMIN &&
      userRole !== RoleNames.SUPERADMIN
    ) {
      // Supervisor - get cancellation requests from direct reports
      where.cancellation_status = "PENDING_SUPERVISOR";
      where.employee = {
        employments: {
          some: {
            manager_id: employeeId,
            is_active: true,
          },
        },
      };
    } else {
      // Default - show all pending cancellations
      where.cancellation_status = {
        in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"],
      };
    }

    // Leave type filter
    if (leaveTypeId) {
      where.leave_type_id = Number(leaveTypeId);
    }

    // Employee-related filters via nested relation
    const employeeFilter: any = {};

    if (departmentId) {
      employeeFilter.employments = {
        some: {
          is_active: true,
          department_id: Number(departmentId),
        },
      };
    }

    if (jobTitleId) {
      employeeFilter.employments = {
        some: {
          ...(employeeFilter.employments?.some || { is_active: true }),
          job_title_id: Number(jobTitleId),
        },
      };
    }

    if (gender) {
      const normalizedGender = gender.trim().toLowerCase();
      if (normalizedGender === "male" || normalizedGender === "m") {
        employeeFilter.gender = { in: ["Male", "M", "male", "m"] };
      } else if (normalizedGender === "female" || normalizedGender === "f") {
        employeeFilter.gender = { in: ["Female", "F", "female", "f"] };
      }
    }

    if (search) {
      employeeFilter.full_name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Merge employee filter with any existing where.employee (supervisor case)
    if (Object.keys(employeeFilter).length > 0) {
      if (where.employee) {
        where.employee = {
          ...where.employee,
          ...employeeFilter,
          ...(where.employee.employments && employeeFilter.employments
            ? {
                employments: {
                  some: {
                    ...where.employee.employments.some,
                    ...employeeFilter.employments.some,
                  },
                },
              }
            : {}),
        };
      } else {
        where.employee = employeeFilter;
      }
    }

    const [applications, total] = await Promise.all([
      prisma.leaveApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updated_at: "asc" }, // Show oldest requests first
        include: {
          employee: {
            select: {
              id: true,
              full_name: true,
              gender: true,
              profile_picture_url: true,
              employments: {
                where: { is_active: true },
                select: {
                  department: { select: { name: true } },
                  jobTitle: { select: { title: true, level: true } },
                },
                take: 1,
              },
            },
          },
          leaveType: true,
        },
      }),
      prisma.leaveApplication.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: "success",
      message: "Pending leave cancellations fetched successfully",
      data: {
        applications,
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
 * Get a single leave application by ID
 */
export const getLeaveApplicationById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const application = await prisma.leaveApplication.findFirst({
      where: {
        id: Number(id),
        company_id: companyId,
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            gender: true,
            profile_picture_url: true,
            date_of_birth: true,
            place_of_work: true,
            employments: {
              where: { is_active: true },
              select: {
                department: { select: { name: true } },
                jobTitle: { select: { title: true, level: true } },
                gross_salary: true,
                start_date: true,
              },
              take: 1,
            },
          },
        },
        leaveType: true,
        reliefOfficer: {
          select: {
            id: true,
            full_name: true,
          },
        },
        approvalLogs: {
          orderBy: { action_date: "asc" },
          include: {
            approver: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
        },
        leaveRecalls: {
          orderBy: { created_at: "desc" },
          include: {
            recalledBy: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        status: "fail",
        message: "Leave application not found",
      });
    }

    res.status(200).json({
      status: "success",
      message: "Leave application fetched successfully",
      data: { application },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new leave application
 */
export const createLeaveApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    const {
      leave_type_id,
      start_date,
      end_date,
      reason,
      attachment_url,
      is_start_half_day,
      is_end_half_day,
    } = req.body;

    // Validation
    if (!leave_type_id || !start_date || !end_date) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide leave_type_id, start_date, and end_date",
      });
    }

    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);

    // Validate leave type exists and is applicable
    const leaveType = await prisma.leaveType.findFirst({
      where: {
        id: Number(leave_type_id),
        company_id: companyId,
      },
    });

    if (!leaveType) {
      return res.status(404).json({
        status: "fail",
        message: "Leave type not found",
      });
    }

    // Check gender eligibility
    const employee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employeeId,
          company_id: companyId,
        },
      },
      include: {
        employments: {
          where: { is_active: true },
          select: {
            start_date: true,
            probation_end_date: true,
            jobTitle: { select: { level: true } },
          },
          take: 1,
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        status: "fail",
        message: "Employee not found",
      });
    }

    const activeEmployment = employee.employments?.[0];
    if (!activeEmployment) {
      return res.status(400).json({
        status: "fail",
        message: "Active employment record not found",
      });
    }

    const leaveCode = (leaveType.code || "").toUpperCase();
    const isSickLeave = leaveCode === "SICK" || leaveCode.startsWith("SICK_");

    const now = new Date();
    const probationEndDate = activeEmployment.probation_end_date
      ? new Date(activeEmployment.probation_end_date)
      : null;

    if (!isSickLeave && probationEndDate && now < probationEndDate) {
      return res.status(400).json({
        status: "fail",
        message: `You are currently in probation period until ${probationEndDate.toLocaleDateString("en-GB")}. Leave requests are not allowed during probation.`,
      });
    }

    // Normalize gender for comparison (handle "M"/"Male" and "F"/"Female")
    const normalizeGender = (
      gender: string | null | undefined,
    ): string | null => {
      if (!gender) return null;
      const normalized = gender.trim().toUpperCase();
      if (normalized === "M" || normalized === "MALE") return "Male";
      if (normalized === "F" || normalized === "FEMALE") return "Female";
      return gender; // Return as-is if it's already "Male" or "Female"
    };

    const employeeGenderNormalized = normalizeGender(employee.gender);
    const leaveTypeGender = leaveType.applicable_gender;

    if (
      leaveTypeGender !== "All" &&
      leaveTypeGender !== employeeGenderNormalized
    ) {
      return res.status(400).json({
        status: "fail",
        message: `This leave type is only applicable for ${leaveTypeGender} employees`,
      });
    }

    // Calculate working days or calendar days based on leave type
    // Calculate working days or calendar days based on leave type
    const isCalendarDaysLeave =
      leaveType.is_calendar_days === true ||
      ["MATERNITY_PRE", "MATERNITY_POST", "PATERNITY"].includes(leaveType.code);

    const requestedDays = await calculateWorkingDays(
      startDateObj,
      endDateObj,
      companyId,
      {
        isCalendarDays: isCalendarDaysLeave,
        isStartHalfDay: is_start_half_day === true,
        isEndHalfDay: is_end_half_day === true,
      },
    );

    if (requestedDays <= 0) {
      return res.status(400).json({
        status: "fail",
        message:
          "Requested leave days must be greater than zero. Please check your dates.",
      });
    }

    // Calculate return date
    const returnDate = await calculateReturnDate(endDateObj, companyId);

    // Validate dates
    const dateValidation = validateLeaveDates(
      startDateObj,
      endDateObj,
      returnDate,
    );
    if (!dateValidation.valid) {
      return res.status(400).json({
        status: "fail",
        message: dateValidation.message,
      });
    }

    // Check for overlapping leave applications
    const overlappingLeave = await prisma.leaveApplication.findFirst({
      where: {
        employee_id: employeeId,
        company_id: companyId,
        current_status: {
          in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO", "APPROVED"],
        },
        OR: [
          {
            AND: [
              { start_date: { lte: endDateObj } },
              { end_date: { gte: startDateObj } },
            ],
          },
        ],
      },
    });

    if (overlappingLeave) {
      return res.status(400).json({
        status: "fail",
        message: "You already have a leave application for overlapping dates",
      });
    }

    // Get fiscal year for balance checks
    // Use leave start date to determine fiscal year (important for across-year applications)
    const fiscalYear = await getFiscalYear(companyId, new Date(start_date));

    // Special validation for Unpaid Leave
    if (leaveType.code === "UNPAID") {
      // Check max 5 consecutive days
      if (requestedDays > 5) {
        return res.status(400).json({
          status: "fail",
          message: "Unpaid leave cannot exceed 5 consecutive days per request",
        });
      }

      // Check usage count (max 2 per budget year)
      const unpaidUsage = await prisma.unpaidLeaveUsage.findUnique({
        where: {
          employee_id_company_id_fiscal_year: {
            employee_id: employeeId,
            company_id: companyId,
            fiscal_year: fiscalYear,
          },
        },
      });

      if (unpaidUsage && unpaidUsage.usage_count >= 2) {
        return res.status(400).json({
          status: "fail",
          message:
            "Unpaid leave can only be granted twice per budget year. You have already used your 2 unpaid leave requests.",
        });
      }
    }

    // Check leave balance for ALL leave types (enforce limits)
    // First, get leaveSettings for accrual_basis
    const leaveSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
    });

    const leaveBalance = await prisma.leaveBalance.findUnique({
      where: {
        employee_id_leave_type_id_fiscal_year: {
          employee_id: employeeId,
          leave_type_id: Number(leave_type_id),
          fiscal_year: fiscalYear,
        },
      },
    });

    // Use dynamic calculation for available days
    const hireDate = employee.employments[0]?.start_date ?? new Date();
    const dynamicBalance = calculateDynamicLeaveBalance(
      leaveType,
      leaveBalance,
      hireDate,
      leaveSettings,
    );

    // Subtract pending days from remaining to account for other in-flight requests
    const availableDays =
      dynamicBalance.remainingDays - dynamicBalance.pendingDays;

    if (requestedDays > availableDays) {
      return res.status(400).json({
        status: "fail",
        message: `Insufficient ${leaveType.name} balance. Available: ${availableDays.toFixed(2)} days, Requested: ${requestedDays} days`,
      });
    }

    // Check if attachment is required
    if (
      leaveType.requires_attachment &&
      (!attachment_url || attachment_url.trim() === "")
    ) {
      return res.status(400).json({
        status: "fail",
        message: `A ${leaveType.name} application requires a supporting document/attachment. Please upload a file (e.g., Medical Certificate).`,
      });
    }

    // Auto-populate relief officer with employee's direct manager
    const activeEmploymentRecord = await prisma.employment.findFirst({
      where: {
        employee_id: employeeId,
        company_id: companyId,
        is_active: true,
      },
      select: {
        manager_id: true,
        jobTitle: { select: { level: true } },
      },
    });

    const finalReliefOfficerId = activeEmploymentRecord?.manager_id || null;

    // Determine initial status based on employee level OR if no manager exists
    // Managers, Directors, Executives skip supervisor approval and go to HR
    // If no manager is assigned, also escalate directly to HR
    const employeeLevel = activeEmploymentRecord?.jobTitle?.level || "";
    const isManagerLevel = ["Manager", "Director", "Executive"].includes(
      employeeLevel,
    );
    const initialStatus =
      isManagerLevel || !finalReliefOfficerId
        ? "PENDING_HR"
        : "PENDING_SUPERVISOR";

    // Create leave application
    const application = await prisma.leaveApplication.create({
      data: {
        employee_id: employeeId,
        company_id: companyId,
        leave_type_id: Number(leave_type_id),
        start_date: startDateObj,
        end_date: endDateObj,
        return_date: returnDate,
        requested_days: requestedDays,
        reason: reason || null,
        attachment_url: attachment_url || null,
        is_start_half_day: is_start_half_day === true,
        is_end_half_day: is_end_half_day === true,
        relief_officer_id: finalReliefOfficerId,
        relief_company_id: finalReliefOfficerId ? companyId : null,
        current_status: initialStatus,
      },
      include: {
        leaveType: true,
        reliefOfficer: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    // Update pending days in leave balance for all leave types
    await prisma.leaveBalance.upsert({
      where: {
        employee_id_leave_type_id_fiscal_year: {
          employee_id: employeeId,
          leave_type_id: Number(leave_type_id),
          fiscal_year: fiscalYear,
        },
      },
      update: {
        pending_days: {
          increment: requestedDays,
        },
      },
      create: {
        employee_id: employeeId,
        company_id: companyId,
        leave_type_id: Number(leave_type_id),
        fiscal_year: fiscalYear,
        total_entitlement: (() => {
          // Calculate dynamic entitlement based on tenure
          const hireDate = employee.employments[0]?.start_date ?? new Date();
          const yearsOfService = calculateYearsOfService(hireDate);

          return calculateLeaveEntitlement(
            leaveType.default_allowance_days,
            leaveType.incremental_days_per_year || 0,
            yearsOfService,
            leaveType.max_accrual_limit,
            leaveType.incremental_period_years || 2, // Default to 2 if not set
          );
        })(),
        used_days: 0,
        pending_days: requestedDays,
      },
    });

    // Send notification to supervisor
    try {
      await notifyLeaveSubmitted(application);
    } catch (notifError) {
      console.error(
        "[LeaveApplication] Error sending notification:",
        notifError,
      );
      // Don't fail the request if notification fails
    }

    // Invalidate Cache
    redisService
      .delByPattern(`company:${companyId}:leave_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:leave_stats:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:leave_my:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:analytics:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:team_leave:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:leave_balance_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${companyId}:leave_balance_my:*`)
      .catch(console.error);
    redisService
      .delByPattern(`leave_balance:${companyId}:${employeeId}:*`)
      .catch(console.error);

    res.status(201).json({
      status: "success",
      message: "Leave application submitted successfully",
      data: { application },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve a leave application
 */
export const approveLeaveApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const approverId = req.user?.employee_id;
    const userRole = req.user?.role;

    if (!companyId || !approverId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const { comments } = req.body;

    // Validate ID parameter
    const applicationId = Number(id);
    if (!id || isNaN(applicationId)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid leave application ID",
      });
    }

    // Get the application
    const application = await prisma.leaveApplication.findFirst({
      where: {
        id: applicationId,
        company_id: companyId,
      },
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            appUsers: {
              select: { email: true },
              where: { is_active: true },
              take: 1,
            },
            employments: {
              where: { is_active: true },
              select: {
                start_date: true,
                manager_id: true,
                jobTitle: { select: { level: true } },
              },
              take: 1,
            },
          },
        },
        leaveType: true,
      },
    });

    if (!application) {
      return res.status(404).json({
        status: "fail",
        message: "Leave application not found",
      });
    }

    // Prevent self-approval
    if (application.employee_id === approverId) {
      return res.status(403).json({
        status: "fail",
        message: "You cannot approve your own leave application",
      });
    }

    // Validate current status and approver authorization
    let approverRole: string;
    let nextStatus: string;

    const currentStatus = application.current_status;
    console.log("[DEBUG] currentStatus:", currentStatus);

    const employment = application.employee.employments[0];
    const employeeLevel = employment?.jobTitle?.level || "";
    const isAdmin = userRole === RoleNames.ADMIN;

    const managerLevels = ["Manager", "Director", "Executive"];

    console.log("[DEBUG] finding leaveSettings for company:", companyId);
    const leaveSettings = await prisma.leaveSettings.findUnique({
      where: { company_id: companyId },
      select: { require_ceo_approval_for_managers: true },
    });
    console.log("[DEBUG] leaveSettings:", leaveSettings);

    const requireCeoApprovalForManagers =
      leaveSettings?.require_ceo_approval_for_managers ?? true;

    if (currentStatus === "PENDING_SUPERVISOR") {
      // Admin can approve at any stage, or the direct supervisor
      if (!isAdmin && employment?.manager_id !== approverId) {
        return res.status(403).json({
          status: "fail",
          message: "You are not authorized to approve this application",
        });
      }
      approverRole = isAdmin ? "Admin (Supervisor Override)" : "Supervisor";

      // If approver is HR or Admin, it can go to APPROVED directly (skipping PENDING_HR)
      // unless it's a manager-level employee who requires CEO approval
      if (userRole === RoleNames.HR || isAdmin) {
        const isManagerLevel = managerLevels.includes(employeeLevel);
        if (isManagerLevel && requireCeoApprovalForManagers && !isAdmin) {
          nextStatus = "PENDING_CEO";
        } else {
          nextStatus = "APPROVED";
        }
      } else {
        nextStatus = "PENDING_HR";
      }
    } else if (currentStatus === "PENDING_HR") {
      // Check if approver is HR or Admin
      if (userRole !== RoleNames.HR && !isAdmin) {
        return res.status(403).json({
          status: "fail",
          message: "Only HR can approve at this stage",
        });
      }
      approverRole = isAdmin ? "Admin (HR)" : "HR";
      // If CEO approval for managers is disabled, HR can fully approve.
      // Otherwise, only manager-level employees go to CEO.
      const isManagerLevel = managerLevels.includes(employeeLevel);
      if (isManagerLevel && requireCeoApprovalForManagers && !isAdmin) {
        // Only require CEO approval if NOT approved by Admin
        nextStatus = "PENDING_CEO";
      } else {
        nextStatus = "APPROVED";
      }
    } else if (currentStatus === "PENDING_CEO") {
      // If CEO approval for managers is disabled, do not enforce CEO stage.
      // Allow HR (or Admin) to finalize any applications already sitting in PENDING_CEO.
      if (!requireCeoApprovalForManagers) {
        if (userRole !== RoleNames.HR && !isAdmin) {
          return res.status(403).json({
            status: "fail",
            message: "Only HR can approve at this stage",
          });
        }
        approverRole = isAdmin ? "Admin (HR)" : "HR";
        nextStatus = "APPROVED";
      } else {
        // Check if approver is CEO or Admin
        if (
          !isAdmin &&
          !["CEO", "Managing Director", "General Manager"].includes(
            userRole || "",
          )
        ) {
          return res.status(403).json({
            status: "fail",
            message: "Only CEO can approve at this stage",
          });
        }
        approverRole = isAdmin ? "Admin (CEO)" : "CEO";
        nextStatus = "APPROVED";
      }
    } else {
      return res.status(400).json({
        status: "fail",
        message: `Cannot approve application with status: ${currentStatus}`,
      });
    }

    // ======================================================================
    // BALANCE CHECK: Before final approval, verify employee has enough days
    // ======================================================================
    if (nextStatus === "APPROVED") {
      const approvalFiscalYear = await getFiscalYear(
        companyId,
        new Date(application.start_date),
      );

      const approvalLeaveBalance = await prisma.leaveBalance.findUnique({
        where: {
          employee_id_leave_type_id_fiscal_year: {
            employee_id: application.employee_id,
            leave_type_id: application.leave_type_id,
            fiscal_year: approvalFiscalYear,
          },
        },
      });

      const approvalLeaveSettings = await prisma.leaveSettings.findUnique({
        where: { company_id: companyId },
      });

      const hireDate =
        application.employee.employments[0]?.start_date ?? new Date();
      const dynamicBalance = calculateDynamicLeaveBalance(
        application.leaveType,
        approvalLeaveBalance,
        hireDate,
        approvalLeaveSettings,
      );

      const requestedDays = Number(application.requested_days);
      const remainingDays = dynamicBalance.remainingDays;

      if (requestedDays > remainingDays) {
        return res.status(400).json({
          status: "fail",
          message: `Cannot approve: Requested ${requestedDays} day(s) exceeds remaining balance of ${remainingDays.toFixed(1)} day(s). (Total: ${dynamicBalance.totalEntitlement.toFixed(1)}, Used: ${dynamicBalance.usedDays.toFixed(1)})`,
        });
      }
    }

    // Update application status
    const updatedApplication = await prisma.leaveApplication.update({
      where: { id: Number(id) },
      data: {
        current_status: nextStatus,
        updated_at: new Date(),
      },
    });

    // Create approval log
    await prisma.leaveApprovalLog.create({
      data: {
        application_id: Number(id),
        approver_id: approverId,
        approver_company_id: companyId,
        approver_role: approverRole,
        action: "APPROVED",
        comments: comments || null,
      },
    });

    // If fully approved, update leave balance and track usage
    if (nextStatus === "APPROVED") {
      // CRITICAL FIX: Use the fiscal year of the leave's START DATE for balance updates
      const fiscalYear = await getFiscalYear(
        companyId,
        new Date(application.start_date),
      );
      console.log(
        `[LeaveApproval] Updating balance for ${application.employee.full_name}, Fiscal Year: ${fiscalYear}`,
      );

      // Update used days and remove from pending
      await prisma.leaveBalance.updateMany({
        where: {
          employee_id: application.employee_id,
          leave_type_id: application.leave_type_id,
          fiscal_year: fiscalYear,
        },
        data: {
          used_days: {
            increment: Number(application.requested_days),
          },
          pending_days: {
            decrement: Number(application.requested_days),
          },
        },
      });

      // Track unpaid leave usage (max 2 per budget year)
      if (application.leaveType.code === "UNPAID") {
        await prisma.unpaidLeaveUsage.upsert({
          where: {
            employee_id_company_id_fiscal_year: {
              employee_id: application.employee_id,
              company_id: companyId,
              fiscal_year: fiscalYear,
            },
          },
          update: {
            usage_count: {
              increment: 1,
            },
          },
          create: {
            employee_id: application.employee_id,
            company_id: companyId,
            fiscal_year: fiscalYear,
            usage_count: 1,
          },
        });
      }

      // Send notifications
      try {
        // Notify employee of full approval
        const approverName = await prisma.employee.findUnique({
          where: {
            id_company_id: {
              id: approverId,
              company_id: companyId,
            },
          },
          select: { full_name: true },
        });

        await notifyLeaveApproved(
          application,
          approverName?.full_name || approverRole,
        );
      } catch (notifError) {
        console.error(
          "[LeaveApplication] Error sending approval notification:",
          notifError,
        );
      }
    } else if (nextStatus === "PENDING_HR") {
      // Manager approved, notify HR
      try {
        await notifyLeaveApprovedByManager(application);
      } catch (notifError) {
        console.error(
          "[LeaveApplication] Error sending HR notification:",
          notifError,
        );
      }
    }

    // Invalidate Cache
    const appId = application.company_id;
    redisService
      .delByPattern(`company:${appId}:leave_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${appId}:leave_stats:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${appId}:leave_my:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${appId}:analytics:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${appId}:team_leave:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${appId}:leave_balance_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${appId}:leave_balance_my:*`)
      .catch(console.error);
    redisService
      .delByPattern(`leave_balance:${appId}:${application.employee_id}:*`)
      .catch(console.error);

    res.status(200).json({
      status: "success",
      message:
        nextStatus === "APPROVED"
          ? "Leave application fully approved"
          : `Leave application approved and forwarded to ${nextStatus.replace(
              "PENDING_",
              "",
            )}`,
      data: { application: updatedApplication },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject a leave application
 */
export const rejectLeaveApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.company_id;
    const approverId = req.user?.employee_id;
    const userRole = req.user?.role;

    if (!companyId || !approverId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const { rejection_reason, comments } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide a rejection reason",
      });
    }

    // Validate ID parameter
    const applicationId = Number(id);
    if (!id || isNaN(applicationId)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid leave application ID",
      });
    }

    // Get the application
    const application = await prisma.leaveApplication.findFirst({
      where: {
        id: applicationId,
        company_id: companyId,
      },
      include: {
        employee: {
          select: {
            full_name: true,
            appUsers: {
              select: { email: true },
              where: { is_active: true },
              take: 1,
            },
            employments: {
              where: { is_active: true },
              select: { manager_id: true },
              take: 1,
            },
          },
        },
        leaveType: {
          select: { name: true },
        },
      },
    });

    if (!application) {
      return res.status(404).json({
        status: "fail",
        message: "Leave application not found",
      });
    }

    // Validate current status
    const currentStatus = application.current_status;
    if (
      !["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"].includes(
        currentStatus || "",
      )
    ) {
      return res.status(400).json({
        status: "fail",
        message: `Cannot reject application with status: ${currentStatus}`,
      });
    }

    // Determine approver role
    const isAdmin = userRole === RoleNames.ADMIN;
    let approverRole: string;
    if (currentStatus === "PENDING_SUPERVISOR") {
      approverRole = isAdmin ? "Admin (Supervisor Override)" : "Supervisor";
    } else if (currentStatus === "PENDING_HR") {
      approverRole = isAdmin ? "Admin (HR)" : "HR";
    } else {
      approverRole = isAdmin ? "Admin (CEO)" : "CEO";
    }

    // Update application status
    const updatedApplication = await prisma.leaveApplication.update({
      where: { id: Number(id) },
      data: {
        current_status: "REJECTED",
        updated_at: new Date(),
      },
    });

    // Create rejection log
    await prisma.leaveApprovalLog.create({
      data: {
        application_id: Number(id),
        approver_id: approverId,
        approver_company_id: companyId,
        approver_role: approverRole,
        action: "REJECTED",
        comments: `${rejection_reason}${comments ? `. ${comments}` : ""}`,
      },
    });

    // Remove from pending days in leave balance for the correct fiscal year
    const fiscalYear = await getFiscalYear(
      application.company_id,
      new Date(application.start_date),
    );
    await prisma.leaveBalance.updateMany({
      where: {
        employee_id: application.employee_id,
        leave_type_id: application.leave_type_id,
        fiscal_year: fiscalYear,
      },
      data: {
        pending_days: {
          decrement: Number(application.requested_days),
        },
      },
    });

    const employeeEmail = application.employee.appUsers[0]?.email;
    if (employeeEmail) {
      try {
        const rejectionMessage = `${rejection_reason}${
          comments ? `. ${comments}` : ""
        }`;
        await notifyLeaveRejected(application, rejectionMessage, approverRole);
      } catch (notifError) {
        console.error(
          "[LeaveApplication] Error sending rejection notification:",
          notifError,
        );
      }
    }

    // Invalidate Cache
    const rejectCid = application.company_id;
    redisService
      .delByPattern(`company:${rejectCid}:leave_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${rejectCid}:leave_stats:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${rejectCid}:leave_my:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${rejectCid}:analytics:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${rejectCid}:team_leave:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${rejectCid}:leave_balance_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${rejectCid}:leave_balance_my:*`)
      .catch(console.error);
    redisService
      .delByPattern(`leave_balance:${rejectCid}:${application.employee_id}:*`)
      .catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Leave application rejected",
      data: { application: updatedApplication },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel a leave application (by employee)
 */
export const cancelLeaveApplication = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    // Validate ID parameter
    const applicationId = Number(id);
    if (!id || isNaN(applicationId)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid leave application ID",
      });
    }

    // Get the application
    const whereClause: any = {
      id: applicationId,
      company_id: companyId,
    };

    // If not admin/hr, only allow cancelling own leave
    const userRole = (req.user?.role || "").toUpperCase();
    if (!["ADMIN", "HR"].includes(userRole)) {
      whereClause.employee_id = employeeId;
    }

    const application = await prisma.leaveApplication.findFirst({
      where: whereClause,
    });

    if (!application) {
      return res.status(404).json({
        status: "fail",
        message: "Leave application not found",
      });
    }

    // Check if can be cancelled
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentStatus = application.current_status || "";
    const startDate = new Date(application.start_date);

    // Strict check for employees: Cannot directly cancel APPROVED leave at ANY time.
    // They MUST use the 'Request Cancellation' flow which involves Approval.
    if (!["ADMIN", "HR", "SUPER ADMIN"].includes(userRole)) {
      if (currentStatus === "APPROVED") {
        return res.status(400).json({
          status: "fail",
          message: "Approved leave cannot be cancelled directly. Please use the 'Request Cancellation' feature instead.",
        });
      }

      // If not approved, must be one of the pending statuses
      if (!["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"].includes(currentStatus)) {
        return res.status(400).json({
          status: "fail",
          message: `Cannot cancel leave with status: ${currentStatus.replace(/_/g, " ")}`,
        });
      }
    }

    // Role-based logic for Admin/HR or cancellation of PENDING leaves

    // Calculate the fiscal year for balance updates
    const appFiscalYear = await getFiscalYear(
      application.company_id,
      application.start_date,
    );

    if (currentStatus === "APPROVED") {
      // If we are here, it's an Admin/HR performing a direct cancellation of an APPROVED leave
      const endDate = new Date(application.end_date);
      endDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);

      const leaveHasStarted = startDate <= today;
      const leaveHasEnded = endDate < today;

      // Don't allow cancel if the leave has already fully ended
      if (leaveHasEnded) {
        return res.status(400).json({
          status: "fail",
          message: "Cannot cancel a leave that has already ended",
        });
      }

      if (leaveHasStarted) {
        // Only Admin or HR can perform mid-leave cancellation (shortening)
        if (!["ADMIN", "HR", "SUPER ADMIN"].includes(userRole)) {
          return res.status(400).json({
            status: "fail",
            message: "Cannot cancel a leave that has already started. Please use the 'Request Early Return' feature instead.",
          });
        }

        // ====================================================================
        // MID-LEAVE CANCELLATION: Calculate actual days consumed
        // used_days should reflect only start_date → today (inclusive)
        // Restore the unused portion (today+1 → end_date)
        // ====================================================================
        const actualDaysUsed = await calculateWorkingDays(
          startDate,
          today,
          application.company_id,
        );
        const originalRequestedDays = Number(application.requested_days);
        const daysToRestore = Math.max(
          0,
          originalRequestedDays - actualDaysUsed,
        );

        console.log(
          `[LeaveCancel] Mid-leave cancel for ${application.employee_id}: ` +
            `original=${originalRequestedDays}, actualUsed=${actualDaysUsed}, restoring=${daysToRestore}`,
        );

        // Update application: shorten to actual period used, mark as CANCELLED
        const updatedApplication = await prisma.leaveApplication.update({
          where: { id: Number(id) },
          data: {
            current_status: "CANCELLED",
            end_date: today,
            requested_days: actualDaysUsed,
            updated_at: new Date(),
          },
        });

        // Restore only the unused portion of used_days
        if (daysToRestore > 0) {
          await prisma.leaveBalance.updateMany({
            where: {
              employee_id: application.employee_id,
              leave_type_id: application.leave_type_id,
              fiscal_year: appFiscalYear,
            },
            data: {
              used_days: {
                decrement: daysToRestore,
              },
            },
          });
        }

        // Invalidate Cache
        const cancelCid = application.company_id;
        redisService
          .delByPattern(`company:${cancelCid}:leave_list:*`)
          .catch(console.error);
        redisService
          .delByPattern(`company:${cancelCid}:leave_stats:*`)
          .catch(console.error);
        redisService
          .delByPattern(`company:${cancelCid}:leave_my:*`)
          .catch(console.error);
        redisService
          .delByPattern(`company:${cancelCid}:analytics:*`)
          .catch(console.error);
        redisService
          .delByPattern(`company:${cancelCid}:team_leave:*`)
          .catch(console.error);
        redisService
          .delByPattern(`company:${cancelCid}:leave_balance_list:*`)
          .catch(console.error);
        redisService
          .delByPattern(`company:${cancelCid}:leave_balance_my:*`)
          .catch(console.error);
        redisService
          .delByPattern(`leave_balance:${cancelCid}:${application.employee_id}:*`)
          .catch(console.error);

        return res.status(200).json({
          status: "success",
          message: `Leave cancelled. ${actualDaysUsed} day(s) used, ${daysToRestore} day(s) restored to balance.`,
          data: { application: updatedApplication },
        });
      }

      // APPROVED but not started yet — restore ALL used_days
      const updatedApplication = await prisma.leaveApplication.update({
        where: { id: Number(id) },
        data: {
          current_status: "CANCELLED",
          updated_at: new Date(),
        },
      });

      await prisma.leaveBalance.updateMany({
        where: {
          employee_id: application.employee_id,
          leave_type_id: application.leave_type_id,
          fiscal_year: appFiscalYear,
        },
        data: {
          used_days: {
            decrement: Number(application.requested_days),
          },
        },
      });

      // Invalidate Cache
      const cancelCid = application.company_id;
      redisService
        .delByPattern(`company:${cancelCid}:leave_list:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${cancelCid}:leave_stats:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${cancelCid}:leave_my:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${cancelCid}:analytics:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${cancelCid}:team_leave:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${cancelCid}:leave_balance_list:*`)
        .catch(console.error);
      redisService
        .delByPattern(`company:${cancelCid}:leave_balance_my:*`)
        .catch(console.error);
      redisService
        .delByPattern(`leave_balance:${cancelCid}:${application.employee_id}:*`)
        .catch(console.error);

      return res.status(200).json({
        status: "success",
        message: "Leave application cancelled successfully",
        data: { application: updatedApplication },
      });
    }

    // PENDING status — remove from pending days
    const updatedApplication = await prisma.leaveApplication.update({
      where: { id: Number(id) },
      data: {
        current_status: "CANCELLED",
        updated_at: new Date(),
      },
    });

    await prisma.leaveBalance.updateMany({
      where: {
        employee_id: application.employee_id,
        leave_type_id: application.leave_type_id,
        fiscal_year: appFiscalYear,
      },
      data: {
        pending_days: {
          decrement: Number(application.requested_days),
        },
      },
    });

    // Invalidate Cache
    const cancelCid = application.company_id;
    redisService
      .delByPattern(`company:${cancelCid}:leave_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${cancelCid}:leave_stats:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${cancelCid}:leave_my:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${cancelCid}:analytics:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${cancelCid}:team_leave:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${cancelCid}:leave_balance_list:*`)
      .catch(console.error);
    redisService
      .delByPattern(`company:${cancelCid}:leave_balance_my:*`)
      .catch(console.error);
    redisService
      .delByPattern(`leave_balance:${cancelCid}:${application.employee_id}:*`)
      .catch(console.error);

    res.status(200).json({
      status: "success",
      message: "Leave application cancelled successfully",
      data: { application: updatedApplication },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get cancellable leaves for an employee
 */
export const getCancellableLeaves = async (
  req: Request,
  res: Response,
  next: NextFunction,
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const applications = await prisma.leaveApplication.findMany({
      where: {
        company_id: companyId,
        employee_id: employeeId,
        OR: [
          // Pending applications
          {
            current_status: {
              in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"],
            },
          },
          // Approved but not started
          {
            current_status: "APPROVED",
            start_date: { gt: today },
            requested_days: { gt: 0 }, // Exclude recalled/cancelled
          },
        ],
      },
      include: {
        leaveType: true,
      },
      orderBy: { start_date: "asc" },
    });

    res.status(200).json({
      status: "success",
      message: "Cancellable leaves fetched successfully",
      data: { applications },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get employees currently on leave with full details
 */
export const getEmployeesOnLeave = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Robust Date Construction to ensure we get exactly today relative to calendar
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayString = `${year}-${month}-${day}`;

    // Force UTC comparison to avoid timezone shifts
    const today = new Date(`${todayString}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayString}T23:59:59.999Z`);

    // Advanced filters
    const departmentId = req.query.department_id as string;
    const jobTitleId = req.query.job_title_id as string;
    const leaveTypeId = req.query.leave_type_id as string;
    const gender = req.query.gender as string;
    const managerId = req.query.manager_id as string;
    const search = req.query.search as string;

    // Build employee filter for nested relation
    const employeeFilter: any = {};

    if (departmentId) {
      employeeFilter.employments = {
        some: {
          is_active: true,
          department_id: Number(departmentId),
        },
      };
    }

    if (jobTitleId) {
      employeeFilter.employments = {
        some: {
          ...(employeeFilter.employments?.some || { is_active: true }),
          job_title_id: Number(jobTitleId),
        },
      };
    }

    if (gender) {
      const normalizedGender = gender.trim().toLowerCase();
      if (normalizedGender === "male" || normalizedGender === "m") {
        employeeFilter.gender = { in: ["Male", "M", "male", "m"] };
      } else if (normalizedGender === "female" || normalizedGender === "f") {
        employeeFilter.gender = { in: ["Female", "F", "female", "f"] };
      }
    }

    if (search) {
      employeeFilter.full_name = {
        contains: search,
        mode: "insensitive",
      };
    }

    if (managerId) {
      employeeFilter.employments = {
        some: {
          ...(employeeFilter.employments?.some || { is_active: true }),
          manager_id: managerId,
        },
      };
    }

    // Build main where clause
    const where: any = {
      company_id: companyId,
      current_status: "APPROVED",
      start_date: { lte: endOfDay },
      end_date: { gte: today },
      requested_days: { gt: 0 }, // Exclude recalled/cancelled leaves with 0 days
    };

    if (leaveTypeId) {
      where.leave_type_id = Number(leaveTypeId);
    }

    if (Object.keys(employeeFilter).length > 0) {
      where.employee = employeeFilter;
    }

    const applications = await prisma.leaveApplication.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            full_name: true,
            gender: true,
            profile_picture_url: true,
            phones: {
              where: { is_primary: true },
              select: { phone_number: true },
              take: 1,
            },
            documents: {
              select: { cv: true },
            },
            employments: {
              where: { is_active: true },
              select: {
                department: { select: { id: true, name: true } },
                jobTitle: { select: { id: true, title: true, level: true } },
              },
              take: 1,
            },
          },
        },
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            is_paid: true,
          },
        },
      },
      orderBy: {
        end_date: "asc",
      },
    });

    // Format response to be more frontend-friendly
    const formattedEmployees = applications.map((app) => ({
      id: app.id, // Ensure compatibility with frontend handlers expecting 'id'
      application_id: app.id,
      employee_id: app.employee_id,
      full_name: app.employee.full_name,
      gender: app.employee.gender,
      photo: app.employee.profile_picture_url || null,
      phone: app.employee.phones[0]?.phone_number || null,
      department: app.employee.employments[0]?.department?.name || null,
      job_title: app.employee.employments[0]?.jobTitle?.title || null,
      job_level: app.employee.employments[0]?.jobTitle?.level || null,
      leave_type: app.leaveType.name,
      leave_code: app.leaveType.code,
      is_paid: app.leaveType.is_paid,
      start_date: app.start_date,
      end_date: app.end_date,
      return_date: app.return_date,
      requested_days: Math.abs(Number(app.requested_days)), // Ensure positive value
      reason: app.reason,
      created_at: app.created_at,
    }));

    // Prevent caching to ensure fresh data
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.status(200).json({
      status: "success",
      message: "Employees on leave fetched successfully",
      data: {
        count: formattedEmployees.length,
        date: new Date().toISOString().split("T")[0],
        employees: formattedEmployees,
        applications: applications, // Include raw applications for generic components
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get accurate counts for all Leave Management tabs in one go
 */
export const getLeaveManagementTabCounts = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;
    const userRole = req.user?.role;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Shared Filters (Same as what's used in tables)
    const departmentId = req.query.department_id as string;
    const jobTitleId = req.query.job_title_id as string;
    const leaveTypeId = req.query.leave_type_id as string;
    const gender = req.query.gender as string;
    const managerId = req.query.manager_id as string;
    const search = req.query.search as string;

    const employeeFilter: any = {};
    if (departmentId) {
      employeeFilter.employments = { some: { is_active: true, department_id: Number(departmentId) } };
    }
    if (jobTitleId) {
      employeeFilter.employments = {
        some: { ...(employeeFilter.employments?.some || { is_active: true }), job_title_id: Number(jobTitleId) },
      };
    }
    if (gender) {
      const normalizedGender = gender.trim().toLowerCase();
      if (normalizedGender === "male" || normalizedGender === "m") {
        employeeFilter.gender = { in: ["Male", "M", "male", "m"] };
      } else if (normalizedGender === "female" || normalizedGender === "f") {
        employeeFilter.gender = { in: ["Female", "F", "female", "f"] };
      }
    }
    if (search) {
      employeeFilter.full_name = { contains: search, mode: "insensitive" };
    }
    if (managerId) {
      employeeFilter.employments = {
        some: { ...(employeeFilter.employments?.some || { is_active: true }), manager_id: managerId },
      };
    }

    // Date pre-calc for On Leave and Expiring
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayString = `${year}-${month}-${day}`;
    
    // Force UTC comparison to avoid timezone shifts
    const today = new Date(`${todayString}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayString}T23:59:59.999Z`);
    
    const thresholdDate = new Date();
    const daysThreshold = Number(req.query.days_threshold) || 90;
    thresholdDate.setDate(now.getDate() + daysThreshold);

    // 1. On Leave Condition
    const onLeaveWhere: any = {
      company_id: companyId,
      current_status: "APPROVED",
      start_date: { lte: endOfDay },
      end_date: { gte: today },
      requested_days: { gt: 0 },
    };

    // 2. Pending Approval Condition
    const pendingWhere: any = { 
      company_id: companyId,
      cancellation_status: null // Exclude cancellations from normal pending
    };
    if (userRole === RoleNames.HR) {
      pendingWhere.current_status = "PENDING_HR";
    } else if (["CEO", "Managing Director", "General Manager"].includes(userRole || "")) {
      pendingWhere.current_status = "PENDING_CEO";
    } else if (employeeId && ![RoleNames.ADMIN, RoleNames.SUPERADMIN, RoleNames.HR].includes(userRole as any)) {
      pendingWhere.current_status = "PENDING_SUPERVISOR";
      pendingWhere.employee = { employments: { some: { manager_id: employeeId, is_active: true } } };
    } else {
      pendingWhere.current_status = { in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"] };
    }

    // 3. Cancellation Requests Condition
    const cancellationsWhere: any = { company_id: companyId };
    if (userRole === RoleNames.HR) {
      cancellationsWhere.cancellation_status = "PENDING_HR";
    } else if (["CEO", "Managing Director", "General Manager"].includes(userRole || "")) {
      cancellationsWhere.cancellation_status = "PENDING_CEO";
    } else if (employeeId && ![RoleNames.ADMIN, RoleNames.SUPERADMIN, RoleNames.HR].includes(userRole as any)) {
      cancellationsWhere.cancellation_status = "PENDING_SUPERVISOR";
      cancellationsWhere.employee = { employments: { some: { manager_id: employeeId, is_active: true } } };
    } else {
      cancellationsWhere.cancellation_status = { in: ["PENDING_SUPERVISOR", "PENDING_HR", "PENDING_CEO"] };
    }

    // 4. Cash-Out Requests Condition
    const cashOutWhere: any = { company_id: companyId, status: "PENDING" };

    // 5. Expiring Balances Condition
    const expiringWhere: any = {
      company_id: companyId,
      remaining_days: { gt: 0 },
      expiry_date: {
        gte: new Date(new Date().setHours(0,0,0,0)),
        lte: thresholdDate
      }
    };

    // Apply shared employee filters to all queries
    if (Object.keys(employeeFilter).length > 0) {
      onLeaveWhere.employee = employeeFilter;
      // For pending/cancellations, merge with existing employee filter if any (supervisor case)
      if (pendingWhere.employee?.employments) {
         pendingWhere.employee = { 
           ...employeeFilter, 
           employments: { 
             some: { 
               ...employeeFilter.employments.some,
               manager_id: employeeId
             } 
           } 
         };
      } else {
        pendingWhere.employee = employeeFilter;
      }

      if (cancellationsWhere.employee?.employments) {
         cancellationsWhere.employee = { 
           ...employeeFilter, 
           employments: { 
             some: { 
               ...employeeFilter.employments.some,
               manager_id: employeeId
             } 
           } 
         };
      } else {
        cancellationsWhere.employee = employeeFilter;
      }

      cashOutWhere.employee = employeeFilter;
      expiringWhere.employee = employeeFilter;
    }
    
    if (leaveTypeId) {
      const lid = Number(leaveTypeId);
      onLeaveWhere.leave_type_id = lid;
      pendingWhere.leave_type_id = lid;
      cancellationsWhere.leave_type_id = lid;
      cashOutWhere.leave_type_id = lid;
      expiringWhere.leave_type_id = lid;
    }

    const [on_leave, pending, cancellations, cash_out, expiring] = await Promise.all([
      prisma.leaveApplication.count({ where: onLeaveWhere }),
      prisma.leaveApplication.count({ where: pendingWhere }),
      prisma.leaveApplication.count({ where: cancellationsWhere }),
      prisma.leaveCashOut.count({ where: cashOutWhere }),
      prisma.leaveBalance.count({ where: expiringWhere }),
    ]);

    res.status(200).json({
      status: "success",
      data: {
        on_leave,
        pending,
        cancellations,
        cash_out,
        expiring,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get leave statistics (e.g., total approved, pending, etc.)
 */
export const getLeaveStats = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    const stats = await getLeaveStatistics(companyId);

    res.status(200).json({
      status: "success",
      message: "Leave statistics fetched successfully",
      data: { stats },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get relief officers (employees who can cover during leave)
 */
export const getReliefOfficers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;

    if (!companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID not found in user session",
      });
    }

    // Get employees from the same department (excluding self)
    const currentEmployee = await prisma.employee.findUnique({
      where: {
        id_company_id: {
          id: employeeId || "",
          company_id: companyId,
        },
      },
      include: {
        employments: {
          where: { is_active: true },
          select: { department_id: true },
          take: 1,
        },
      },
    });

    const departmentId = currentEmployee?.employments[0]?.department_id;

    const where: any = {
      company_id: companyId,
      id: { not: employeeId },
      employments: {
        some: {
          is_active: true,
          ...(departmentId && { department_id: departmentId }),
        },
      },
    };

    const employees = await prisma.employee.findMany({
      where,
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
      orderBy: { full_name: "asc" },
    });

    res.status(200).json({
      status: "success",
      message: "Relief officers fetched successfully",
      data: { employees },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request leave cancellation (mid-leave)
 */
export const requestLeaveCancellation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { requested_return_date, reason } = req.body;
    const companyId = req.user?.company_id;
    const employeeId = req.user?.employee_id;

    if (!companyId || !employeeId) {
      return res.status(400).json({
        status: "fail",
        message: "Company ID or Employee ID not found in user session",
      });
    }

    const applicationId = Number(id);
    const application = await prisma.leaveApplication.findFirst({
      where: { id: applicationId, company_id: companyId, employee_id: employeeId },
      include: {
        employee: {
          include: {
            employments: { where: { is_active: true }, take: 1 }
          }
        }
      }
    });

    if (!application) {
      return res.status(404).json({ status: "fail", message: "Leave application not found" });
    }

    if (application.current_status !== "APPROVED") {
      return res.status(400).json({ status: "fail", message: "Only approved leave can be cancelled" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(application.start_date);
    const endDate = new Date(application.end_date);
    const returnDateObj = new Date(requested_return_date);

    if (returnDateObj < today || returnDateObj > endDate) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Requested return date must be between today and the original end date" 
      });
    }

    // Determine initial cancellation strategy (Manager -> HR)
    const employment = application.employee.employments[0];
    const initialStatus = employment?.manager_id ? "PENDING_SUPERVISOR" : "PENDING_HR";

    await prisma.leaveApplication.update({
      where: { id: applicationId },
      data: {
        cancellation_status: initialStatus,
        requested_return_date: returnDateObj,
        cancellation_reason: reason,
        updated_at: new Date(),
      } as any,
    });

    // Notify manager/HR
    notifyLeaveCancellationRequested(application).catch(console.error);

    // Invalidate Cache
    redisService.delByPattern(`company:${companyId}:leave_list:*`).catch(console.error);
    redisService.delByPattern(`company:${companyId}:leave_my:*`).catch(console.error);

    const updatedWithIncludes = await prisma.leaveApplication.findUnique({
      where: { id: applicationId },
      include: {
        leaveType: true,
        employee: {
          include: {
            employments: {
              include: {
                manager: true
              }
            }
          }
        },
        reliefOfficer: true,
        approvalLogs: {
          include: {
            approver: true
          },
          orderBy: {
            action_date: 'desc'
          }
        }
      }
    });

    res.status(200).json({
      status: "success",
      message: "Leave cancellation request submitted successfully",
      data: { application: updatedWithIncludes },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve leave cancellation request
 */
export const approveLeaveCancellation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;
    const companyId = req.user?.company_id;
    const approverId = req.user?.employee_id;
    const userRole = req.user?.role;

    const applicationId = Number(id);
    const application = await prisma.leaveApplication.findFirst({
      where: { id: applicationId, company_id: companyId },
      include: {
        employee: {
          include: {
            employments: { where: { is_active: true }, take: 1 }
          }
        }
      }
    });

    if (!application || !(application as any).cancellation_status) {
      return res.status(404).json({ status: "fail", message: "Cancellation request not found" });
    }

    const currentCanStatus = (application as any).cancellation_status;
    const employment = application.employee.employments[0];
    const isAdmin = userRole === RoleNames.ADMIN;

    let nextStatus: string;

    if (currentCanStatus === "PENDING_SUPERVISOR") {
      if (!isAdmin && employment?.manager_id !== approverId) {
        return res.status(403).json({ status: "fail", message: "Not authorized to approve this cancellation" });
      }
      nextStatus = "PENDING_HR";
    } else if (currentCanStatus === "PENDING_HR") {
      if (userRole !== RoleNames.HR && !isAdmin) {
        return res.status(403).json({ status: "fail", message: "Only HR can approve at this stage" });
      }
      nextStatus = "APPROVED";
    } else {
      return res.status(400).json({ status: "fail", message: "Invalid cancellation status for approval" });
    }

    if (nextStatus === "APPROVED") {
      // FINAL APPROVAL: Update the application and balance
      const requestedReturnDate = new Date((application as any).requested_return_date!);
      const newEndDate = new Date(requestedReturnDate);
      newEndDate.setDate(newEndDate.getDate() - 1); // End date is the day before they return
      const startDate = new Date(application.start_date);
      
      const actualRequestedDays = await calculateWorkingDays(startDate, newEndDate, companyId!);
      const daysToRestore = Math.max(0, Number(application.requested_days) - actualRequestedDays);
      
      const appFiscalYear = await getFiscalYear(companyId!, application.start_date);

      await prisma.$transaction([
        prisma.leaveApplication.update({
          where: { id: applicationId },
          data: {
            current_status: "CANCELLED",
            cancellation_status: "APPROVED",
            end_date: newEndDate,
            requested_days: actualRequestedDays,
            updated_at: new Date(),
          } as any,
        }),
        prisma.leaveBalance.updateMany({
          where: {
            employee_id: application.employee_id,
            leave_type_id: application.leave_type_id,
            fiscal_year: appFiscalYear,
          },
          data: {
            used_days: { decrement: daysToRestore },
            remaining_days: { increment: daysToRestore },
          },
        }),
        prisma.leaveApprovalLog.create({
          data: {
            application_id: applicationId,
            approver_id: approverId!,
            approver_company_id: companyId!,
            approver_role: isAdmin ? "Admin" : (userRole === RoleNames.HR ? "HR" : "Supervisor"),
            action: "CANCEL_APPROVED",
            comments: comments || "Cancellation approved",
          }
        })
      ]);
    } else {
      await prisma.leaveApplication.update({
        where: { id: applicationId },
        data: { cancellation_status: nextStatus } as any,
      });
      
      await prisma.leaveApprovalLog.create({
        data: {
          application_id: applicationId,
          approver_id: approverId!,
          approver_company_id: companyId!,
          approver_role: isAdmin ? "Admin" : "Supervisor",
          action: "CANCEL_SIGNED",
          comments: comments || "Cancellation signed",
        }
      });
    }

    // Get approver name for notification
    const approver = await prisma.employee.findUnique({ where: { id: approverId! }, select: { full_name: true } });
    notifyLeaveCancellationApproved(application, approver?.full_name || "Approver", nextStatus === "APPROVED").catch(console.error);

    redisService.delByPattern(`company:${companyId}:*`).catch(console.error);

    res.status(200).json({
      status: "success",
      message: nextStatus === "APPROVED" ? "Leave cancellation fully approved" : "Leave cancellation approved and moved to HR",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject leave cancellation request
 */
export const rejectLeaveCancellation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const companyId = req.user?.company_id;
    const approverId = req.user?.employee_id;

    const applicationId = Number(id);
    await prisma.$transaction([
      prisma.leaveApplication.update({
        where: { id: applicationId, company_id: companyId },
        data: {
          cancellation_status: "REJECTED",
          updated_at: new Date(),
        } as any,
      }),
      prisma.leaveApprovalLog.create({
        data: {
          application_id: applicationId,
          approver_id: approverId!,
          approver_company_id: companyId!,
          approver_role: "Approver",
          action: "CANCEL_REJECTED",
          comments: reason || "Cancellation rejected",
        }
      })
    ]);

    // Notify employee
    const approver = await prisma.employee.findUnique({ where: { id: approverId! }, select: { full_name: true } });
    const application = await prisma.leaveApplication.findUnique({ where: { id: applicationId } });
    if (application) {
      notifyLeaveCancellationRejected(application, approver?.full_name || "Approver", reason || "No reason provided").catch(console.error);
    }

    redisService.delByPattern(`company:${companyId}:*`).catch(console.error);

    res.status(200).json({ status: "success", message: "Leave cancellation rejected" });
  } catch (error) {
    next(error);
  }
};
