import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  login,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateEmail,
  verifyResetToken,
  getCompanyPasswordAudit,
  ssoExchange,
} from "src/controllers/authController";

const router = express.Router();

router.post("/login", login);
router.post("/sso-exchange", ssoExchange); 
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword/:token", resetPassword);
router.get("/verifyResetToken/:token", verifyResetToken);

router.use(protect);
router.patch("/updateMyPassword", updatePassword);
router.patch("/updateMyEmail", updateEmail);
router.get("/password-audit", getCompanyPasswordAudit);


export default router;
