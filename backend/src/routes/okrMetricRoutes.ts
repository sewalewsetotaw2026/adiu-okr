import express from "express";
import { protect, restrictTo } from "src/middleware/authMiddleware";
import {
  createMetric,
  deleteMetric,
  listMetricCategories,
  listMetrics,
  updateMetric,
  createMetricCategory,
  updateMetricCategory,
  deleteMetricCategory,
} from "src/controllers/okrMetricController";

const router = express.Router();

router.use(protect);

router.get("/", listMetrics);
router.post(
  "/",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  createMetric,
);

router.get("/categories", listMetricCategories);
router.post(
  "/categories",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  createMetricCategory,
);
router.put(
  "/categories/:id",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  updateMetricCategory,
);
router.delete(
  "/categories/:id",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  deleteMetricCategory,
);

router.put(
  "/:id",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  updateMetric,
);
router.delete(
  "/:id",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  deleteMetric,
);

export default router;
