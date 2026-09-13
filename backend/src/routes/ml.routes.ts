import { Router } from "express";
import { mlController } from "../controllers/ml.controller.js";
import { yieldMLController } from "../controllers/yieldML.controller.js";

const router = Router();

/**
 * @route   GET /api/ml/health
 * @desc    Check health and model status of the Python ML inference service
 * @access  Public
 */
router.get("/health", mlController.getHealth);

/**
 * @route   POST /api/ml/predict/:hiveId
 * @desc    Trigger real-time ML inference for a hive
 * @access  Public / Beekeeper
 */
router.post("/predict/:hiveId", mlController.predictHiveHealth);

/**
 * @route   GET /api/ml/predictions/:hiveId
 * @desc    Get paginated historical predictions for a hive
 * @access  Public
 */
router.get("/predictions/:hiveId", mlController.getPredictions);

/**
 * @route   GET /api/ml/latest/:hiveId
 * @desc    Get latest prediction for a hive
 * @access  Public
 */
router.get("/latest/:hiveId", mlController.getLatestPrediction);

/* =======================================================
   Yield Production & Harvest Window Prediction Endpoints
   ======================================================= */

/**
 * @route   GET /api/ml/yield/health
 * @desc    Check health of the deployed Yield & Harvest Window ML microservice
 * @access  Public
 */
router.get("/yield/health", yieldMLController.getHealth);

/**
 * @route   POST /api/ml/yield/predict/:hiveId
 * @desc    Trigger harvest window & honey yield prediction with Gemini LLM reasoning
 * @access  Public / Beekeeper
 */
router.post("/yield/predict/:hiveId", yieldMLController.predictHarvestYield);

/**
 * @route   GET /api/ml/yield/latest/:hiveId
 * @desc    Get latest harvest window & honey yield prediction for a hive
 * @access  Public
 */
router.get("/yield/latest/:hiveId", yieldMLController.getLatestYield);

/**
 * @route   GET /api/ml/yield/predictions/:hiveId
 * @desc    Get historical harvest window & honey yield predictions for a hive
 * @access  Public
 */
router.get("/yield/predictions/:hiveId", yieldMLController.getYieldPredictions);

export default router;
