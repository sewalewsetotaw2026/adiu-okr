import express from "express";
import { protect } from "src/middleware/authMiddleware";
import * as approvalController from "src/controllers/okrApprovalController";

const router = express.Router();

router.use(protect);

router.post("/submit", approvalController.submitForApproval);
router.post("/comment", approvalController.addReviewComment);
router.post("/:id/approve", approvalController.approveSubmission);

export default router;
