import { Router } from "express";
import * as crController from "../controllers/okrChangeRequestController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

// Change Requests
router.get("/", protect, crController.getPendingChangeRequests);
router.post("/", protect, crController.createChangeRequest);
router.post("/:id/approve", protect, crController.approveChangeRequest);
router.post("/:id/reject", protect, crController.rejectChangeRequest);

// Realignment Flags
router.get("/realignment-flags", protect, crController.getMyRealignmentFlags);
router.post("/realignment-flags/:id/acknowledge", protect, crController.acknowledgeRealignment);
router.post("/realignment-flags/:id/dismiss", protect, crController.dismissRealignment);

export default router;
