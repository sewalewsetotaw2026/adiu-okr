import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  createMetric,
  listMetrics,
} from "src/controllers/okrMetricController";

const router = express.Router();

router.use(protect);

router.get("/", listMetrics);
router.post("/", createMetric);

export default router;
