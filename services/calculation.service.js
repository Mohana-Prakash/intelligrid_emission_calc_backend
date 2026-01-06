import EmissionFactor from "../models/EmissionFactor.js";

export const calculate = async ({
  scope_id,
  distance,
  trip_type,
  passengers,
}) => {
  const factor = await EmissionFactor.findOne({ scope_id });

  if (!factor) throw new Error("Emission factor not found");

  const tripMultiplier = trip_type === "round_trip" ? 2 : 1;
  const distance_with_trip = distance * tripMultiplier;

  const passengerMultiplier = factor.activity === "flight" ? passengers : 1;

  const emission =
    distance_with_trip * factor.emission_factor_value * passengerMultiplier;

  return {
    scope_id,
    trip_type,
    actaul_distance: distance,
    distance_with_trip,
    emission,
    passengers,
    emission_unit: "kgCO2e",
    emission_factor: factor.emission_factor_value,
    unit: factor.unit,
    source: factor.source,
    year: factor.year,
    version: factor.version,
  };
};
