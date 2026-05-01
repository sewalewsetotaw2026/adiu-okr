import express from "express";
import {
  fetchAllHistory,
  fetchHistory,
  createHistory,
  bulkCreateHistory,
  updateHistory,
  deleteHistory,
  bulkDeleteHistory,
} from "src/controllers/employmentHistoryController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

router.use(protect);

router.get(
  "/employee/:employeeId",
  verifyAccessControl(Resources.EMPLOYEE_EXPERIENCE, ActionTypes.READ_OWN),
  fetchAllHistory,
);
router.get(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_EXPERIENCE, ActionTypes.READ_OWN),
  fetchHistory,
);
router.post(
  "/",
  verifyAccessControl(Resources.EMPLOYEE_EXPERIENCE, ActionTypes.CREATE_OWN),
  createHistory,
);
router.post(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE_EXPERIENCE, ActionTypes.CREATE_ANY),
  bulkCreateHistory,
);
router.put(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_EXPERIENCE, ActionTypes.UPDATE_OWN),
  updateHistory,
);
router.delete(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE_EXPERIENCE, ActionTypes.DELETE_ANY),
  bulkDeleteHistory,
);
router.delete(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_EXPERIENCE, ActionTypes.DELETE_OWN),
  deleteHistory,
);

export default router;
