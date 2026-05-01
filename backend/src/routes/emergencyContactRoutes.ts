
import express from "express";
import { protect } from "../middleware/authMiddleware";
import * as emergencyContactController from "../controllers/emergencyContactController";

import { ActionTypes, Resources } from "src/utils/constants";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";

const router = express.Router();

router.use(protect);

router
  .route("/employee/:employeeId")
  .get(
    verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.READ_OWN),
    emergencyContactController.getEmergencyContacts
  )
  .post(
    verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.CREATE_OWN),
    emergencyContactController.createEmergencyContact
  );

router
  .route("/:id")
  .patch(
    verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.UPDATE_OWN),
    emergencyContactController.updateEmergencyContact
  )
  .delete(
    verifyAccessControl(Resources.EMERGENCY_CONTACT, ActionTypes.DELETE_OWN),
    emergencyContactController.deleteEmergencyContact
  );

export default router;
