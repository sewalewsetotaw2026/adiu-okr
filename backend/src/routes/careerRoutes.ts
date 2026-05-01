/**
 * Career Routes for Kacha HRIS
 * 
 * Routes for employee promotions, demotions, and transfers.
 */

import { Router } from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  promoteEmployee,
  demoteEmployee,
  transferEmployee,
  getEmployeeCareerEvents,
  getAllCareerEvents,
} from "src/controllers/careerController";

import { ActionTypes, Resources } from "src/utils/constants";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";

const router = Router();

// All routes require authentication
router.use(protect);

/**
 * POST /api/v1/career/promote
 * Promote an employee to a new position with salary increase
 */
router.post(
  "/promote",
  verifyAccessControl(Resources.CAREER_EVENT, ActionTypes.CREATE_ANY),
  promoteEmployee
);

/**
 * POST /api/v1/career/demote
 * Demote an employee to a lower position
 */
router.post(
  "/demote",
  verifyAccessControl(Resources.CAREER_EVENT, ActionTypes.CREATE_ANY),
  demoteEmployee
);

/**
 * POST /api/v1/career/transfer
 * Transfer an employee to a different department
 */
router.post(
  "/transfer",
  verifyAccessControl(Resources.CAREER_EVENT, ActionTypes.CREATE_ANY),
  transferEmployee
);

/**
 * GET /api/v1/career/events/:employeeId
 * Get career history for a specific employee
 */
router.get(
  "/events/:employeeId",
  verifyAccessControl(Resources.CAREER_EVENT, ActionTypes.READ_OWN),
  getEmployeeCareerEvents
);

/**
 * GET /api/v1/career/events
 * Get all career events with pagination and filters
 */
router.get(
  "/events",
  verifyAccessControl(Resources.CAREER_EVENT, ActionTypes.READ_ANY),
  getAllCareerEvents
);

export default router;
