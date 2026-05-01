import express from "express";
import {
  updatePersonalInfo,
  updateContactInfo,
  updateEducation,
  updateWorkExperience,
  updateCertifications,
  updateDocuments,
  updateFinancialDetails,
  getOnboardingStatus,
  updateSignature,
  getSignature,
} from "src/controllers/onboardingController";
import { protect } from "src/middleware/authMiddleware";

const router = express.Router();

// All onboarding routes require authentication
router.use(protect);

// Get current onboarding status and data
router.get("/status", getOnboardingStatus);

// Step 1: Personal Information
router.patch("/personal-info", updatePersonalInfo);

// Step 2: Contact Information
router.patch("/contact-info", updateContactInfo);

// Step 3: Financial Details (NEW)
router.patch("/financial-details", updateFinancialDetails);

// Step 4: Education
router.patch("/education", updateEducation);

// Step 5: Work Experience
router.patch("/work-experience", updateWorkExperience);

// Step 6: Certifications
router.patch("/certifications", updateCertifications);

// Step 7: Documents (completes onboarding)
router.patch("/documents", updateDocuments);

// Step 8: Signature
router.get("/signature", getSignature);
router.patch("/signature", updateSignature);

export default router;
