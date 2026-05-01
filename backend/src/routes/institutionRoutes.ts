import express from "express";
import { createInstitution } from "../controllers/institutionController";
import { protect } from "../middleware/authMiddleware";
import { verifyAccessControl } from "../middleware/verifyAccessControl";
import { Resources, ActionTypes } from "../utils/constants";

const router = express.Router();

router.use(protect);

router.post(
  "/",
  verifyAccessControl(Resources.INSTITUTION, ActionTypes.CREATE_ANY),
  createInstitution
);

export default router;
