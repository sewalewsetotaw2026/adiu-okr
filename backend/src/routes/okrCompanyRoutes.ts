import express from "express";
import { protect } from "src/middleware/authMiddleware";
import {
  createObjective,
  updateObjective,
  listObjectives,
  getObjectiveDetail,
  publishCompanyPlanning,
  publishObjective,
  createKeyResult,
  updateKeyResult,
  listKeyResults,
  getKeyResultDetail,
  publishKeyResult,
  assignUsers,
  assignDepartments,
  listAvailableCompanyKRs,
  listMetrics,
} from "src/controllers/okrCompanyController";

const router = express.Router();

router.use(protect);

router.param("id", (req, res, next, id) => {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return res
      .status(400)
      .json({ status: "fail", message: "id must be a positive integer." });
  }
  next();
});

// Objectives
router.get("/metrics", listMetrics);
router.get("/available-krs", listAvailableCompanyKRs);
router.get("/objectives", listObjectives);
router.post("/objectives", createObjective);
router.patch("/objectives/publish", publishCompanyPlanning);
router.patch("/objectives/:id/publish", publishObjective);
router.get("/objectives/:id", getObjectiveDetail);
router.put("/objectives/:id", updateObjective);

// Key Results (nested under objectives for create/list)
router.post("/objectives/:id/key-results", createKeyResult);
router.get("/objectives/:id/key-results", listKeyResults);

// Key Results (direct access for update/detail/assign)
router.get("/key-results/:id", getKeyResultDetail);
router.put("/key-results/:id", updateKeyResult);
router.patch("/key-results/:id/publish", publishKeyResult);
router.post("/key-results/:id/assign-users", assignUsers);
router.post("/key-results/:id/assign-departments", assignDepartments);

export default router;
