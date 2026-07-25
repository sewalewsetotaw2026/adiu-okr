import express from "express";
import {
  getMyLeaveBalance,
  getEmployeeLeaveBalance,
  getAllEmployeesLeaveBalance,
  allocateLeaveForEmployee,
  bulkAllocateLeave,
  adjustLeaveBalance,
  getExpiringLeaveBalances,
  carryOverLeave,
  notifyExpiringLeaves,
} from "src/controllers/leaveBalanceController";
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
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.READ_OWN),
  cacheMiddleware("leave_balance_my", 3600,true),
  getMyLeaveBalance
);

// Alias for /me - frontend compatibility
router.get(
  "/my-balance",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.READ_OWN),
  cacheMiddleware("leave_balance_my", 3600,true),
  getMyLeaveBalance
);

// Admin/HR routes
router.get(
  "/",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.READ_ANY),
  cacheMiddleware("leave_balance_list", 3600,true),
  getAllEmployeesLeaveBalance
);

router.get(
  "/expiring",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.READ_ANY),
  getExpiringLeaveBalances
);

router.get(
  "/employee/:employeeId",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.READ_ANY),
  getEmployeeLeaveBalance
);

router.post(
  "/allocate/:employeeId",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.CREATE_ANY),
  allocateLeaveForEmployee
);

router.post(
  "/bulk-allocate",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.CREATE_ANY),
  bulkAllocateLeave
);

router.put(
  "/:id/adjust",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.UPDATE_ANY),
  adjustLeaveBalance
);

router.post(
  "/carry-over",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.UPDATE_ANY),
  carryOverLeave
);

router.post(
  "/notify-expiring",
  verifyAccessControl(Resources.LEAVE_BALANCE, ActionTypes.UPDATE_ANY),
  notifyExpiringLeaves
);

export default router;

