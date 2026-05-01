import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  login,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateEmail,
} from "src/controllers/authController";

const router = express.Router();

router.post("/login", login);
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword/:token", resetPassword);

router.use(protect);
router.patch("/updateMyPassword", updatePassword);
router.patch("/updateMyEmail", updateEmail);

export default router;
