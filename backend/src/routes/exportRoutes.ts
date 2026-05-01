/**
 * Export Routes for Kacha HRIS
 */

import { Router } from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  getAvailableFields,
  exportEmployees,
  exportEmployments,
  exportEmployeeProfile,
  exportLeaves,
  exportLeaveBalances,
  exportOnLeaveEmployees,
} from "src/controllers/exportController";

const router = Router();

// All routes require authentication
router.use(protect);

/**
 * GET /api/v1/export/fields
 * Get available fields for export
 * Query: type=employee|employment|leave|leave_balance|on_leave
 */
router.get("/fields", getAvailableFields);

/**
 * POST /api/v1/export/employees
 * Export employee list with selected fields
 * Body: { format: "pdf|csv|xlsx", fields: string[], filters?: object }
 */
router.post("/employees", exportEmployees);

/**
 * POST /api/v1/export/employments
 * Export employment list with selected fields
 * Body: { format: "pdf|csv|xlsx", fields: string[], filters?: object }
 */
router.post("/employments", exportEmployments);

/**
 * POST /api/v1/export/employee/:id
 * Export single employee profile
 * Body: { format: "pdf|csv|xlsx", sections?: string[] }
 */
router.post("/employee/:id", exportEmployeeProfile);

/**
 * POST /api/v1/export/leaves
 * Export leave applications with selected fields
 * Body: { format: "pdf|csv|xlsx", fields: string[], filters?: object }
 */
router.post("/leaves", exportLeaves);

/**
 * POST /api/v1/export/leave-balances
 * Export leave balances with selected fields
 * Body: { format: "pdf|csv|xlsx", fields: string[], filters?: object }
 */
router.post("/leave-balances", exportLeaveBalances);

/**
 * POST /api/v1/export/on-leave
 * Export currently on-leave employees with selected fields
 * Body: { format: "pdf|csv|xlsx", fields: string[], filters?: object }
 */
router.post("/on-leave", exportOnLeaveEmployees);

export default router;

