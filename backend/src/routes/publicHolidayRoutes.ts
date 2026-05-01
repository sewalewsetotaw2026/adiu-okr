import express from "express";
import {
  getAllPublicHolidays,
  getPublicHolidayById,
  createPublicHoliday,
  updatePublicHoliday,
  deletePublicHoliday,
  seedDefaultHolidays,
  getUpcomingHolidays,
} from "src/controllers/publicHolidayController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// Protect all routes
router.use(protect);

// Employee accessible routes
router.get(
  "/",
  verifyAccessControl(Resources.PUBLIC_HOLIDAY, ActionTypes.READ_OWN),
  getAllPublicHolidays
);

router.get(
  "/upcoming",
  verifyAccessControl(Resources.PUBLIC_HOLIDAY, ActionTypes.READ_OWN),
  getUpcomingHolidays
);

router.get(
  "/:id",
  verifyAccessControl(Resources.PUBLIC_HOLIDAY, ActionTypes.READ_OWN),
  getPublicHolidayById
);

// Admin only routes
router.post(
  "/",
  verifyAccessControl(Resources.PUBLIC_HOLIDAY, ActionTypes.CREATE_ANY),
  createPublicHoliday
);

router.post(
  "/seed-defaults",
  verifyAccessControl(Resources.PUBLIC_HOLIDAY, ActionTypes.CREATE_ANY),
  seedDefaultHolidays
);

router.put(
  "/:id",
  verifyAccessControl(Resources.PUBLIC_HOLIDAY, ActionTypes.UPDATE_ANY),
  updatePublicHoliday
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.PUBLIC_HOLIDAY, ActionTypes.DELETE_ANY),
  deletePublicHoliday
);

export default router;

