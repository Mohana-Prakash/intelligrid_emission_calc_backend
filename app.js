import express from "express";
import cors from "cors";

import emissionRoutes from "./routes/emissionFactor.routes.js";
import calculationRoutes from "./routes/calculation.routes.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use("/api/v1/emission-factors", emissionRoutes);
app.use("/api/v1/calculate", calculationRoutes);

export default app;
