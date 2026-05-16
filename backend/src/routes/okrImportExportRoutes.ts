import express from "express";
import multer from "multer";
import { protect } from "src/middleware/authMiddleware";
import {
  importQuarterly,
  importMonthly,
  importWeekly,
  exportQuarterly,
  exportMonthly,
  exportWeekly,
  downloadQuarterlyTemplate,
  downloadMonthlyTemplate,
  downloadWeeklyTemplate,
} from "src/controllers/okrImportExportController";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx and .csv files are supported."));
    }
  },
});

router.use(protect);

// ─── Import ──────────────────────────────────────────────────────────────────
router.post("/import/quarterly", upload.single("file"), importQuarterly);
router.post("/import/monthly", upload.single("file"), importMonthly);
router.post("/import/weekly", upload.single("file"), importWeekly);

// ─── Export ──────────────────────────────────────────────────────────────────
router.get("/export/quarterly", exportQuarterly);
router.get("/export/monthly", exportMonthly);
router.get("/export/weekly", exportWeekly);

// ─── Template Download ───────────────────────────────────────────────────────
router.get("/template/quarterly", downloadQuarterlyTemplate);
router.get("/template/monthly", downloadMonthlyTemplate);
router.get("/template/weekly", downloadWeeklyTemplate);

export default router;
