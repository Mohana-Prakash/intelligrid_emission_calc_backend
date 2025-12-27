import EmissionFactor from "../models/EmissionFactor.js";

export const calculate = async ({ scope_id, distance }) => {
  const factor = await EmissionFactor.findOne({ scope_id });

  if (!factor) throw new Error("Emission factor not found");

  const emission = distance * factor.value;

  return {
    scope_id,
    distance,
    emission,
    emission_unit: "kgCO2e",
    emission_factor: factor.value,
    unit: factor.unit,
    source: factor.source,
    year: factor.year,
    version: factor.version,
  };
};
