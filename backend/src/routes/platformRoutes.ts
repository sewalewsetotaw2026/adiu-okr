import express from "express";
import { protect, restrictToSuperAdmin } from "src/middleware/authMiddleware";
import {
  getCompanies,
  getCompany,
  registerCompany,
  updateCompany,
  toggleCompanyStatus,
  deleteCompany,
} from "src/controllers/platformController";

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(restrictToSuperAdmin);

router.route("/companies").get(getCompanies).post(registerCompany);
router.route("/companies/:id").get(getCompany).patch(updateCompany);

router.patch("/companies/:id/status", toggleCompanyStatus);
router.delete("/companies/:id", deleteCompany);

export default router;
