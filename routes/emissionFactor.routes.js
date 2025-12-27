import express from "express";
import {
  getByActivity,
  bulkInsert,
  updateByScopeId,
  deleteByScopeId,
} from "../controllers/emissionFactor.controller.js";

const router = express.Router();

router.get("/", getByActivity);
router.post("/bulk", bulkInsert);
router.put("/:scope_id", updateByScopeId);
router.delete("/:scope_id", deleteByScopeId);

export default router;
