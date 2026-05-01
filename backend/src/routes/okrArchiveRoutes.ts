import express from "express";
import { protect, restrictTo } from "src/middleware/authMiddleware";
import {
  closeCycleCtrl,
  archiveQuarter,
  listArchives,
  getArchiveDetail,
  generateReport,
  generateInsight,
  createExportJob,
  getExportJobCtrl,
} from "src/controllers/okrArchiveController";

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

// Cycle lifecycle
router.post("/cycles/:id/close", restrictTo("Admin"), closeCycleCtrl);

// Archive management
router.post("/archives", restrictTo("Admin"), archiveQuarter);
router.get("/archives", listArchives);
router.get("/archives/:id", getArchiveDetail);

// Report & Insight generation
router.post("/archives/:id/reports", restrictTo("Admin"), generateReport);
router.post("/archives/:id/insights", restrictTo("Admin"), generateInsight);

// Export management
router.post("/archives/:id/exports", restrictTo("Admin"), createExportJob);
router.get("/exports/:id", getExportJobCtrl);

export default router;
