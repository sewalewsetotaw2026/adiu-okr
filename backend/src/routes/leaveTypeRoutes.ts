import express from "express";
import {
  getAllLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  seedDefaultLeaveTypes,
  getApplicableLeaveTypes,
} from "src/controllers/leaveTypeController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// Protect all routes
router.use(protect);

// Employee accessible routes
router.get(
  "/",
  verifyAccessControl(Resources.LEAVE_TYPE, ActionTypes.READ_ANY),
  getAllLeaveTypes
);

router.get(
  "/applicable",
  verifyAccessControl(Resources.LEAVE_TYPE, ActionTypes.READ_OWN),
  getApplicableLeaveTypes
);

router.get(
  "/:id",
  verifyAccessControl(Resources.LEAVE_TYPE, ActionTypes.READ_ANY),
  getLeaveTypeById
);

// Admin only routes
router.post(
  "/",
  verifyAccessControl(Resources.LEAVE_TYPE, ActionTypes.CREATE_ANY),
  createLeaveType
);

router.post(
  "/seed-defaults",
  verifyAccessControl(Resources.LEAVE_TYPE, ActionTypes.CREATE_ANY),
  seedDefaultLeaveTypes
);

router.put(
  "/:id",
  verifyAccessControl(Resources.LEAVE_TYPE, ActionTypes.UPDATE_ANY),
  updateLeaveType
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.LEAVE_TYPE, ActionTypes.DELETE_ANY),
  deleteLeaveType
);

export default router;

