import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  listDepartmentObjectives,
  listPendingDepartmentObjectives,
  listPendingDepartmentKeyResults,
  createDepartmentObjective,
  getDepartmentObjectiveDetail,
  publishDepartmentObjective,
  createDepartmentKR,
  updateDepartmentKR,
  listDepartmentKRs,
  publishDepartmentKeyResult,
  submitDepartmentKeyResult,
  approveDepartmentKeyResult,
  createMonthPlan,
  listMonthPlans,
  adoptCompanyKR,
  createWeeklyPlan,
  listWeeklyPlans,
  createDepartmentDailyPlan,
  listDepartmentDailyPlans,
  updateDepartmentDailyPlan,
  deleteDepartmentDailyPlan,
  submitDepartmentObjective,
  approveDepartmentObjective,
  bulkSubmitDepartment,
  bulkApproveDepartment,
  listPendingDepartmentApprovals,
  bulkApproveDepartmentItems,
  approveDepartmentItem,
} from "src/controllers/okrDepartmentController";
import { restrictTo } from "src/middleware/authMiddleware";

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

router.get("/objectives", listDepartmentObjectives);
router.get(
  "/objectives/pending",
  // restrictTo("Admin", "HR", "SuperAdmin", "SUPERADMIN"),
  listPendingDepartmentObjectives,
);
router.get("/key-results/pending", listPendingDepartmentKeyResults);
router.post("/objectives", createDepartmentObjective); // Add this
router.post("/adopt-kr", adoptCompanyKR);
router.get("/objectives/:id", getDepartmentObjectiveDetail);
router.patch("/objectives/:id/publish", publishDepartmentObjective);
router.patch("/objectives/:id/submit", submitDepartmentObjective);
router.patch("/bulk-submit", bulkSubmitDepartment);
router.patch("/bulk-approve", bulkApproveDepartment);
// router.patch("/bulk-approve", restrictTo("Admin", "HR", "SuperAdmin", "SUPERADMIN"), bulkApproveDepartment);
router.patch("/objectives/:id/approve", approveDepartmentObjective);

// Unified Department Approvals
router.get("/approvals/pending", listPendingDepartmentApprovals);
router.post("/approvals/bulk", bulkApproveDepartmentItems);
router.post("/approvals/single", approveDepartmentItem);

// Department Key Results (nested under objectives)
router.post("/objectives/:id/key-results", createDepartmentKR);
router.get("/objectives/:id/key-results", listDepartmentKRs);

// Department Key Results (direct access)
router.put("/key-results/:id", updateDepartmentKR);
router.patch("/key-results/:id/submit", submitDepartmentKeyResult);
router.patch("/key-results/:id/approve", approveDepartmentKeyResult);
router.patch("/key-results/:id/publish", publishDepartmentKeyResult);

// Month Plans
router.post("/key-results/:id/month-plan", createMonthPlan);
router.get("/key-results/:id/month-plans", listMonthPlans);

// Weekly Plans
router.post("/key-results/:id/weekly-plan", createWeeklyPlan);
router.get("/key-results/:id/weekly-plans", listWeeklyPlans);

// Department Daily Plans
router.post("/weekly-plans/:id/daily-plans", createDepartmentDailyPlan);
router.get("/weekly-plans/:id/daily-plans", listDepartmentDailyPlans);
router.put("/daily-plans/:id", updateDepartmentDailyPlan);
router.patch("/daily-plans/:id", updateDepartmentDailyPlan);
router.delete("/daily-plans/:id", deleteDepartmentDailyPlan);

export default router;
