export const validateCalculate = ({ scope_id, distance }) => {
  if (!scope_id) throw new Error("scope_id required");
  if (!distance || distance <= 0) throw new Error("invalid distance");
};
