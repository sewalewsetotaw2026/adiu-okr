import express from "express";
import {
  createUser,
  fetchAllUsers,
  fetchUser,
  listPendingUsers,
  listSubmittedUsers,
  getMe,
  updateMe,
  updateUser,
  deleteUser,
  changePassword,
  approvePendingUser,
  updatePendingUser,
  submitOnboarding,
  searchUsersForMapping,
} from "src/controllers/userController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// protect all routes
router.use(protect);

router.get(
  "/mapping-search",
  verifyAccessControl(Resources.USER, ActionTypes.READ_ANY),
  searchUsersForMapping
);

router.get(
  "/pending",
  verifyAccessControl(Resources.USER, ActionTypes.READ_ANY),
  listPendingUsers
);

router.get(
  "/submitted",
  verifyAccessControl(Resources.USER, ActionTypes.READ_ANY),
  listSubmittedUsers
);

router.put(
  "/pending/:id",
  verifyAccessControl(Resources.USER, ActionTypes.UPDATE_ANY),
  updatePendingUser
);

router.post(
  "/pending/:id/approve",
  verifyAccessControl(Resources.USER, ActionTypes.UPDATE_ANY),
  approvePendingUser
);

router.post(
  "/me/onboarding",
  verifyAccessControl(Resources.USER, ActionTypes.UPDATE_OWN),
  submitOnboarding
);

router.get(
  "/me",
  verifyAccessControl(Resources.USER, ActionTypes.READ_OWN),
  getMe
);

router.patch(
  "/me",
  verifyAccessControl(Resources.USER, ActionTypes.UPDATE_OWN),
  updateMe
);

router.get(
  "/",
  verifyAccessControl(Resources.USER, ActionTypes.READ_ANY),
  fetchAllUsers
);

router.get(
  "/:id",
  verifyAccessControl(Resources.USER, ActionTypes.READ_ANY),
  fetchUser
);

router.post(
  "/",
  verifyAccessControl(Resources.USER, ActionTypes.CREATE_ANY),
  createUser
);

router.put(
  "/:id",
  verifyAccessControl(Resources.USER, ActionTypes.UPDATE_ANY),
  updateUser
);

router.put(
  "/:id/password",
  verifyAccessControl(Resources.USER, ActionTypes.UPDATE_ANY),
  changePassword
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.USER, ActionTypes.DELETE_ANY),
  deleteUser
);


export default router;
