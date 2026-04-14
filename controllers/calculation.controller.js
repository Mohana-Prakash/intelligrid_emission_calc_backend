import * as calculationService from "../services/calculation.service.js";
import * as historyService from "../services/fetchCalculation.service.js";

/**
 * @swagger
 * /api/v1/calculate/emission:
 *   post:
 *     summary: Calculate carbon emission using DEFRA factors
 *     description: >
 *       Stateless emission calculation API.
 *       On success, calculation history is stored automatically.
 *     tags:
 *       - Emission Calculation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scope_id
 *               - trip_type
 *               - calculator_type
 *               - leg_type
 *               - user_id
 *             properties:
 *               scope_id:
 *                 type: string
 *                 example: car_petrol_medium_km
 *               distance:
 *                 type: number
 *                 example: 100
 *                 description: Required for all modes except flight
 *               trip_type:
 *                 type: string
 *                 enum: [single_trip, round_trip]
 *               passengers:
 *                 type: number
 *                 example: 2
 *                 description: Required for flight
 *               origin:
 *                 type: string
 *                 example: BLR
 *               destination:
 *                 type: string
 *                 example: DEL
 *               calculator_type:
 *                 type: string
 *                 example: DEFRA
 *               leg_type:
 *                 type: string
 *                 example: single_leg
 *               user_id:
 *                 type: string
 *                 example: USER_001
 *     responses:
 *       200:
 *         description: Emission calculated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Emission factor not found
 *       500:
 *         description: Internal server error
 */
export const calculateEmission = async (req, res) => {
  const result = await calculationService.calculate(req.body);
  res.json(result);
};

/**
 * @swagger
 * /api/v1/calculate/history:
 *   get:
 *     summary: Fetch emission calculation history
 *     description: Fetch stored calculation history for a user
 *     tags:
 *       - Emission Calculation
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           example: USER_001
 *       - in: query
 *         name: calculator_type
 *         schema:
 *           type: string
 *           example: DEFRA
 *     responses:
 *       200:
 *         description: Calculation history fetched successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Internal server error
 */
export const fetchCalculationHistory = async (req, res) => {
  const result = await historyService.fetchHistory(req.query);
  res.json(result);
};
