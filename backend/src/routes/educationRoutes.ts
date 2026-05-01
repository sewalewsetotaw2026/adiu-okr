import express from "express";
import {
  fetchAllEducations,
  fetchEducation,
  createEducation,
  bulkCreateEducations,
  updateEducation,
  deleteEducation,
  bulkDeleteEducations,
  replaceEmployeeEducations,
} from "src/controllers/educationController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

router.use(protect);

router.get(
  "/employee/:employeeId",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_ANY),
  fetchAllEducations,
);
router.get(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.READ_ANY),
  fetchEducation,
);
router.post(
  "/",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.CREATE_ANY),
  createEducation,
);
router.post(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.CREATE_ANY),
  bulkCreateEducations,
);
router.put(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  updateEducation,
);
router.put(
  "/employee/:id",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.UPDATE_ANY),
  replaceEmployeeEducations,
);
router.delete(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.DELETE_ANY),
  bulkDeleteEducations,
);
router.delete(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE, ActionTypes.DELETE_ANY),
  deleteEducation,
);

export default router;
