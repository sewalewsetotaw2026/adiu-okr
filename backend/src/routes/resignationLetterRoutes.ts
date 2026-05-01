import { Router } from "express";
import { protect } from "src/middleware/authMiddleware";
import { generateResignationLetter } from "src/controllers/resignationLetterController";

import { ActionTypes, Resources } from "src/utils/constants";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";

const router = Router();

// Protect all routes
router.use(protect);

/**
 * GET /api/v1/resignation-letter/:id
 * Generate Resignation Letter PDF for an employee
 *
 * This is a formal document confirming the employee's resignation,
 * employment period, and other relevant details.
 */
router.get(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_RESIGNATION, ActionTypes.READ_OWN),
  generateResignationLetter
);

export default router;
