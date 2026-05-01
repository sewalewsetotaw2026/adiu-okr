import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  listAuditLogs,
  getConfigSnapshot,
} from "src/controllers/okrAuditController";

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

router.get("/logs", listAuditLogs);
router.get("/snapshots/:id", getConfigSnapshot);

export default router;
