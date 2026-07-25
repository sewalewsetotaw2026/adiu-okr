import { Router } from "express";
import * as employeeSettingsController from "../controllers/employeeSettingsController";
import { protect, restrictTo } from "../middleware/authMiddleware";

const router = Router();

// All routes are protected
router.use(protect);

router
  .route("/")
  .get(employeeSettingsController.getEmployeeSettings)
  .patch(
    restrictTo("Admin", "ADMIN", "Super Admin"),
    employeeSettingsController.updateEmployeeSettings,
  );

router.post(
  "/run-pension-check",
  restrictTo("Admin", "ADMIN", "Super Admin"),
  employeeSettingsController.runPensionCheck,
);

export default router;
