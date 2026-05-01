import express from "express";
import { protect, restrictTo } from "src/middleware/authMiddleware";
import {
  listConfigurations,
  getConfigurationMenu,
  upsertConfigurationMenu,
  getConfigurationByKey,
  createConfigurationByKey,
  updateConfigurationByKey,
  deleteConfigurationByKey,
} from "src/controllers/okrConfigController";

const router = express.Router();

router.use(protect);

router.get("/", listConfigurations);
router.get("/menu", getConfigurationMenu);
router.put(
  "/menu",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN"),
  upsertConfigurationMenu,
);

router.get("/:key", getConfigurationByKey);
router.post(
  "/:key",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN"),
  createConfigurationByKey,
);
router.put(
  "/:key",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN"),
  updateConfigurationByKey,
);
router.delete(
  "/:key",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN"),
  deleteConfigurationByKey,
);

export default router;
