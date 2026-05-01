/**
 * Celebration Routes
 * API endpoints for the celebration system
 */
import { Router } from "express";
import { protect } from "src/middleware/authMiddleware";
import * as celebrationController from "src/controllers/celebrationController";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = Router();

/**
 * @route   GET /api/v1/celebrations/events
 * @desc    SSE endpoint for real-time celebration events
 * @access  Private
 */
router.get("/events", protect, verifyAccessControl(Resources.CELEBRATION, ActionTypes.READ_OWN), celebrationController.sseEventsHandler);

/**
 * @route   GET /api/v1/celebrations
 * @desc    Get all active celebrations for the current user
 * @access  Private
 */
router.get("/", protect, verifyAccessControl(Resources.CELEBRATION, ActionTypes.READ_OWN), celebrationController.getCelebrations);

/**
 * @route   GET /api/v1/celebrations/:id
 * @desc    Get a specific celebration by ID
 * @access  Private
 */
router.get("/:id", protect, verifyAccessControl(Resources.CELEBRATION, ActionTypes.READ_OWN), celebrationController.getCelebrationById);

/**
 * @route   POST /api/v1/celebrations/:id/messages
 * @desc    Send a message to a celebration
 * @access  Private
 */
router.post("/:id/messages", protect, celebrationController.sendMessage);

/**
 * @route   POST /api/v1/celebrations/:id/reactions
 * @desc    Send a reaction to a celebration
 * @access  Private
 */
router.post("/:id/reactions", protect, celebrationController.sendReaction);

/**
 * @route   POST /api/v1/celebrations/:id/dismiss
 * @desc    Dismiss a celebration
 * @access  Private
 */
router.post("/:id/dismiss", protect, celebrationController.dismissCelebration);

/**
 * @route   POST /api/v1/celebrations/detect
 * @desc    Manually trigger celebration detection
 * @access  Private (Admin)
 */
router.post("/detect", protect, verifyAccessControl(Resources.CELEBRATION, ActionTypes.UPDATE_ANY), celebrationController.runDetection);

export default router;
