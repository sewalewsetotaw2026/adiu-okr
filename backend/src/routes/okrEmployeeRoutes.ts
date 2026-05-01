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
  bulkSubmitEmployeePlanning,
  bulkPublishEmployeePlanning,
  selectExecutionMode,
  createEmployeeMonthPlan,
  createEmployeeKRMonthPlan,
  updateEmployeeMonthPlan,
  deleteEmployeeMonthPlan,
  listEmployeeMonthPlans,
  listEmployeeKRMonthPlans,
  addMonthPlanItem,
  removeMonthPlanItem,
  createWeeklyPlan,
  createWeeklyPlans,
  updateWeeklyPlan,
  deleteWeeklyPlan,
  listWeeklyPlans,
  createSubtask,
  updateSubtask,
  deleteSubtask,
  listSubtasks,
  createDailyPlan,
  createDailyPlans,
  updateDailyPlan,
  deleteDailyPlan,
  listDailyPlans,
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
router.patch("/bulk-submit-plans", bulkSubmitEmployeePlanning);
router.patch("/bulk-publish-plans", bulkPublishEmployeePlanning);

// ─── Employee Key Results ─────────────────────────────────────────────────────
router.post("/objectives/:id/key-results", createEmployeeKR);
router.get("/objectives/:id/key-results", listEmployeeKRs);
router.put("/key-results/:id", updateEmployeeKR);
router.delete("/key-results/:id", deleteEmployeeKR);
router.patch("/key-results/:id/submit", submitEmployeeKeyResult);
router.patch("/key-results/:id/publish", publishEmployeeKeyResult);
router.patch("/key-results/:id/execution-mode", selectExecutionMode);
router.post("/key-results/:id/month-plans", createEmployeeKRMonthPlan);
router.get("/key-results/:id/month-plans", listEmployeeKRMonthPlans);

// ─── Employee Month Plans ─────────────────────────────────────────────────────
router.post("/objectives/:id/month-plans", createEmployeeMonthPlan);
router.get("/objectives/:id/month-plans", listEmployeeMonthPlans);
router.put("/month-plans/:id", updateEmployeeMonthPlan);
router.delete("/month-plans/:id", deleteEmployeeMonthPlan);
router.post("/month-plans/:id/items", addMonthPlanItem);
router.delete("/month-plans/:id/items/:itemId", removeMonthPlanItem);

// ─── Weekly Plans ─────────────────────────────────────────────────────────────
router.post("/key-results/:id/weekly-plans", createWeeklyPlan);
router.get("/key-results/:id/weekly-plans", listWeeklyPlans);
router.post("/month-plans/:id/weekly-plans", createWeeklyPlans);
router.put("/weekly-plans/:id", updateWeeklyPlan);
router.delete("/weekly-plans/:id", deleteWeeklyPlan);

// ─── Subtasks ─────────────────────────────────────────────────────────────────
router.post("/key-results/:id/subtasks", createSubtask);
router.get("/key-results/:id/subtasks", listSubtasks);
router.put("/subtasks/:id", updateSubtask);
router.delete("/subtasks/:id", deleteSubtask);

// ─── Daily Plans ───────────────────────────────────────────────────────────────
router.post("/weekly-plans/batch/daily-plans", createDailyPlans);
router.post("/weekly-plans/:id/daily-plans", createDailyPlan);
router.get("/weekly-plans/:id/daily-plans", listDailyPlans);
router.put("/daily-plans/:id", updateDailyPlan);
router.patch("/daily-plans/:id", updateDailyPlan);
router.delete("/daily-plans/:id", deleteDailyPlan);

// ─── Progress Updates ─────────────────────────────────────────────────────────
router.post("/key-results/:id/progress", submitProgressUpdate);
router.get("/key-results/:id/progress", listProgressHistory);

export default router;
