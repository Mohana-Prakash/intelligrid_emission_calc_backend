import express from "express";
import cors from "cors";

import emissionRoutes from "./routes/emissionFactor.routes.js";
import calculationRoutes from "./routes/calculation.routes.js";

import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";

const app = express(); // ✅ FIRST

// ---- Middlewares ----
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

// ---- Swagger ----
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ---- Routes ----
app.use("/api/v1/emission-factors", emissionRoutes);
app.use("/api/v1/calculate", calculationRoutes);

export default app;
