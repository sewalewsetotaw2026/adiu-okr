import { Router } from "express";
import {
  getAllowanceTypes,
  createAllowanceType,
  getAllowanceTypeById,
  updateAllowanceType,
  deleteAllowanceType,
} from "../controllers/allowanceTypeController";
import { protect } from "../middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = Router();
router.use(protect);

// Get all allowance types (for dropdowns)
router.get(
  "/",
  verifyAccessControl(Resources.ALLOWANCE_TYPE, ActionTypes.READ_ANY),
  getAllowanceTypes
);

// Get single allowance type
router.get(
  "/:id",
  verifyAccessControl(Resources.ALLOWANCE_TYPE, ActionTypes.READ_ANY),
  getAllowanceTypeById
);

// Create new allowance type
router.post(
  "/",
  verifyAccessControl(Resources.ALLOWANCE_TYPE, ActionTypes.CREATE_ANY),
  createAllowanceType
);

// Update allowance type
router.put(
  "/:id",
  verifyAccessControl(Resources.ALLOWANCE_TYPE, ActionTypes.UPDATE_ANY),
  updateAllowanceType
);

// Delete allowance type
router.delete(
  "/:id",
  verifyAccessControl(Resources.ALLOWANCE_TYPE, ActionTypes.DELETE_ANY),
  deleteAllowanceType
);

export default router;
