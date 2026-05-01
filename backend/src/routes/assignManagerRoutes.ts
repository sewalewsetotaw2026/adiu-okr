import express from "express";
import {
  searchPotentialManagers,
  getExistingManagers,
  removeTeamMember,
  assignManagers,
  getManagerTeamMembers,
} from "src/controllers/assignManagerController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";
import { cacheMiddleware } from "src/middleware/cacheMiddleware";

const router = express.Router();

router.use(protect);

router.get(
  "/search",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  cacheMiddleware("employees_search", 600),
  searchPotentialManagers
);

router.get(
  "/existing-managers",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  cacheMiddleware("managers", 3600),
  getExistingManagers
);

router.post(
  "/remove-member",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.UPDATE_ANY),
  removeTeamMember
);

router.post(
  "/bulk-assign",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.UPDATE_ANY),
  assignManagers
);

router.get(
  "/:managerId/team-members",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  cacheMiddleware("team_members_list", 3600),
  getManagerTeamMembers
);

export default router;
