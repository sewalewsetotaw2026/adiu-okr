import express from "express";
import {
  getAllLeaveApplications,
  getMyLeaveApplications,
  getPendingLeaveApplications,
  getLeaveApplicationById,
  createLeaveApplication,
  approveLeaveApplication,
  rejectLeaveApplication,
  cancelLeaveApplication,
  getCancellableLeaves,
  getEmployeesOnLeave,
  getLeaveStats,
  getReliefOfficers,
  requestLeaveCancellation,
  approveLeaveCancellation,
  rejectLeaveCancellation,
  getPendingLeaveCancellations,
  getLeaveManagementTabCounts,
} from "src/controllers/leaveApplicationController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

import { cacheMiddleware } from "src/middleware/cacheMiddleware";

const router = express.Router();

// Protect all routes
router.use(protect);

// Employee routes (own data)
router.get(
  "/me",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_OWN),
  cacheMiddleware("leave_my", 1800,true),
  getMyLeaveApplications
);

// Alias for /me - frontend compatibility
router.get(
  "/my-applications",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_OWN),
  cacheMiddleware("leave_my", 1800,true),
  getMyLeaveApplications
);

router.get(
  "/cancellable",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_OWN),
  getCancellableLeaves
);

router.get(
  "/relief-officers",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_OWN),
  getReliefOfficers
);

router.post(
  "/",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.CREATE_OWN),
  createLeaveApplication
);

router.post(
  "/:id/cancel",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.UPDATE_OWN),
  cancelLeaveApplication
);

router.post(
  "/:id/request-cancellation",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.UPDATE_OWN),
  requestLeaveCancellation
);

// Admin/HR/Manager routes
router.get(
  "/",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_ANY),
  cacheMiddleware("leave_list", 1800,true),
  getAllLeaveApplications
);

router.get(
  "/pending",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_ANY),
  getPendingLeaveApplications
);

router.get(
  "/pending-cancellations",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_ANY),
  getPendingLeaveCancellations
);

router.get(
  "/on-leave",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_OWN),
  getEmployeesOnLeave
);

router.get(
  "/tab-counts",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_ANY),
  getLeaveManagementTabCounts
);

router.get(
  "/stats",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_ANY),
  cacheMiddleware("leave_stats", 1800,true),
  getLeaveStats
);

// Alias for /stats - frontend compatibility
router.get(
  "/statistics",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_ANY),
  cacheMiddleware("leave_stats", 1800,true),
  getLeaveStats
);

router.get(
  "/:id",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.READ_ANY),
  getLeaveApplicationById
);

router.post(
  "/:id/approve",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.UPDATE_TEAM),
  approveLeaveApplication
);

router.post(
  "/:id/reject",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.UPDATE_TEAM),
  rejectLeaveApplication
);

router.post(
  "/:id/approve-cancellation",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.UPDATE_TEAM),
  approveLeaveCancellation
);

router.post(
  "/:id/reject-cancellation",
  verifyAccessControl(Resources.LEAVE_APPLICATION, ActionTypes.UPDATE_TEAM),
  rejectLeaveCancellation
);

export default router;

