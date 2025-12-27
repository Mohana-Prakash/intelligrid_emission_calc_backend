import mongoose from "mongoose";

const EmissionFactorSchema = new mongoose.Schema(
  {
    activity: { type: String, required: true },
    type: { type: String },
    size: { type: String },
    segment: { type: String },
    unit: { type: String, required: true },
    value: { type: Number, required: true },
    scope: { type: String, required: true },
    source: { type: String, required: true },
    year: { type: Number, required: true },
    version: { type: String, required: true },
    scope_id: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model(
  "EmissionFactor",
  EmissionFactorSchema,
  "defra_emission_factor"
);
