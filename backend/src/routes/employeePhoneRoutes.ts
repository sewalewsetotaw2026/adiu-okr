import express from "express";
import {
  fetchAllPhones,
  fetchPhone,
  createPhone,
  bulkCreatePhones,
  updatePhone,
  deletePhone,
  bulkDeletePhones,
} from "src/controllers/employeePhoneController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// protect all routes
router.use(protect);

router.get(
  "/employee/:employeeId",
  verifyAccessControl(Resources.EMPLOYEE_PHONE, ActionTypes.READ_OWN),
  fetchAllPhones,
);

router.get(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_PHONE, ActionTypes.READ_OWN),
  fetchPhone,
);

router.post(
  "/",
  verifyAccessControl(Resources.EMPLOYEE_PHONE, ActionTypes.CREATE_OWN),
  createPhone,
);

router.post(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE_PHONE, ActionTypes.CREATE_ANY),
  bulkCreatePhones,
);

router.put(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_PHONE, ActionTypes.UPDATE_OWN),
  updatePhone,
);

router.delete(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE_PHONE, ActionTypes.DELETE_ANY),
  bulkDeletePhones,
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_PHONE, ActionTypes.DELETE_OWN),
  deletePhone,
);

export default router;
