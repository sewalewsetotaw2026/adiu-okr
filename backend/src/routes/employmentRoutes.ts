import express from "express";
import {
  countEmployments,
  countActiveEmployments,
  countInactiveEmployments,
  countManagers,
  createEmployment,
  fetchEmployeeManager,
  fetchAllEmployments,
  fetchEmployment,
  getLatestEmployment,
  updateEmployment,
  deleteEmployment,
  genderDist,
  employmentDist,
  departmentTypeDistribution,
  jobLevelDistribution,
  managerialDist,
  // ... other imports ...
  promoteEmployee as legacyPromoteEmployee,
} from "src/controllers/employmentController";
import {
  promoteEmployee,
  demoteEmployee,
  transferEmployee,
} from "src/controllers/careerController";
import { protect } from "src/middleware/authMiddleware";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";
import { Resources, ActionTypes } from "src/utils/constants";

const router = express.Router();

// protect all routes
router.use(protect);

router.get(
  "/",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  fetchAllEmployments,
);

router.get(
  "/count",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  countEmployments,
);

router.get(
  "/count/managers",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  countManagers,
);

router.get(
  "/count/active",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  countActiveEmployments,
);
router.get(
  "/count/inactive",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  countInactiveEmployments,
);
router.get(
  "/gender-dist",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  genderDist,
);

router.get(
  "/manager-dist",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  managerialDist,
);

router.get(
  "/job-dist",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  jobLevelDistribution,
);

router.get(
  "/dept-dist",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  departmentTypeDistribution,
);

router.get(
  "/emp-type-dist",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  employmentDist,
);

router.get(
  "/:id",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  fetchEmployment,
);

router.get(
  "/employee/:employeeId/latest",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  getLatestEmployment,
);

router.get(
  "/:id/manager",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.READ_ANY),
  fetchEmployeeManager,
);

router.post(
  "/",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.CREATE_ANY),
  createEmployment,
);

router.put(
  "/:id",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.UPDATE_ANY),
  updateEmployment,
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.DELETE_ANY),
  deleteEmployment,
);

router.post(
  "/promote",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.CREATE_ANY),
  promoteEmployee,
);

router.post(
  "/demote",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.CREATE_ANY),
  demoteEmployee,
);

router.post(
  "/transfer",
  verifyAccessControl(Resources.EMPLOYMENT, ActionTypes.CREATE_ANY),
  transferEmployee,
);

export default router;
