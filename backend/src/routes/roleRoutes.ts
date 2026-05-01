import express from "express";
import { protect } from "../middleware/authMiddleware";
import {
  getRoles,
  getRoleDetails,
  createRole,
  deleteRole,
  updatePermission,
  assignUsersToRole,
  removeUserFromRole,
} from "../controllers/roleController";

const router = express.Router();

router.use(protect);

router.route("/").get(getRoles).post(createRole);
router.post("/unassign-user", removeUserFromRole);
router.route("/:id").get(getRoleDetails).delete(deleteRole);
router.post("/:id/assign-users", assignUsersToRole);
router.route("/:id/permissions").post(updatePermission);

export default router;
