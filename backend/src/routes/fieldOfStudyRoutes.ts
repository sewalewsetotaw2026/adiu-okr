import express from "express";
import { createFieldOfStudy } from "../controllers/fieldOfStudyController";
import { getFieldOfStudySuggestions } from "../controllers/suggestionController"; // Re-using suggestion or dedicated?
// Ideally keep suggestions separate or here. But getFieldOfStudySuggestions is in suggestionController.
// I will just add create here.

import { protect } from "../middleware/authMiddleware";
import { verifyAccessControl } from "../middleware/verifyAccessControl";
import { Resources, ActionTypes } from "../utils/constants";

const router = express.Router();

router.use(protect);

router.post(
  "/",
  verifyAccessControl(Resources.FIELD_OF_STUDY, ActionTypes.CREATE_ANY),
  createFieldOfStudy,
);

export default router;
