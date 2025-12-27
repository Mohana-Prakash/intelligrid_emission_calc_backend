import express from "express";
import { calculateEmission } from "../controllers/calculation.controller.js";

const router = express.Router();
router.post("/emission", calculateEmission);

export default router;
