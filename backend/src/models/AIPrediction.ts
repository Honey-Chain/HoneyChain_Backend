import mongoose, { Schema, Document, Types } from "mongoose";

export interface IInputWindowSummary {
  startTime: Date;
  endTime: Date;
  sampleCount: number;
  featureSummary?: Record<string, any>;
}

export interface IAIPredictionResult {
  status: "normal" | "warning" | "critical" | "inconclusive";
  riskScore?: number; // 0 to 1
  healthScore?: number; // 0 to 100
  estimatedYieldKg?: number;
  detectedAnomalies?: string[];
  probableCauses?: string[];
  recommendedActions?: string[];
  metricsSnapshot?: Record<string, any>;

  // Model 1: Hive Health & Disease Risk Inference fields
  tier?: "T1" | "T6" | "T12" | "T24" | "T36" | "T48" | null;
  stressRisk?: "LOW" | "MEDIUM" | "HIGH" | null;
  stressProbability?: number | null;
  abnormalityRisk?: number | null;
  stressBasis?: "classifier" | "anomaly" | null;
  detectionScope?: string[];
  hoursAvailable?: number;
  hoursObserved?: number;
  drivers?: {
    activityDeviation?: number | null;
    temperatureDeviation?: number | null;
    netFlow?: number | null;
    weightTrend?: number | null;
    weightDrop?: number | null;
    [key: string]: any;
  };
  recommendation?: string;
  caveat?: string;

  // Model 2: Yield & Harvest Window Inference fields
  expectedHarvestWindowDays?: number;
  harvestWindowRange?: string;
  minDays?: number;
  maxDays?: number;
  daysIntoFlow?: number;
  gainRate7d?: number;
  flowState?: string;
  confidenceTier?: string;
  modelNote?: string;
}

export interface IGeminiAnalysis {
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
  rawResponse?: string;
  generatedAt?: Date;
  modelUsed?: string;
  error?: string;
}

export interface IAIPrediction extends Document {
  predictionId: string;
  targetType: "hive" | "batch" | "apiary";
  hive?: Types.ObjectId;
  hiveId?: string;
  batch?: Types.ObjectId;
  batchId?: string;
  apiary?: Types.ObjectId;
  apiaryId?: string;
  predictionType:
    | "colony_health"
    | "disease_risk"
    | "productivity_yield"
    | "swarming_risk"
    | "adulteration_anomaly";
  modelVersion: string;
  confidence: number; // 0 to 1
  predictionTimestamp: Date;
  inputWindow?: IInputWindowSummary;
  result: IAIPredictionResult;
  gemini?: IGeminiAnalysis;
  status: "active" | "acknowledged" | "resolved" | "dismissed";
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InputWindowSummarySchema = new Schema<IInputWindowSummary>(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    sampleCount: { type: Number, required: true, min: 1 },
    featureSummary: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const AIPredictionResultSchema = new Schema<IAIPredictionResult>(
  {
    status: {
      type: String,
      enum: ["normal", "warning", "critical", "inconclusive"],
      required: true,
      default: "normal",
    },
    riskScore: { type: Number, min: 0, max: 1 },
    healthScore: { type: Number, min: 0, max: 100 },
    estimatedYieldKg: { type: Number, min: 0 },
    detectedAnomalies: { type: [String], default: [] },
    probableCauses: { type: [String], default: [] },
    recommendedActions: { type: [String], default: [] },
    metricsSnapshot: { type: Schema.Types.Mixed, default: {} },

    // Model 1: Hive Health & Disease Risk Inference fields
    tier: {
      type: String,
      enum: ["T1", "T6", "T12", "T24", "T36", "T48", null],
      default: null,
    },
    stressRisk: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", null],
      default: null,
    },
    stressProbability: { type: Number, min: 0, max: 1 },
    abnormalityRisk: { type: Number, min: 0, max: 100 },
    stressBasis: {
      type: String,
      enum: ["classifier", "anomaly", null],
      default: null,
    },
    detectionScope: { type: [String], default: [] },
    hoursAvailable: { type: Number },
    hoursObserved: { type: Number },
    drivers: { type: Schema.Types.Mixed, default: {} },
    recommendation: { type: String },
    caveat: { type: String },

    // Model 2: Yield & Harvest Window Inference fields
    expectedHarvestWindowDays: { type: Number },
    harvestWindowRange: { type: String },
    minDays: { type: Number },
    maxDays: { type: Number },
    daysIntoFlow: { type: Number },
    gainRate7d: { type: Number },
    flowState: { type: String },
    confidenceTier: { type: String },
    modelNote: { type: String },
  },
  { _id: false }
);

const GeminiAnalysisSchema = new Schema<IGeminiAnalysis>(
  {
    triggered: { type: Boolean, default: false },
    triggerReason: { type: String },
    status: { type: String },
    severity: { type: String, enum: ["low", "medium", "high", "critical"] },
    summary: { type: String },
    possibleFactors: { type: [String], default: [] },
    sensorEvidence: { type: [String], default: [] },
    weatherImpact: { type: String },
    recommendedAction: { type: String },
    urgency: { type: String, enum: ["low", "medium", "high", "immediate"] },
    rawResponse: { type: String },
    generatedAt: { type: Date },
    modelUsed: { type: String },
    error: { type: String },
  },
  { _id: false }
);

const AIPredictionSchema = new Schema<IAIPrediction>(
  {
    predictionId: {
      type: String,
      required: [true, "predictionId is required"],
      unique: true,
      trim: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["hive", "batch", "apiary"],
      required: true,
      index: true,
    },
    hive: {
      type: Schema.Types.ObjectId,
      ref: "Hive",
      required: false,
      index: true,
    },
    hiveId: {
      type: String,
      trim: true,
      required: false,
      index: true,
    },
    batch: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
      required: false,
      index: true,
    },
    batchId: {
      type: String,
      trim: true,
      required: false,
      index: true,
    },
    apiary: {
      type: Schema.Types.ObjectId,
      ref: "Apiary",
      required: false,
      index: true,
    },
    apiaryId: {
      type: String,
      trim: true,
      required: false,
      index: true,
    },
    predictionType: {
      type: String,
      enum: [
        "colony_health",
        "disease_risk",
        "productivity_yield",
        "swarming_risk",
        "adulteration_anomaly",
      ],
      required: true,
      index: true,
    },
    modelVersion: {
      type: String,
      required: [true, "modelVersion is required"],
      trim: true,
    },
    confidence: {
      type: Number,
      required: [true, "confidence score is required"],
      min: [0, "Confidence cannot be less than 0"],
      max: [1, "Confidence cannot exceed 1"],
    },
    predictionTimestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    inputWindow: {
      type: InputWindowSummarySchema,
    },
    result: {
      type: AIPredictionResultSchema,
      required: true,
    },
    gemini: {
      type: GeminiAnalysisSchema,
      default: () => ({ triggered: false }),
    },
    status: {
      type: String,
      enum: ["active", "acknowledged", "resolved", "dismissed"],
      default: "active",
      index: true,
    },
    acknowledgedBy: { type: String, trim: true },
    acknowledgedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes for dashboards and alerts
AIPredictionSchema.index({ hiveId: 1, predictionTimestamp: -1 });
AIPredictionSchema.index({ hiveId: 1, "gemini.triggered": 1, predictionTimestamp: -1 });
AIPredictionSchema.index({ batchId: 1, predictionTimestamp: -1 });
AIPredictionSchema.index({ predictionType: 1, status: 1, predictionTimestamp: -1 });

export const AIPrediction = mongoose.model<IAIPrediction>(
  "AIPrediction",
  AIPredictionSchema
);
export default AIPrediction;
