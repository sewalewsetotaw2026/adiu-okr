import express from "express";
import {
  getLeaveSettings,
  upsertLeaveSettings,
  getLeaveSettingsVersion,
} from "src/controllers/leaveSettingsController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// Protect all routes
router.use(protect);

// Get settings (readable by anyone with read access)
router.get(
  "/",
  verifyAccessControl(Resources.LEAVE_SETTINGS, ActionTypes.READ_ANY),
  getLeaveSettings
);

// Get settings version info (for audit)
router.get(
  "/version",
  verifyAccessControl(Resources.LEAVE_SETTINGS, ActionTypes.READ_ANY),
  getLeaveSettingsVersion
);

// Update settings (admin only)
router.put(
  "/",
  verifyAccessControl(Resources.LEAVE_SETTINGS, ActionTypes.UPDATE_ANY),
  upsertLeaveSettings
);

router.post(
  "/",
  verifyAccessControl(Resources.LEAVE_SETTINGS, ActionTypes.CREATE_ANY),
  upsertLeaveSettings
);

export default router;
