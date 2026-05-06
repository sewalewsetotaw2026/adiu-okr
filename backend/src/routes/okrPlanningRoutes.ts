/**
 * OKR Planning routes — corrected hierarchy.
 * Mounted at /api/v1/okr in src/config/routes.ts.
 *
 *   /key-results/:krId/monthly-plans              (POST/GET)
 *   /key-results/:krId/monthly-plans/available-weight (GET)
 *   /monthly-plans/:id                            (PUT/DELETE)
 *
 *   /monthly-plans/:monthlyId/weekly-plans        (POST/GET)
 *   /monthly-plans/:monthlyId/weekly-plans/available-weight (GET)
 *   /weekly-plans/:id                             (PUT/DELETE)
 *
 *   /weekly-plans/:weeklyId/daily-plans           (POST/GET)
 *   /daily-plans/:id                              (PUT/DELETE)
 *   /daily-plans/:id/status                       (PATCH)
 *
 *   /monthly-plans/submit-period   (POST)
 *   /monthly-plans/approve-period  (POST)
 *   /monthly-plans/reject-period   (POST)
 *   /weekly-plans/submit-period    (POST)
 *   /weekly-plans/approve-period   (POST)
 *   /weekly-plans/reject-period    (POST)
 *
 *   /recalculate/:entityType/:entityId   (POST, admin/debug)
 */

import express from "express";
import { protect } from "src/middleware/authMiddleware";
import * as ctrl from "src/controllers/okrPlanningController";

const router = express.Router();

router.use(protect);

const validateIdParam = (req: express.Request, res: express.Response, next: express.NextFunction, id: string) => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return res.status(400).json({ status: "fail", message: "id must be a positive integer." });
  }
  next();
};

router.param("krId", validateIdParam);
router.param("monthlyId", validateIdParam);
router.param("weeklyId", validateIdParam);
router.param("id", validateIdParam);

// ── Monthly ─────────────────────────────────────────────────────────────
router.get(
  "/key-results/:krId/monthly-plans/available-weight",
  ctrl.getMonthlyAvailableWeight,
);
router.get("/key-results/:krId/monthly-plans", ctrl.listMonthlyPlans);
router.post("/key-results/:krId/monthly-plans", ctrl.createMonthlyPlan);

router.post("/monthly-plans/submit-period", ctrl.submitMonthlyPeriod);
router.post("/monthly-plans/approve-period", ctrl.approveMonthlyPeriod);
router.post("/monthly-plans/reject-period", ctrl.rejectMonthlyPeriod);
router.post("/monthly-plans/publish-period", ctrl.publishMonthlyPeriod);

router.put("/monthly-plans/:id", ctrl.updateMonthlyPlan);
router.delete("/monthly-plans/:id", ctrl.deleteMonthlyPlan);

// ── Weekly ──────────────────────────────────────────────────────────────
router.get(
  "/monthly-plans/:monthlyId/weekly-plans/available-weight",
  ctrl.getWeeklyAvailableWeight,
);
router.get("/monthly-plans/:monthlyId/weekly-plans", ctrl.listWeeklyPlans);
router.post("/monthly-plans/:monthlyId/weekly-plans", ctrl.createWeeklyPlan);

router.post("/weekly-plans/submit-period", ctrl.submitWeeklyPeriod);
router.post("/weekly-plans/approve-period", ctrl.approveWeeklyPeriod);
router.post("/weekly-plans/reject-period", ctrl.rejectWeeklyPeriod);
router.post("/weekly-plans/publish-period", ctrl.publishWeeklyPeriod);

router.put("/weekly-plans/:id", ctrl.updateWeeklyPlan);
router.delete("/weekly-plans/:id", ctrl.deleteWeeklyPlan);

// ── Daily ──────────────────────────────────────────────────────────────
router.get("/weekly-plans/:weeklyId/daily-plans", ctrl.listDailyPlans);
router.post("/weekly-plans/:weeklyId/daily-plans", ctrl.createDailyPlan);
router.put("/daily-plans/:id", ctrl.updateDailyPlan);
router.patch("/daily-plans/:id/status", ctrl.updateDailyPlanStatus);
router.delete("/daily-plans/:id", ctrl.deleteDailyPlan);

// ── Manual roll-up trigger ─────────────────────────────────────────────
router.post("/recalculate/:entityType/:entityId", ctrl.manualRollup);

// ── Manager Plans for Alignment ─────────────────────────────────────
router.get("/manager/monthly-plans", ctrl.listManagerMonthlyPlans);
router.get("/manager/weekly-plans", ctrl.listManagerWeeklyPlans);

// ── Error Handler ──────────────────────────────────────────────────────
// Must be last to catch all errors from the above routes
router.use(ctrl.okrPlanningErrorHandler);

export default router;
