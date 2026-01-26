import mongoose from "mongoose";

const EmissionCalculationHistorySchema = new mongoose.Schema(
  {
    calculation_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    calculation_meta: {
      calculator_type: {
        type: String,
        required: true,
        index: true,
      },
      leg_type: {
        type: String,
        required: true,
      },
      user_id: {
        type: String,
        required: true,
        index: true,
      },
    },

    activity_attributes: {
      type: Object,
      required: true,
    },

    emission_result: {
      total_emission: {
        type: Number,
        required: true,
      },
      emission_unit: {
        type: String,
        required: true,
        default: "kgCO2e",
      },
    },

    factor_snapshot: {
      scope_id: {
        type: String,
        required: true,
        index: true,
      },
      factor_value: {
        type: Number,
        required: true,
      },
      factor_unit: {
        type: String,
        required: true,
      },
      source: {
        type: String,
        required: true,
      },
      year: {
        type: Number,
        required: true,
        index: true,
      },
      version: {
        type: String,
        required: true,
      },
    },

    calculated_at: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

EmissionCalculationHistorySchema.index({
  "calculation_meta.user_id": 1,
  calculated_at: -1,
});

EmissionCalculationHistorySchema.index({
  "calculation_meta.user_id": 1,
  "calculation_meta.calculator_type": 1,
  calculated_at: -1,
});

export default mongoose.model(
  "EmissionCalculationHistory",
  EmissionCalculationHistorySchema,
  "emission_calculation_history",
);
