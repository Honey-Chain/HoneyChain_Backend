// backend/src/controllers/yieldML.controller.ts
import { Request, Response, NextFunction } from "express";
import { yieldMLService } from "../services/yieldML.service.js";
import AppError from "../utils/AppError.js";

export class YieldMLController {
  /**
   * GET /api/ml/yield/health
   * Checks health of the deployed Yield & Harvest Window ML microservice.
   */
  public getHealth = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const health = await yieldMLService.checkHealth();
      return res.status(health.healthy ? 200 : 503).json({
        success: health.healthy,
        data: health,
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * POST /api/ml/yield/predict/:hiveId
   * Triggers real-time harvest window & honey yield prediction with Gemini LLM insights.
   */
  public predictHarvestYield = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { hiveId } = req.params;
      if (!hiveId || typeof hiveId !== "string" || !hiveId.trim()) {
        return next(new AppError("Valid hiveId parameter is required", 400));
      }

      const persist = req.query.persist !== "false";
      const forceAi = req.query.forceAi === "true" || req.body?.forceAi === true;

      const result = await yieldMLService.predictForHive(hiveId, { persist, forceAi });

      return res.status(200).json({
        success: true,
        status: "OK",
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * GET /api/ml/yield/latest/:hiveId
   * Retrieves the most recent yield prediction for a hive.
   */
  public getLatestYield = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { hiveId } = req.params;
      if (!hiveId || typeof hiveId !== "string" || !hiveId.trim()) {
        return next(new AppError("Valid hiveId parameter is required", 400));
      }

      const prediction = await yieldMLService.getLatestPrediction(hiveId);
      if (!prediction) {
        return res.status(200).json({
          success: true,
          data: null,
          message: `No yield predictions found for hive '${hiveId}'`,
        });
      }

      return res.status(200).json({
        success: true,
        data: prediction,
      });
    } catch (err) {
      return next(err);
    }
  };

  /**
   * GET /api/ml/yield/predictions/:hiveId
   * Retrieves paginated historical yield predictions for a hive.
   */
  public getYieldPredictions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { hiveId } = req.params;
      if (!hiveId || typeof hiveId !== "string" || !hiveId.trim()) {
        return next(new AppError("Valid hiveId parameter is required", 400));
      }

      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);

      const result = await yieldMLService.getPredictionsByHive(hiveId, limit, page);

      return res.status(200).json({
        success: true,
        data: result.predictions,
        pagination: {
          page: result.page,
          pages: result.pages,
          total: result.total,
          limit,
        },
      });
    } catch (err) {
      return next(err);
    }
  };
}

export const yieldMLController = new YieldMLController();
export default yieldMLController;
