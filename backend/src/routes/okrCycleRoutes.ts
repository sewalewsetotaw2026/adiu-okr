import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  createCycle,
  updateCycle,
  listCycles,
  getCycleById,
  openCycle,
  closeCycle,
  getCurrentOpenCycle,
  getArchiveReadySummary,
} from "src/controllers/okrCycleController";

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

router.get("/", listCycles);
router.post("/", createCycle);
router.get("/current", getCurrentOpenCycle);
router.get("/:id", getCycleById);
router.put("/:id", updateCycle);
router.patch("/:id/open", openCycle);
router.patch("/:id/close", closeCycle);
router.get("/:id/archive-check", getArchiveReadySummary);

export default router;
