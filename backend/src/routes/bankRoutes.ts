
import express from "express";
import { protect } from "../middleware/authMiddleware";
import * as bankController from "../controllers/bankController";

import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

router.use(protect);

router.get(
  "/",
  verifyAccessControl(Resources.BANK, ActionTypes.READ_ANY),
  bankController.getBanks
);

export default router;
