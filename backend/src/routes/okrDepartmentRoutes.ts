import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  listDepartmentObjectives,
  listPendingDepartmentObjectives,
  listPendingDepartmentKeyResults,
  listDepartmentPendingApprovals,
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
} from "src/controllers/okrDepartmentController";
import { restrictTo } from "src/middleware/authMiddleware";

const router = express.Router();

router.use(protect);

router.get("/approvals/pending", listDepartmentPendingApprovals);
router.post("/approvals/bulk", restrictTo("Admin"), bulkApproveDepartment);
router.post("/approvals/single", restrictTo("Admin"), bulkApproveDepartment);
router.get("/objectives/pending", restrictTo("Admin"), listPendingDepartmentObjectives);
router.get("/key-results/pending", listPendingDepartmentKeyResults);

router.param("id", (req, res, next, id) => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return res
      .status(400)
      .json({ status: "fail", message: "id must be a positive integer." });
  }
  next();
});

router.post("/adopt-kr", adoptCompanyKR);
router.get("/objectives", listDepartmentObjectives);
router.post("/objectives", createDepartmentObjective);
router.get("/objectives/:id", getDepartmentObjectiveDetail);
router.patch("/objectives/:id/publish", publishDepartmentObjective);
router.patch("/objectives/:id/submit", submitDepartmentObjective);

// Existing bulk operations (keeping for compatibility)
router.patch("/bulk-submit", restrictTo("Admin", "Manager", "CEO", "SUPER_ADMIN", "Super Admin"), bulkSubmitDepartment);
router.patch("/bulk-approve", restrictTo("Admin"), bulkApproveDepartment);
router.patch(
  "/objectives/:id/approve",
  restrictTo("Admin"),
  approveDepartmentObjective,
);

// Department Key Results (nested under objectives)
router.post("/objectives/:id/key-results", createDepartmentKR);
router.get("/objectives/:id/key-results", listDepartmentKRs);

// Department Key Results (direct access)
router.put("/key-results/:id", updateDepartmentKR);
router.patch("/key-results/:id/submit", submitDepartmentKeyResult);
router.patch(
  "/key-results/:id/approve",
  restrictTo("Admin"),
  approveDepartmentKeyResult,
);
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
