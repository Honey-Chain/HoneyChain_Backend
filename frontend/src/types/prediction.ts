export type PredictionStatus =
  | "HEALTHY"
  | "VARROA_STRESS"
  | "SWARMING_RISK"
  | "QUEEN_ABSENT"
  | "FEEDING_REQUIRED"
  | "COLD_STRESS";

export interface PredictionMetrics {
  temperature: number;
  humidity: number;
  weightKg: number;
  soundFrequencyHz?: number;
  beeFlow?: number;
}

export interface GeminiAnalysis {
  triggered: boolean;
  triggerReason?: string;
  status?: string;
  severity?: "low" | "medium" | "high" | "critical";
  summary?: string;
  possibleFactors?: string[];
  sensorEvidence?: string[];
  weatherImpact?: string;
  recommendedAction?: string;
  urgency?: "low" | "medium" | "high" | "immediate";
  generatedAt?: string | Date;
  modelUsed?: string;
  error?: string;
}

export interface PredictionResult {
  status: "normal" | "warning" | "critical" | "inconclusive" | string;
  riskScore?: number;
  healthScore?: number;
  tier?: string;
  stressRisk?: string;
  stressProbability?: number;
  abnormalityRisk?: number;
  stressBasis?: string;
  drivers?: Record<string, any>;
  recommendation?: string;
  detectedAnomalies?: string[];
  recommendedActions?: string[];
  metricsSnapshot?: Record<string, any>;
}

export interface Prediction {
  _id?: string;
  predictionId?: string;
  hiveId: string;
  tier?: string;
  status?: PredictionStatus | string;
  confidence?: number;
  healthScore?: number;
  anomalyDetected?: boolean;
  anomaliesDetected?: string[];
  alerts?: string[];
  recommendations?: string[];
  drivers?: any;
  metricsSnapshot?: PredictionMetrics;
  timestamp?: number | string;
  predictionTimestamp?: string;
  result?: PredictionResult;
  gemini?: GeminiAnalysis;
  createdAt?: string;
}

export interface ModelOutput {
  rawPrediction: unknown;
  probabilities: Record<string, number>;
  tierUsed: string;
  featuresExtracted: Record<string, unknown>;
  healthScore?: number;
  tier?: string;
  stressRisk?: string;
  recommendation?: string;
}

export interface MLPredictionResponse {
  success: boolean;
  status: "OK" | string;
  message?: string;
  data: {
    prediction: Prediction;
    modelOutput?: ModelOutput;
    geminiAnalysis?: GeminiAnalysis;
  } | null;
}

export interface HistoricalPrediction {
  _id: string;
  hiveId: string;
  tier: string;
  status: PredictionStatus;
  confidence: number;
  metricsSnapshot: PredictionMetrics;
  createdAt: string;
}

export interface HistoricalPredictionsResponse {
  success: boolean;
  data: {
    hiveId: string;
    predictions: HistoricalPrediction[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  };
}

export interface LatestPredictionResponse {
  success: boolean;
  data: Prediction & {
    _id: string;
    createdAt: string;
  };
}

export interface HarvestYieldData {
  predictionId?: string;
  hiveId: string;
  flowState?: "active_flow" | "plateauing" | "post_flow" | "pre_flow" | string;
  daysIntoFlow: number;
  expectedHarvestWindowDays: number;
  harvestWindowRange: string;
  minDays: number;
  maxDays: number;
  confidence: "LOW" | "MEDIUM" | "HIGH" | string;
  estimatedYieldKg: number;
  gainRate7d: number;
  totalWeightGain14d: number;
  currentWeight: number;
  modelNote?: string;
  geminiAnalysis?: {
    triggered: boolean;
    summary?: string;
    estimatedYieldKg?: number;
    harvestReadiness?: string;
    cappingProgressEstimate?: string;
    supersRecommendation?: string;
    weatherImpact?: string;
    recommendedAction?: string;
    actionableSteps?: string[];
    urgency?: string;
    generatedAt?: string;
    modelUsed?: string;
  };
  metricsSnapshot?: {
    telemetryDaysCount: number;
    firstDay: string;
    latestDay: string;
    avgTemp: number;
    avgHumidity: number;
    avgDailyFlow: number;
  };
}

export interface HarvestYieldResponse {
  success: boolean;
  status?: string;
  data: HarvestYieldData | null;
  message?: string;
}