
import express from "express";
import { protect } from "../middleware/authMiddleware";
import * as profilePictureController from "../controllers/profilePictureController";

const router = express.Router();

router.use(protect);

router.patch("/:id/profile-picture", profilePictureController.updateProfilePicture);

export default router;
