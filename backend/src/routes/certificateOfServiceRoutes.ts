import { Router } from "express";
import { protect } from "src/middleware/authMiddleware";
import { generateCertificateOfService } from "src/controllers/certificateOfServiceController";

const router = Router();

// Protect all routes
router.use(protect);

/**
 * GET /api/v1/certificate-of-service/:id
 * Generate Certificate of Service PDF for an employee
 * 
 * This is a formal, factual document for legal/administrative purposes.
 * Different from Experience Letter which is more descriptive.
 */
router.get("/:id", generateCertificateOfService);

export default router;
