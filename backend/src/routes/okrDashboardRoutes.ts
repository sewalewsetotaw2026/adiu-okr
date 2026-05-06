import express from "express";
import { protect } from "src/middleware/authMiddleware";
import { restrictTo } from "src/middleware/authMiddleware";
import {
  getCeoDashboard,
  getDepartmentComparison,
  getCompanyOkrGallery,
  getFinancialBreakdownCtrl,
  getAtRiskSummary,
  getCompletionStatusCtrl,
  triggerRollupRefresh,
  generateSnapshotCtrl,
  getSnapshotsCtrl,
  getEmployeeOverview,
} from "src/controllers/okrDashboardController";

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

// Dashboard views
router.get("/ceo", getCeoDashboard);
router.get("/departments/compare", getDepartmentComparison);
router.get("/company/gallery", getCompanyOkrGallery);
router.get("/financial", getFinancialBreakdownCtrl);
router.get("/at-risk", getAtRiskSummary);
router.get("/completion", getCompletionStatusCtrl);
router.get("/completion/:id", getCompletionStatusCtrl);
router.get("/employee", getEmployeeOverview);

// Rollup & Snapshots — accessible to Admin, HR, and SuperAdmin
router.post("/rollup/refresh", restrictTo("Admin", "HR", "SuperAdmin", "Super Admin"), triggerRollupRefresh);
router.post("/snapshots/generate", restrictTo("Admin", "HR", "SuperAdmin", "Super Admin"), generateSnapshotCtrl);
router.get("/snapshots", getSnapshotsCtrl);

export default router;
