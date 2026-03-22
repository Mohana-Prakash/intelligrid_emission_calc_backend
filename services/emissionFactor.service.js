import EmissionFactor from "../models/EmissionFactor.js";

// export const fetchByActivity = (activity) => {
//   return EmissionFactor.find(activity ? { activity } : {});
// };

export const fetchByActivity = (activity) => {
  return EmissionFactor.find(
    activity ? { "activity_attributes.activity": activity } : {},
  );
};

export const insertMany = async (records) => {
  const inserted = await EmissionFactor.insertMany(records, { ordered: false });
  return { inserted: inserted.length };
};

export const update = (scope_id, data) => {
  return EmissionFactor.findOneAndUpdate({ scope_id }, data, { new: true });
};

export const remove = (scope_id) => {
  return EmissionFactor.deleteOne({ scope_id });
};
