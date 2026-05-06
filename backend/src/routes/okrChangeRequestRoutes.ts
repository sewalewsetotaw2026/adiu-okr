import express from "express";
import { protect } from "src/middleware/authMiddleware";
import * as crController from "src/controllers/okrChangeRequestController";

const router = express.Router();

router.use(protect);

// ─── Change Request CRUD ────────────────────────────────────────────────────

// Create a new change request (employee edits a published entity)
router.post("/", crController.createChangeRequest);

// List change requests (filterable by cycle, status, requester, reviewer)
router.get("/", crController.listChangeRequests);

// List pending change requests for current user as reviewer
router.get("/my-reviews", crController.listMyPendingReviews);

// Get change request detail with realignment flags
router.get("/:id", crController.getChangeRequestDetail);

// Approve a change request
router.post("/:id/approve", crController.approveChangeRequest);

// Reject a change request
router.post("/:id/reject", crController.rejectChangeRequest);

// ─── Realignment Flags ──────────────────────────────────────────────────────

// List my realignment flags (subordinate view)
router.get("/realignment/my-flags", crController.listMyRealignmentFlags);

// Check entity-level realignment flags (for UI banner)
router.get("/realignment/entity", crController.getEntityRealignmentFlags);

// Acknowledge a realignment flag
router.post("/realignment/:id/acknowledge", crController.acknowledgeRealignment);

// Dismiss a realignment flag with reason
router.post("/realignment/:id/dismiss", crController.dismissRealignment);

// Mark realignment as complete (subordinate has re-submitted)
router.post("/realignment/:id/complete", crController.completeRealignment);

// ─── Manager View ───────────────────────────────────────────────────────────

// Get subordinate alignment status
router.get("/alignment/subordinates", crController.getSubordinateAlignmentStatus);

export default router;
