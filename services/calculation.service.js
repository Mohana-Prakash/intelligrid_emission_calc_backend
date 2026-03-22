import EmissionFactor from "../models/EmissionFactor.js";
import { validationError, serverError } from "../utils/apiErrors.js";
import { storeCalculationHistory } from "./storeCalculationHistory.js";

export const calculate = async (payload) => {
  try {
    const {
      scope_id,
      distance,
      trip_type,
      passengers,
      origin,
      destination,
      calculator_type,
      leg_type,
      user_id,
    } = payload;

    if (!scope_id) return validationError("scope_id", "scope_id is required");

    if (!trip_type)
      return validationError("trip_type", "trip_type is required");

    if (!calculator_type)
      return validationError("calculator_type", "calculator_type is required");

    if (!leg_type) return validationError("leg_type", "leg_type is required");

    if (!user_id) return validationError("user_id", "user_id is required");

    const factor = await EmissionFactor.findOne({ scope_id });

    const isFlight = factor.activity_attributes?.activity === "flight";

    if (!isFlight && (distance === undefined || distance <= 0)) {
      return validationError(
        "distance",
        "distance is required for non-flight modes",
      );
    }

    if (isFlight) {
      if (!passengers || passengers <= 0)
        return validationError(
          "passengers",
          "passengers is required for flight mode",
        );

      if (!origin)
        return validationError("origin", "origin is required for flight mode");

      if (!destination)
        return validationError(
          "destination",
          "destination is required for flight mode",
        );
    }

    const tripMultiplier = trip_type === "round_trip" ? 2 : 1;
    const distanceWithTrip = (distance || 0) * tripMultiplier;

    const passengerMultiplier = isFlight ? passengers : 1;

    const totalEmission =
      distanceWithTrip * factor.emission_factor_value * passengerMultiplier;

    const calculationResult = {
      calculation_meta: {
        calculator_type,
        leg_type,
        user_id,
      },
      calculation_id: crypto.randomUUID(),
      activity_attributes: {
        ...factor.activity_attributes,
        distance: distance || null,
        trip_type,
        ...(factor.activity_attributes?.activity === "flight" && {
          passengers: isFlight ? passengers : null,
        }),
        origin: isFlight ? origin : null,
        destination: isFlight ? destination : null,
        unit: factor.factor_unit,
      },

      emission_result: {
        total_emission: Number(totalEmission.toFixed(4)),
        emission_unit: factor.emission_unit || "kgCO2e",
      },

      factor_snapshot: {
        scope_id: factor.scope_id,
        factor_value: factor.emission_factor_value,
        factor_unit: factor.factor_unit,
        source: factor.source,
        year: factor.year,
        version: factor.version,
      },
    };

    try {
      await storeCalculationHistory(calculationResult);
    } catch (historyErr) {
      console.error("Failed to store calculation history:", historyErr);
    }

    return {
      statusCode: 200,
      success: true,
      response: calculationResult,
    };
  } catch (err) {
    console.error(err);
    return serverError();
  }
};
