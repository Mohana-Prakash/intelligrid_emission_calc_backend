import express from "express";
import {
  calculateEmission,
  fetchCalculationHistory,
} from "../controllers/calculation.controller.js";

const router = express.Router();
router.post("/emission", calculateEmission);
router.get("/history", fetchCalculationHistory);

export default router;
