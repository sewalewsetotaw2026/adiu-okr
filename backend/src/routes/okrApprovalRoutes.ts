import express from "express";
import { protect, restrictTo } from "src/middleware/authMiddleware";
import * as approvalController from "src/controllers/okrApprovalController";

const router = express.Router();

router.use(protect);

// Plan-based submission
router.post("/submit", approvalController.submitForApproval);

// Granular feedback (comment on specific entity → reverts to draft)
router.post("/comment", approvalController.addReviewComment);
router.get("/comments", approvalController.getEntityComments);

// Submission lifecycle
router.get("/submissions/:id", approvalController.getSubmissionDetail);
router.get("/submissions/:id/comments", approvalController.getSubmissionComments);
router.post("/:id/approve", approvalController.approveSubmission);
router.post("/:id/reject", approvalController.rejectSubmission);

// Admin view — list all pending submissions
router.get("/admin/submissions", restrictTo("Admin", "HR", "CEO", "SUPER_ADMIN", "Super Admin"), approvalController.listAdminSubmissions);

// Manager view — list submissions assigned to current user as reviewer
router.get("/manager/submissions", approvalController.listManagerSubmissions);

export default router;
