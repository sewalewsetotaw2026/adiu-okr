import express from "express";
import * as contributorService from "src/services/okrContributorService";
import { protect } from "src/middleware/authMiddleware";
import {
  assignContributor,
  removeContributor,
  updateContributorFlag,
  listContributors,
  getDepartmentContributorSummary,
} from "src/controllers/okrContributorController";

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

// Contributor CRUD
router.post("/", assignContributor);
router.delete("/:id", removeContributor);
router.patch("/:id/flag", updateContributorFlag);
router.get("/", listContributors);
router.get("/department-summary", getDepartmentContributorSummary);

export default router;
