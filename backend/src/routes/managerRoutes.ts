import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import {
  checkIsManager,
  getMyTeam,
  getTeamMember,
  getMyTeamLeaveApplications,
  getMyTeamOnLeaveToday,
} from "../controllers/managerController";

import { ActionTypes, Resources } from "src/utils/constants";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { cacheMiddleware } from "src/middleware/cacheMiddleware";

const router = Router();

// Apply authentication middleware to all routes
router.use(protect);

// Check if current user is a manager
router.get("/is-manager", checkIsManager);

// Get manager's team members
router.get(
  "/team",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_TEAM),
  cacheMiddleware("teams", 3600,true),
  getMyTeam
);

// Get specific team member details
router.get(
  "/team/:employeeId",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_TEAM),
  cacheMiddleware("team_member", 3600,true),
  getTeamMember
);

// Get team's leave applications
router.get(
  "/leave-applications",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_TEAM),
  cacheMiddleware("team_leave", 1800,true),
  getMyTeamLeaveApplications
);

// Get team members on leave today
router.get(
  "/on-leave-today",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_TEAM),
  cacheMiddleware("team_on_leave_today", 1800,true),
  getMyTeamOnLeaveToday
);

export default router;
