import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  adoptAssignedKR,
  listAssignedKRs,
  listEmployeeObjectives,
  getEmployeeObjectiveDetail,
  publishEmployeeObjective,
  submitEmployeeObjective,
  createEmployeeKR,
  updateEmployeeKR,
  deleteEmployeeKR,
  listEmployeeKRs,
  publishEmployeeKeyResult,
  submitEmployeeKeyResult,
  bulkSubmitEmployee,
  bulkPublishEmployee,
  selectExecutionMode,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  listSubtasks,
  submitProgressUpdate,
  listProgressHistory,
} from "src/controllers/okrEmployeeController";

const router = express.Router();

router.use(protect);

router.param("id", (req, res, next, id) => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return res
      .status(400)
      .json({ status: "fail", message: "id must be a positive integer." });
  }
  next();
});

// ─── Employee Objectives ──────────────────────────────────────────────────────
router.get("/assigned-krs", listAssignedKRs);
router.post("/objectives/adopt-assigned-kr", adoptAssignedKR);
router.get("/objectives", listEmployeeObjectives);
router.get("/objectives/:id", getEmployeeObjectiveDetail);
router.patch("/objectives/:id/submit", submitEmployeeObjective);
router.patch("/objectives/:id/publish", publishEmployeeObjective);

// ─── Bulk Actions ─────────────────────────────────────────────────────────────
router.patch("/bulk-submit", bulkSubmitEmployee);
router.patch("/bulk-publish", bulkPublishEmployee);
// /bulk-submit-plans and /bulk-publish-plans removed in the OKR Planning Overhaul.
// Period-level approval lives at:
//   POST /api/v1/okr/monthly-plans/submit-period
//   POST /api/v1/okr/weekly-plans/submit-period

// ─── Employee Key Results ─────────────────────────────────────────────────────
router.post("/objectives/:id/key-results", createEmployeeKR);
router.get("/objectives/:id/key-results", listEmployeeKRs);
router.put("/key-results/:id", updateEmployeeKR);
router.delete("/key-results/:id", deleteEmployeeKR);
router.patch("/key-results/:id/submit", submitEmployeeKeyResult);
router.patch("/key-results/:id/publish", publishEmployeeKeyResult);
router.patch("/key-results/:id/execution-mode", selectExecutionMode);

// ─── Legacy planning endpoints REMOVED ────────────────────────────────────
// The following endpoints were removed in the OKR Planning Overhaul (Phase 8):
//   POST /okr/employee/objectives/:id/month-plans (wrong parent: Objective)
//   POST /okr/employee/key-results/:id/weekly-plans (wrong parent: KR)
//   POST /okr/employee/month-plans/:id/items
//   GET/PUT/DELETE /okr/employee/month-plans, weekly-plans, daily-plans
// Use the corrected routes mounted under /api/v1/okr (see okrPlanningRoutes).

// ─── Subtasks ──────────────────────────────────────────────────────────────────────
router.post("/key-results/:id/subtasks", createSubtask);
router.get("/key-results/:id/subtasks", listSubtasks);
router.put("/subtasks/:id", updateSubtask);
router.delete("/subtasks/:id", deleteSubtask);

// ─── Progress Updates ─────────────────────────────────────────────────────────
router.post("/key-results/:id/progress", submitProgressUpdate);
router.get("/key-results/:id/progress", listProgressHistory);

export default router;
