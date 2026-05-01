import express from "express";
import {
  getAllLeaveRecalls,
  getMyRecallNotifications,
  getEmployeesOnLeaveForRecall,
  createLeaveRecall,
  respondToRecall,
  getRecallById,
  cancelRecall,
} from "src/controllers/leaveRecallController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// Protect all routes
router.use(protect);

// Employee routes (own data)
router.get(
  "/me",
  verifyAccessControl(Resources.LEAVE_RECALL, ActionTypes.READ_OWN),
  getMyRecallNotifications
);

router.post(
  "/:id/respond",
  verifyAccessControl(Resources.LEAVE_RECALL, ActionTypes.UPDATE_OWN),
  respondToRecall
);

// Admin/HR/Manager routes
router.get(
  "/",
  verifyAccessControl(Resources.LEAVE_RECALL, ActionTypes.READ_TEAM),
  getAllLeaveRecalls
);

router.get(
  "/active-leaves",
  verifyAccessControl(Resources.LEAVE_RECALL, ActionTypes.READ_TEAM),
  getEmployeesOnLeaveForRecall
);

router.get(
  "/:id",
  verifyAccessControl(Resources.LEAVE_RECALL, ActionTypes.READ_TEAM),
  getRecallById
);

router.post(
  "/",
  verifyAccessControl(Resources.LEAVE_RECALL, ActionTypes.CREATE_TEAM),
  createLeaveRecall
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.LEAVE_RECALL, ActionTypes.DELETE_TEAM),
  cancelRecall
);

export default router;

