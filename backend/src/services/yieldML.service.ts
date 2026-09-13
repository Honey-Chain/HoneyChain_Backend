// backend/src/services/yieldML.service.ts
import { env } from "../config/env.js";
import { SensorReading, Hive, Apiary, AIPrediction } from "../models/index.js";
import { weatherService } from "./weather.service.js";
import { geminiService, type HarvestYieldGeminiInput, type IHarvestYieldAnalysis } from "./gemini.service.js";
import AppError from "../utils/AppError.js";

export interface DailyTelemetryItem {
  timestamp: string; // "YYYY-MM-DD"
  weight: number;
  temperature: number;
  humidity: number;
  flow: number;
}

export interface YieldMLHealth {
  healthy: boolean;
  service: string;
  modelLoaded: boolean;
  modelVersion: string;
  serviceUrl: string;
  error?: string;
}

export interface YieldPredictionResponse {
  success: boolean;
  hiveId: string;
  predictionId?: string;
  flowState: "active_flow" | "plateauing" | "post_flow" | "pre_flow";
  daysIntoFlow: number;
  expectedHarvestWindowDays: number;
  harvestWindowRange: string;
  minDays: number;
  maxDays: number;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  estimatedYieldKg: number;
  gainRate7d: number;
  totalWeightGain14d: number;
  currentWeight: number;
  modelNote?: string;
  geminiAnalysis: IHarvestYieldAnalysis;
  metricsSnapshot: {
    telemetryDaysCount: number;
    firstDay: string;
    latestDay: string;
    avgTemp: number;
    avgHumidity: number;
    avgDailyFlow: number;
  };
}

export class YieldMLService {
  private serviceUrl: string;
  private timeoutMs: number;

  constructor() {
    this.serviceUrl = env.YIELD_ML_SERVICE_URL || "https://honeychain-yield-ml.onrender.com";
    this.timeoutMs = parseInt(env.ML_TIMEOUT_MS || "15000", 10) || 15000;
  }

  /**
   * Checks the health and availability of the deployed Yield ML microservice.
   */
  public async checkHealth(): Promise<YieldMLHealth> {
    try {
      const res = await fetch(`${this.serviceUrl}/health`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (res.ok) {
        const body = (await res.json()) as any;
        return {
          healthy: body.status === "healthy",
          service: body.service || "HoneyChain Yield Production ML Microservice",
          modelLoaded: body.model_loaded === true,
          modelVersion: body.model_version || "yield-production-v1",
          serviceUrl: this.serviceUrl,
        };
      }
      return {
        healthy: false,
        service: "HoneyChain Yield Production ML Microservice",
        modelLoaded: false,
        modelVersion: "unknown",
        serviceUrl: this.serviceUrl,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err: any) {
      return {
        healthy: false,
        service: "HoneyChain Yield Production ML Microservice",
        modelLoaded: false,
        modelVersion: "unknown",
        serviceUrl: this.serviceUrl,
        error: err.message,
      };
    }
  }

  /**
   * Formats a date into a YYYY-MM-DD string according to local hive timezone.
   */
  public formatLocalDate(date: Date, offsetMinutes: number = 330): string {
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const localMs = utcMs + offsetMinutes * 60000;
    const localDate = new Date(localMs);

    const pad = (n: number) => String(n).padStart(2, "0");
    const year = localDate.getFullYear();
    const month = pad(localDate.getMonth() + 1);
    const day = pad(localDate.getDate());

    return `${year}-${month}-${day}`;
  }

  /**
   * Aggregates raw SensorReading documents into daily historical readings for the ML model.
   * Expects at least 6 daily points; 14+ days provides full feature computation.
   */
  public async prepareDailyHistory(
    hiveId: string,
    offsetMinutes: number = 330
  ): Promise<{
    dailyHistory: DailyTelemetryItem[];
    summary: {
      daysAnalyzed: number;
      avgTemp: number;
      avgHumidity: number;
      avgDailyFlow: number;
      startWeight: number;
      latestWeight: number;
      totalWeightGain14d: number;
      gainRate7d: number;
      firstDay: string;
      latestDay: string;
    };
  }> {
    // Look back up to 21 days to ensure we capture full 14 calendar days of telemetry
    const twentyOneDaysAgo = new Date(Date.now() - 21 * 86400 * 1000);
    const readings = await SensorReading.find({
      hiveId,
      timestamp: { $gte: twentyOneDaysAgo },
    })
      .sort({ timestamp: 1 })
      .lean();

    if (!readings || readings.length === 0) {
      throw new AppError(`No telemetry readings found for hive '${hiveId}'. At least 6 days are required.`, 400);
    }

    // Bucket by local date (YYYY-MM-DD)
    const dayBuckets: Record<string, {
      weights: number[];
      temps: number[];
      humidities: number[];
      flows: number[];
    }> = {};

    for (const r of readings) {
      const dateObj = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
      const dayKey = this.formatLocalDate(dateObj, offsetMinutes);

      if (!dayBuckets[dayKey]) {
        dayBuckets[dayKey] = { weights: [], temps: [], humidities: [], flows: [] };
      }

      const wt = Number(r.weightKg ?? (r as any).weight);
      if (!isNaN(wt) && wt > 0) dayBuckets[dayKey].weights.push(wt);

      const temp = Number(r.ambientTemperature ?? r.temperature);
      if (!isNaN(temp)) dayBuckets[dayKey].temps.push(temp);

      const hum = Number(r.ambientHumidity ?? r.humidity);
      if (!isNaN(hum)) dayBuckets[dayKey].humidities.push(hum);

      let flow = 0;
      if (typeof r.flow === "number") {
        flow = r.flow;
      } else if (typeof r.beeInCount === "number" && typeof r.beeOutCount === "number") {
        flow = r.beeInCount - r.beeOutCount;
      }
      dayBuckets[dayKey].flows.push(flow);
    }

    const sortedDays = Object.keys(dayBuckets).sort();
    if (sortedDays.length < 6) {
      throw new AppError(
        `Insufficient telemetry history: Hive '${hiveId}' has only ${sortedDays.length} day(s) of data. Minimum 6 days (recommended 14 days) required for yield prediction.`,
        400
      );
    }

    // Keep the most recent 14-16 days
    const activeDays = sortedDays.slice(-16);
    const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const dailyHistory: DailyTelemetryItem[] = activeDays.map((dayKey) => {
      const b = dayBuckets[dayKey];
      return {
        timestamp: dayKey,
        weight: Number(avg(b.weights).toFixed(3)),
        temperature: Number(avg(b.temps).toFixed(1)),
        humidity: Number(avg(b.humidities).toFixed(1)),
        flow: Math.round(avg(b.flows)),
      };
    });

    // Compute summary dynamics
    const startWeight = dailyHistory[0].weight;
    const latestWeight = dailyHistory[dailyHistory.length - 1].weight;
    const totalWeightGain14d = Number((latestWeight - startWeight).toFixed(3));

    // Calculate recent 7-day gain rate
    const last7Days = dailyHistory.slice(-7);
    let gainRate7d = 0;
    if (last7Days.length >= 2) {
      const w0 = last7Days[0].weight;
      const w1 = last7Days[last7Days.length - 1].weight;
      gainRate7d = Number(((w1 - w0) / (last7Days.length - 1)).toFixed(3));
    }

    const avgTemp = Number(avg(dailyHistory.map((d) => d.temperature)).toFixed(1));
    const avgHumidity = Number(avg(dailyHistory.map((d) => d.humidity)).toFixed(1));
    const avgDailyFlow = Math.round(avg(dailyHistory.map((d) => d.flow)));

    return {
      dailyHistory,
      summary: {
        daysAnalyzed: dailyHistory.length,
        avgTemp,
        avgHumidity,
        avgDailyFlow,
        startWeight,
        latestWeight,
        totalWeightGain14d,
        gainRate7d,
        firstDay: dailyHistory[0].timestamp,
        latestDay: dailyHistory[dailyHistory.length - 1].timestamp,
      },
    };
  }

  /**
   * Evaluates active nectar flow duration based on 7-day moving average weight gain rate.
   * In apiculture, a nectar flow begins when daily gain reaches >= 0.20 kg/day.
   */
  public calculateDaysIntoFlow(dailyHistory: DailyTelemetryItem[]): {
    daysIntoFlow: number;
    flowState: "active_flow" | "plateauing" | "post_flow" | "pre_flow";
  } {
    if (dailyHistory.length < 2) {
      return { daysIntoFlow: 0, flowState: "pre_flow" };
    }

    // Track consecutive days where recent weight gain rate is positive and robust
    let consecutiveFlowDays = 0;
    for (let i = 1; i < dailyHistory.length; i++) {
      const diff = dailyHistory[i].weight - dailyHistory[i - 1].weight;
      if (diff >= 0.15) {
        consecutiveFlowDays++;
      } else if (diff < -0.05 && consecutiveFlowDays > 0) {
        // slight dip does not reset if overall trend is positive
        consecutiveFlowDays = Math.max(0, consecutiveFlowDays - 1);
      }
    }

    const last3Days = dailyHistory.slice(-3);
    const recent3dGain = last3Days.length >= 2
      ? (last3Days[last3Days.length - 1].weight - last3Days[0].weight) / (last3Days.length - 1)
      : 0;

    let flowState: "active_flow" | "plateauing" | "post_flow" | "pre_flow" = "active_flow";

    if (consecutiveFlowDays >= 5 && recent3dGain < 0.10) {
      flowState = "plateauing";
    } else if (consecutiveFlowDays >= 3) {
      flowState = "active_flow";
    } else if (consecutiveFlowDays < 2) {
      flowState = "pre_flow";
    }

    // Bound between 3 and 45 days
    const daysIntoFlow = Math.max(3, Math.min(45, consecutiveFlowDays || 12));
    return { daysIntoFlow, flowState };
  }

  /**
   * Executes harvest window prediction and LLM apicultural decision support for a hive.
   */
  public async predictForHive(
    hiveId: string,
    options: { persist?: boolean; forceAi?: boolean } = { persist: true, forceAi: true }
  ): Promise<YieldPredictionResponse> {
    const cleanHiveId = hiveId.trim();
    const hive = await Hive.findOne({ hiveId: cleanHiveId }).lean();
    if (!hive) {
      throw new AppError(`Hive '${cleanHiveId}' not found in registry.`, 404);
    }

    // 1. Prepare 14-day aggregated daily telemetry history
    const { dailyHistory, summary } = await this.prepareDailyHistory(cleanHiveId);

    // 2. Determine active days into flow
    const { daysIntoFlow, flowState } = this.calculateDaysIntoFlow(dailyHistory);

    // 3. Request ML inference from deployed Yield microservice
    let mlResult: any;
    try {
      const payload = {
        hiveId: cleanHiveId,
        days_into_flow: daysIntoFlow,
        margin: 5,
        history: dailyHistory,
      };

      const res = await fetch(`${this.serviceUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as any;
        throw new Error(errBody.message || `Microservice HTTP ${res.status}`);
      }

      mlResult = await res.json();
    } catch (err: any) {
      console.warn(`[YieldMLService] Call to ${this.serviceUrl} failed: ${err.message}. Generating resilient fallback.`);
      // Resilient fallback based on apicultural physics (weight velocity)
      const remainingDays = summary.gainRate7d > 0.4
        ? Math.round(Math.max(6, 20 - daysIntoFlow))
        : Math.round(Math.max(4, 14 - daysIntoFlow));
      mlResult = {
        success: true,
        status: "OK",
        prediction: {
          expectedHarvestWindowDays: remainingDays,
          harvestWindowRange: `${Math.max(3, remainingDays - 4)}-${remainingDays + 5} days`,
          minDays: Math.max(3, remainingDays - 4),
          maxDays: remainingDays + 5,
        },
        confidence: "MEDIUM",
        note: `Generated by apicultural rate model: ${err.message}`,
      };
    }

    const expectedHarvestWindowDays = mlResult.prediction?.expectedHarvestWindowDays ?? 10;
    const harvestWindowRange = mlResult.prediction?.harvestWindowRange ?? `${expectedHarvestWindowDays - 4}-${expectedHarvestWindowDays + 5} days`;
    const minDays = mlResult.prediction?.minDays ?? Math.max(2, expectedHarvestWindowDays - 4);
    const maxDays = mlResult.prediction?.maxDays ?? expectedHarvestWindowDays + 5;
    const confidence = mlResult.confidence ?? "LOW";

    // 4. Fetch weather for apiary
    let weather = null;
    try {
      if (hive.apiary) {
        const apiary = await Apiary.findById(hive.apiary).lean();
        if (apiary?.location?.latitude && apiary?.location?.longitude) {
          weather = await weatherService.getWeather(apiary.location.latitude, apiary.location.longitude);
        }
      }
    } catch (wErr: any) {
      console.warn(`[YieldMLService] Weather lookup skipped for hive ${cleanHiveId}:`, wErr.message);
    }

    // 5. Run Gemini AI Apicultural Decision Support
    const geminiInput: HarvestYieldGeminiInput = {
      hiveId: cleanHiveId,
      triggerReason: "HARVEST_WINDOW_YIELD_PREDICTION",
      flowState,
      expectedHarvestWindowDays,
      harvestWindowRange,
      minDays,
      maxDays,
      daysIntoFlow,
      gainRate7d: summary.gainRate7d,
      totalWeightGain14d: summary.totalWeightGain14d,
      currentWeight: summary.latestWeight,
      confidence,
      note: mlResult.note,
      historySummary: {
        daysAnalyzed: summary.daysAnalyzed,
        avgTemp: summary.avgTemp,
        avgHumidity: summary.avgHumidity,
        avgDailyFlow: summary.avgDailyFlow,
        startWeight: summary.startWeight,
        latestWeight: summary.latestWeight,
      },
      weather,
    };

    const geminiAnalysis = await geminiService.analyzeHarvestYield(geminiInput);
    const estimatedYieldKg = geminiAnalysis.estimatedYieldKg ?? Number(Math.max(4.0, summary.totalWeightGain14d * 0.72).toFixed(1));

    // 6. Persist prediction in MongoDB if requested
    let predictionId = `YIELD-${cleanHiveId}-${Date.now()}`;
    if (options.persist !== false) {
      try {
        const newPrediction = new AIPrediction({
          predictionId,
          targetType: "hive",
          hive: hive._id,
          hiveId: cleanHiveId,
          predictionType: "productivity_yield",
          modelVersion: "yield-production-v1",
          confidence: confidence === "HIGH" ? 0.9 : confidence === "MEDIUM" ? 0.75 : 0.6,
          predictionTimestamp: new Date(),
          inputWindow: {
            startTime: new Date(summary.firstDay),
            endTime: new Date(summary.latestDay),
            sampleCount: summary.daysAnalyzed,
            featureSummary: {
              daysIntoFlow,
              flowState,
              totalWeightGain14d: summary.totalWeightGain14d,
              gainRate7d: summary.gainRate7d,
              currentWeight: summary.latestWeight,
            },
          },
          result: {
            status: "normal",
            healthScore: 90,
            estimatedYieldKg,
            expectedHarvestWindowDays,
            harvestWindowRange,
            minDays,
            maxDays,
            daysIntoFlow,
            gainRate7d: summary.gainRate7d,
            flowState,
            confidenceTier: confidence,
            modelNote: mlResult.note,
            recommendedActions: geminiAnalysis.actionableSteps || [geminiAnalysis.recommendedAction || "Inspect supers."],
            metricsSnapshot: {
              telemetryDaysCount: summary.daysAnalyzed,
              latestTelemetryTimestamp: summary.latestDay,
              totalWeightGain14d: summary.totalWeightGain14d,
            },
          },
          gemini: geminiAnalysis,
          status: "active",
        });

        await newPrediction.save();
        predictionId = newPrediction.predictionId;
      } catch (saveErr: any) {
        console.warn(`[YieldMLService] Could not persist AIPrediction for ${cleanHiveId}:`, saveErr.message);
      }
    }

    return {
      success: true,
      hiveId: cleanHiveId,
      predictionId,
      flowState,
      daysIntoFlow,
      expectedHarvestWindowDays,
      harvestWindowRange,
      minDays,
      maxDays,
      confidence,
      estimatedYieldKg,
      gainRate7d: summary.gainRate7d,
      totalWeightGain14d: summary.totalWeightGain14d,
      currentWeight: summary.latestWeight,
      modelNote: mlResult.note,
      geminiAnalysis,
      metricsSnapshot: {
        telemetryDaysCount: summary.daysAnalyzed,
        firstDay: summary.firstDay,
        latestDay: summary.latestDay,
        avgTemp: summary.avgTemp,
        avgHumidity: summary.avgHumidity,
        avgDailyFlow: summary.avgDailyFlow,
      },
    };
  }

  /**
   * Retrieves the latest yield prediction for a hive.
   */
  public async getLatestPrediction(hiveId: string): Promise<any | null> {
    const cleanHiveId = hiveId.trim();
    return AIPrediction.findOne({
      hiveId: cleanHiveId,
      predictionType: "productivity_yield",
    })
      .sort({ predictionTimestamp: -1 })
      .lean();
  }

  /**
   * Retrieves historical paginated yield predictions for a hive.
   */
  public async getPredictionsByHive(
    hiveId: string,
    limit = 10,
    page = 1
  ): Promise<{ predictions: any[]; total: number; page: number; pages: number }> {
    const cleanHiveId = hiveId.trim();
    const query: any = { hiveId: cleanHiveId, predictionType: "productivity_yield" };
    const skip = (page - 1) * limit;

    const [predictions, total] = await Promise.all([
      AIPrediction.find(query).sort({ predictionTimestamp: -1 }).skip(skip).limit(limit).lean(),
      AIPrediction.countDocuments(query),
    ]);

    return {
      predictions,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }
}

export const yieldMLService = new YieldMLService();
export default yieldMLService;
