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
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  upsertConfigurationMenu,
);

router.get("/:key", getConfigurationByKey);
router.post(
  "/:key",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  createConfigurationByKey,
);
router.put(
  "/:key",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  updateConfigurationByKey,
);
router.delete(
  "/:key",
  restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"),
  deleteConfigurationByKey,
);

export default router;
