import express from "express";
import {
  fetchAllAddresses,
  fetchAddress,
  createAddress,
  bulkCreateAddresses,
  updateAddress,
  deleteAddress,
  bulkDeleteAddresses,
} from "src/controllers/employeeAddressController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// Protect all routes
router.use(protect);

router.get(
  "/employee/:employeeId",
  verifyAccessControl(Resources.EMPLOYEE_ADDRESS, ActionTypes.READ_OWN),
  fetchAllAddresses,
);

router.get(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_ADDRESS, ActionTypes.READ_OWN),
  fetchAddress,
);

router.post(
  "/",
  verifyAccessControl(Resources.EMPLOYEE_ADDRESS, ActionTypes.CREATE_OWN),
  createAddress,
);

router.post(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE_ADDRESS, ActionTypes.CREATE_ANY),
  bulkCreateAddresses,
);

router.put(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_ADDRESS, ActionTypes.UPDATE_OWN),
  updateAddress,
);

router.delete(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE_ADDRESS, ActionTypes.DELETE_ANY),
  bulkDeleteAddresses,
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_ADDRESS, ActionTypes.DELETE_OWN),
  deleteAddress,
);

export default router;
