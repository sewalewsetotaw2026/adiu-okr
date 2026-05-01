import { Router } from "express";
import * as employeeSettingsController from "../controllers/employeeSettingsController";
import { protect, restrictTo } from "../middleware/authMiddleware";
import { verifyAccessControl } from "../middleware/verifyAccessControl";
import { Resources, ActionTypes } from "../utils/constants";

const router = Router();

// All routes are protected
router.use(protect);

router
  .route("/")
  .get(verifyAccessControl(Resources.EMPLOYEE_SETTINGS, ActionTypes.READ_ANY), employeeSettingsController.getEmployeeSettings)
  .patch(verifyAccessControl(Resources.EMPLOYEE_SETTINGS, ActionTypes.UPDATE_ANY), employeeSettingsController.updateEmployeeSettings);

router.post(
  "/run-pension-check",
  restrictTo("Admin", "ADMIN", "Super Admin"),
  employeeSettingsController.runPensionCheck,
);

export default router;
