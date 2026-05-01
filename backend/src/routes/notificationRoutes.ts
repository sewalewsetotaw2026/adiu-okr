import { Router } from "express";
import { protect } from "../middleware/authMiddleware";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById,
} from "../controllers/notificationController";
import { sseManager } from "../services/sseService";
import { verifyAccessControl } from "../middleware/verifyAccessControl";
import { Resources, ActionTypes } from "../utils/constants";

const router = Router();

// Apply authentication middleware to all routes
router.use(protect);

// SSE Stream endpoint for real-time notifications
router.get("/stream", (req: any, res) => {
  const employeeId = req.user?.employee_id;
  const companyId = req.user?.company_id;

  if (!employeeId || !companyId) {
    return res.status(400).json({
      status: "fail",
      message: "Employee ID or Company ID not found",
    });
  }

  const clientId = crypto.randomUUID();

  // Handle client disconnect
  req.on("close", () => {
    sseManager.removeClient(clientId);
  });

  // Add client to SSE manager (pass origin for CORS)
  const origin = req.headers.origin;
  sseManager.addClient(clientId, employeeId, companyId, res, origin);
});

// Get user's notifications (paginated, with filters)
router.get("/", verifyAccessControl(Resources.NOTIFICATION, ActionTypes.READ_OWN), getMyNotifications);

// Get unread notification count
router.get("/unread-count", verifyAccessControl(Resources.NOTIFICATION, ActionTypes.READ_OWN), getUnreadNotificationCount);

// Mark notification as read
router.put("/:id/read", verifyAccessControl(Resources.NOTIFICATION, ActionTypes.UPDATE_OWN), markNotificationAsRead);

// Mark all notifications as read
router.put("/read-all", verifyAccessControl(Resources.NOTIFICATION, ActionTypes.UPDATE_OWN), markAllNotificationsAsRead);

// Delete notification
router.delete("/:id", verifyAccessControl(Resources.NOTIFICATION, ActionTypes.DELETE_OWN), deleteNotificationById);

export default router;
