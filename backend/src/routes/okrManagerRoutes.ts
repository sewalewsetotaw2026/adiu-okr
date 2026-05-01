import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  getTeamExecutionSummary,
  listSubordinatePositions,
  listPendingApprovals,
  listPendingEmployeeObjectives,
  listPendingEmployeeKeyResults,
  processApprovalAction,
  bulkApprovalAction,
  getPlanningComplianceReport,
} from "src/controllers/okrManagerController";

const router = express.Router();

router.use(protect);

router.get("/team-summary", getTeamExecutionSummary);
router.get("/subordinate-positions", listSubordinatePositions);
router.get("/pending-approvals", listPendingApprovals);
router.get("/pending-employee-objectives", listPendingEmployeeObjectives);
router.get("/pending-employee-key-results", listPendingEmployeeKeyResults);
router.get("/planning-compliance", getPlanningComplianceReport);
router.post("/approve", processApprovalAction);
router.post("/bulk-approve", bulkApprovalAction);

export default router;
