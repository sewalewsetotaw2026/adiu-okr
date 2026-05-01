import { Router } from "express";
import { protect } from "src/middleware/authMiddleware";
import { generateExperienceLetter } from "src/controllers/experienceLetterController";

const router = Router();

// Protect all routes
router.use(protect);

/**
 * GET /api/v1/experience-letter/:id
 * Generate experience letter PDF for an employee
 */
router.get("/:id", generateExperienceLetter);

export default router;
