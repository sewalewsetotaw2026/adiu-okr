import { Request, Response, NextFunction } from "express";
import {
  isManager,
  getTeamMembers,
  getTeamMemberDetails,
  getTeamLeaveApplications,
  getTeamOnLeaveToday,
} from "../services/managerService";

/**
 * Check if current user is a manager
 */
export const checkIsManager = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const employeeId = req.user?.employee_id;
    const companyId = req.user?.company_id;

    if (!employeeId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID or Company ID not found",
      });
    }

    const managerStatus = await isManager(employeeId, companyId);

    res.status(200).json({
      status: "success",
      message: "Manager status checked successfully",
      data: { isManager: managerStatus },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get manager's team members
 */
export const getMyTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const employeeId = req.user?.employee_id;
    const companyId = req.user?.company_id;

    if (!employeeId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Employee ID or Company ID not found",
      });
    }

    /* Redundant check - verifyAccessControl handles this */
    // const managerStatus = await isManager(employeeId, companyId);
    // if (!managerStatus) { ... }

    const recursive = req.query.recursive === "true";
    const teamMembers = await getTeamMembers(employeeId, companyId, recursive);

    res.status(200).json({
      status: "success",
      message: "Team members fetched successfully",
      data: { teamMembers, count: teamMembers.length },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get team member details
 */
export const getTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { employeeId: targetEmployeeId } = req.params;
    const managerId = req.user?.employee_id;
    const companyId = req.user?.company_id;

    if (!managerId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Manager ID or Company ID not found",
      });
    }

    const employeeDetails = await getTeamMemberDetails(
      managerId,
      targetEmployeeId,
      companyId
    );

    const { filterEmployeeSensitiveData } = require("../utils/permissionUtils");
    const filteredEmployee = await filterEmployeeSensitiveData(req.user, employeeDetails);

    res.status(200).json({
      status: "success",
      message: "Team member details fetched successfully",
      data: { employee: filteredEmployee },
    });
  } catch (error: any) {
    if (error.message === "Employee not found in your team") {
      return res.status(404).json({
        status: "fail",
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Get team's leave applications
 */
export const getMyTeamLeaveApplications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const managerId = req.user?.employee_id;
    const companyId = req.user?.company_id;

    if (!managerId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Manager ID or Company ID not found",
      });
    }

    /* Redundant check - verifyAccessControl handles this */
    // const managerStatus = await isManager(managerId, companyId);
    // if (!managerStatus) {
    //   return res.status(403).json({
    //     status: "fail",
    //     message: "You are not a manager",
    //   });
    // }

    const status = req.query.status as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = req.query.sortBy as string;
    const order = (req.query.order as "asc" | "desc") || "desc";
    const start_date = req.query.start_date as string;
    const end_date = req.query.end_date as string;

    const result = await getTeamLeaveApplications(managerId, companyId, {
      status,
      page,
      limit,
      sortBy,
      order,
      start_date,
      end_date,
    });

    res.status(200).json({
      status: "success",
      message: "Team leave applications fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get team members on leave today
 */
export const getMyTeamOnLeaveToday = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const managerId = req.user?.employee_id;
    const companyId = req.user?.company_id;

    if (!managerId || !companyId) {
      return res.status(400).json({
        status: "fail",
        message: "Manager ID or Company ID not found",
      });
    }

    /* Redundant check - verifyAccessControl handles this */
    // const managerStatus = await isManager(managerId, companyId);
    // if (!managerStatus) {
    //   return res.status(403).json({
    //     status: "fail",
    //     message: "You are not a manager",
    //   });
    // }

    // Extract filters
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      search: req.query.search as string,
      department_id: req.query.department_id as string,
      leave_type_id: req.query.leave_type_id as string,
      start_date: req.query.start_date as string
    };

    const result = await getTeamOnLeaveToday(managerId, companyId, filters);

    res.status(200).json({
      status: "success",
      message: "Team members on leave today fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
