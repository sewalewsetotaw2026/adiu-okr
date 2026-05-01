import express from "express";
import {
  calculateCashOutValue,
  requestCashOut,
  getMyCashOutRequests,
  getAllCashOutRequests,
  approveCashOut,
  rejectCashOut,
} from "src/controllers/leaveCashOutController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// Protect all routes
router.use(protect);

// Employee routes (own data)
router.get(
  "/calculate",
  verifyAccessControl(Resources.LEAVE_CASH_OUT, ActionTypes.READ_OWN),
  calculateCashOutValue
);

router.post(
  "/request",
  verifyAccessControl(Resources.LEAVE_CASH_OUT, ActionTypes.CREATE_OWN),
  requestCashOut
);

router.get(
  "/my-requests",
  verifyAccessControl(Resources.LEAVE_CASH_OUT, ActionTypes.READ_OWN),
  getMyCashOutRequests
);

// Admin/HR routes
router.get(
  "/",
  verifyAccessControl(Resources.LEAVE_CASH_OUT, ActionTypes.READ_ANY),
  getAllCashOutRequests
);

router.put(
  "/:id/approve",
  verifyAccessControl(Resources.LEAVE_CASH_OUT, ActionTypes.UPDATE_ANY),
  approveCashOut
);

router.put(
  "/:id/reject",
  verifyAccessControl(Resources.LEAVE_CASH_OUT, ActionTypes.UPDATE_ANY),
  rejectCashOut
);

export default router;
