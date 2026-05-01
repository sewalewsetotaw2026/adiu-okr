import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  getAlignmentMonthlyItems,
  getAlignmentWeeklyItems,
} from "src/controllers/okrManagerPlanController";

const router = express.Router();

router.use(protect);

// ─── Alignment Lookup (Employee-facing) ───────────────────────────────────────
router.get("/alignment/month/:monthNumber", getAlignmentMonthlyItems);
router.get("/alignment/weekly/:weekNumber", getAlignmentWeeklyItems);

export default router;
