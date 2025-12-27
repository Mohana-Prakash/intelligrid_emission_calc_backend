import * as service from "../services/emissionFactor.service.js";

export const getByActivity = async (req, res) => {
  const data = await service.fetchByActivity(req.query.activity);
  res.json(data);
};

export const bulkInsert = async (req, res) => {
  const result = await service.insertMany(req.body);
  res.json(result);
};

export const updateByScopeId = async (req, res) => {
  const updated = await service.update(req.params.scope_id, req.body);
  res.json(updated);
};

export const deleteByScopeId = async (req, res) => {
  await service.remove(req.params.scope_id);
  res.status(204).send();
};
