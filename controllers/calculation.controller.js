import * as service from "../services/calculation.service.js";
import { validateCalculate } from "../validators/calculate.validator.js";

export const calculateEmission = async (req, res) => {
  validateCalculate(req.body);
  const result = await service.calculate(req.body);
  res.json(result);
};
