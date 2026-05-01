import { Router } from "express";
import {
  getJobTitles,
  createJobTitle,
} from "../controllers/jobTitleController";
import { protect } from "../middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = Router();
router.use(protect);

router.get(
  "/",
  // TODO: Add access control when updating the user roles to have manager role
  getJobTitles,
);

router.post(
  "/",
  verifyAccessControl(Resources.JOB_TITLE, ActionTypes.CREATE_ANY),
  createJobTitle,
);

export default router;
