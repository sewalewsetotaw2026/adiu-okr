
import express from "express";
import { protect } from "../middleware/authMiddleware";
import * as financialDetailController from "../controllers/financialDetailController";

import { ActionTypes, Resources } from "src/utils/constants";
import { verifyAccessControl } from "src/middleware/verifyAccessControl";

const router = express.Router();

router.use(protect);

router
  .route("/employee/:employeeId")
  .get(
    verifyAccessControl(Resources.FINANCIAL_DETAIL, ActionTypes.READ_OWN),
    financialDetailController.getFinancialDetails
  )
  .post(
    verifyAccessControl(Resources.FINANCIAL_DETAIL, ActionTypes.CREATE_OWN),
    financialDetailController.createFinancialDetail
  );

router
  .route("/:id")
  .patch(
    verifyAccessControl(Resources.FINANCIAL_DETAIL, ActionTypes.UPDATE_OWN),
    financialDetailController.updateFinancialDetail
  )
  .delete(
    verifyAccessControl(Resources.FINANCIAL_DETAIL, ActionTypes.DELETE_OWN),
    financialDetailController.deleteFinancialDetail
  );

export default router;
