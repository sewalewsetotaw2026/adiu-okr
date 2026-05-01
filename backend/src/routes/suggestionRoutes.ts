import { Router } from "express";
import {
  getDepartmentSuggestions,
  getJobTitleSuggestions,
  getJobLevelSuggestions,
  getFieldOfStudySuggestions,
  getInstitutionSuggestions,
} from "../controllers/suggestionController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.use(protect);

router.get("/departments", getDepartmentSuggestions);
router.get("/job-titles", getJobTitleSuggestions);
router.get("/job-levels", getJobLevelSuggestions);
router.get("/fields-of-study", getFieldOfStudySuggestions);
router.get("/institutions", getInstitutionSuggestions);

export default router;
