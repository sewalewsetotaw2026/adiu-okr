import { Router } from "express";
import {
  createDepartment,
  getDepartments,
  getDepartmentById,
  countDepartments,
  updateDepartment,
  deleteDepartment,
  getDepartmentTree,
  assignDepartmentHead,
} from "../controllers/departmentController";

import { protect } from "../middleware/authMiddleware";
import { Resources, ActionTypes } from "src/utils/constants";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";

const router = Router();
router.use(protect);

router.get(
  "/count",
  verifyAccessControl(Resources.DEPARTMENT, ActionTypes.READ_ANY),
  countDepartments,
);

router.get(
  "/tree",
  verifyAccessControl(Resources.DEPARTMENT, ActionTypes.READ_OWN),
  getDepartmentTree,
);

router.get(
  "/",
  verifyAccessControl(Resources.DEPARTMENT, ActionTypes.READ_ANY),
  getDepartments,
);

router.get(
  "/:id",
  verifyAccessControl(Resources.DEPARTMENT, ActionTypes.READ_ANY),
  getDepartmentById,
);



router.post(
  "/",
  verifyAccessControl(Resources.DEPARTMENT, ActionTypes.CREATE_ANY),
  createDepartment,
);

router.put(
  "/:id",
  verifyAccessControl(Resources.DEPARTMENT, ActionTypes.UPDATE_ANY),
  updateDepartment,
);

router.delete(
  "/:id",
  verifyAccessControl(Resources.DEPARTMENT, ActionTypes.DELETE_ANY),
  deleteDepartment,
);

router.patch(
  "/:id/assign-head",
  verifyAccessControl(Resources.DEPARTMENT, ActionTypes.UPDATE_ANY),
  assignDepartmentHead,
);


export default router;
