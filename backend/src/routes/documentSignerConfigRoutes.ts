import express from "express";
import { protect, restrictTo } from "../middleware/authMiddleware";
import { RoleNames } from "../utils/roleConstants";
import {
  upsertConfig,
  getConfig,
} from "../controllers/documentSignerConfigController";

import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

router.use(protect);

// Only Admins and HR can configure signers (via RBAC)
router
  .route("/")
  .get(
    verifyAccessControl(Resources.DOCUMENT_SIGNER, ActionTypes.READ_ANY),
    getConfig,
  )
  .post(
    verifyAccessControl(Resources.DOCUMENT_SIGNER, ActionTypes.CREATE_ANY),
    upsertConfig,
  );

export default router;
