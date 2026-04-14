import mongoose from "mongoose";

const ActivityAttributesSchema = new mongoose.Schema(
  {
    activity: { type: String, required: true, index: true },
    category: { type: String, index: true },
    size: { type: String, index: true },
    segment: { type: String, index: true },
    fuel: { type: String, index: true },
    haul: { type: String, index: true },
    cabin_class: { type: String, index: true },
    type: { type: String, index: true },

    // MUST match factor_unit
    distance_unit: { type: String, required: true },
  },
  { _id: false },
);

const EmissionFactorSchema = new mongoose.Schema(
  {
    scope_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    activity_attributes: {
      type: ActivityAttributesSchema,
      required: true,
    },

    // canonical unit for calculation
    factor_unit: {
      type: String,
      required: true,
      index: true,
    },

    emission_factor_value: {
      type: Number,
      required: true,
    },

    emission_unit: {
      type: String,
      required: true,
      default: "kgCO2e",
    },

    scope: {
      type: String,
      required: true,
      index: true,
    },

    source: {
      type: String,
      required: true,
      index: true,
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
  {
    timestamps: true,
  },
);

export default mongoose.model(
  "EmissionFactor",
  EmissionFactorSchema,
  "defra_emission_factor",
);
