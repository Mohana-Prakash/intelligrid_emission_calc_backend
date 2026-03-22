import EmissionCalculationHistory from "../models/EmissionCalculationHistory.js";

export const fetchHistory = async ({ user_id, calculator_type }) => {
  if (!user_id) {
    throw {
      status: 400,
      message: "user_id is required",
    };
  }

  const query = {
    "calculation_meta.user_id": user_id,
  };

  if (calculator_type) {
    query["calculation_meta.calculator_type"] = calculator_type;
  }

  const response = await EmissionCalculationHistory.find(query)
    .sort({ calculated_at: -1 })
    .limit(10)
    .lean(); // 🔥 important for read-only speed

  return {
    success: true,
    count: response.length,
    data: response,
  };
};
