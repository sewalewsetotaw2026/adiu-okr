
import express from "express";
import { protect } from "../middleware/authMiddleware";
import { createJobLevel, getJobLevels } from "../controllers/jobLevelController";

import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

router.use(protect);

router
  .route("/")
  .get(
    verifyAccessControl(Resources.JOB_LEVEL, ActionTypes.READ_ANY),
    getJobLevels
  )
  .post(
    verifyAccessControl(Resources.JOB_LEVEL, ActionTypes.CREATE_ANY),
    createJobLevel
  );

export default router;
