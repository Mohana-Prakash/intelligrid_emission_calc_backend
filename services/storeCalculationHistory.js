import EmissionCalculationHistory from "../models/EmissionCalculationHistory.js";

export const storeCalculationHistory = async (calculationResult) => {
  await EmissionCalculationHistory.create(calculationResult);

  return {
    calculation_id: calculationResult.calculation_id,
    stored: true,
  };
};
