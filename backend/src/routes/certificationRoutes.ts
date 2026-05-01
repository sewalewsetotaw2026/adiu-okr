import express from "express";
import {
  fetchAllCertifications,
  fetchCertification,
  createCertification,
  bulkCreateCertifications,
  updateCertification,
  deleteCertification,
  bulkDeleteCertifications,
} from "src/controllers/certificationController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

router.use(protect);

router.get(
  "/employee/:employeeId",
  verifyAccessControl(Resources.EMPLOYEE_CERTIFICATE, ActionTypes.READ_OWN),
  fetchAllCertifications,
);

router.get(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_CERTIFICATE, ActionTypes.READ_OWN),
  fetchCertification,
);

router.post(
  "/",
  verifyAccessControl(Resources.EMPLOYEE_CERTIFICATE, ActionTypes.CREATE_OWN),
  createCertification,
);

router.post(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE_CERTIFICATE, ActionTypes.CREATE_ANY),
  bulkCreateCertifications,
);

router.put(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_CERTIFICATE, ActionTypes.UPDATE_OWN),
  updateCertification,
);

router.delete(
  "/bulk",
  verifyAccessControl(Resources.EMPLOYEE_CERTIFICATE, ActionTypes.DELETE_ANY),
  bulkDeleteCertifications,
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.EMPLOYEE_CERTIFICATE, ActionTypes.DELETE_OWN),
  deleteCertification,
);

export default router;
