// backend/src/services/gemini.service.ts
import { env } from "../config/env.js";
import type { HiveWeatherData } from "./weather.service.js";
import type { IGeminiAnalysis } from "../models/AIPrediction.js";

export interface SensorMetricSummary {
  min: number;
  max: number;
  avg: number;
  latest: number;
  trend: "rising" | "falling" | "stable";
}

export interface Sensor48hSummary {
  sampleCount: number;
  windowStart: Date;
  windowEnd: Date;
  temperature: SensorMetricSummary;
  humidity: SensorMetricSummary;
  weight: SensorMetricSummary & { netChangeKg: number };
  flow?: {
    totalIn?: number;
    totalOut?: number;
    netFlow?: number;
    latest?: number;
  };
  acoustics?: {
    avgFrequencyHz?: number;
    latestFrequencyHz?: number;
    avgDb?: number;
  };
}

export interface GeminiAnalysisInput {
  hiveId: string;
  triggerReason: string;
  currentPrediction: {
    healthScore: number;
    status: string;
    confidence: number;
    tier?: string | null;
    drivers?: Record<string, any>;
    stressRisk?: string | null;
  };
  predictionHistory: Array<{
    timestamp: Date;
    healthScore: number;
    status: string;
  }>;
  sensorSummary: Sensor48hSummary;
  weather?: HiveWeatherData | null;
}

export interface HarvestYieldGeminiInput {
  hiveId: string;
  triggerReason?: string;
  flowState?: string;
  expectedHarvestWindowDays: number;
  harvestWindowRange: string;
  minDays: number;
  maxDays: number;
  daysIntoFlow: number;
  gainRate7d: number;
  totalWeightGain14d: number;
  currentWeight: number;
  confidence: string;
  note?: string;
  historySummary: {
    daysAnalyzed: number;
    avgTemp: number;
    avgHumidity: number;
    avgDailyFlow: number;
    startWeight: number;
    latestWeight: number;
    dailyGains?: number[];
  };
  weather?: HiveWeatherData | null;
}

export interface IHarvestYieldAnalysis extends IGeminiAnalysis {
  estimatedYieldKg?: number;
  harvestReadiness?: string;
  cappingProgressEstimate?: string;
  supersRecommendation?: string;
  actionableSteps?: string[];
}

export class GeminiService {
  private apiKey?: string;
  private model: string;
  private timeoutMs = 30000;

  constructor() {
    this.apiKey = env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() ? env.GEMINI_API_KEY.trim() : undefined;
    this.model = env.GEMINI_MODEL || "gemini-2.5-flash";
  }

  /**
   * Builds the prompt instructing Gemini on apiculture domain rules, data, and schema.
   */
  private buildPrompt(input: GeminiAnalysisInput): string {
    const {
      hiveId,
      triggerReason,
      currentPrediction,
      predictionHistory,
      sensorSummary,
      weather,
    } = input;

    const historyLines =
      predictionHistory.length > 0
        ? predictionHistory
            .slice(-12)
            .map(
              (p) =>
                `  - ${new Date(p.timestamp).toISOString().slice(11, 19)} UTC: HealthScore=${p.healthScore}, Status=${p.status}`
            )
            .join("\n")
        : "  - (No prior predictions recorded in the past 24h)";

    const weatherText = weather
      ? `Current Local Weather:
  - Temperature: ${weather.temperature}°C
  - Relative Humidity: ${weather.humidity}%
  - Rain / Precipitation: ${weather.rain} mm
  - Wind Speed: ${weather.windSpeed} km/h
  - Condition: ${weather.condition}`
      : "Current Local Weather: Unavailable / Not provided";

    return `
You are an expert apiculture AI veterinary and sensor reasoning system assisting beekeepers on the HoneyChain platform.
You are analyzing hive "${hiveId}" which was flagged for reasoning due to trigger: "${triggerReason}".

=== 1. CURRENT ML MODEL PREDICTION ===
- Model Tier: ${currentPrediction.tier || "T48 (48h Window)"}
- Health Score: ${currentPrediction.healthScore} / 100
- Status: ${currentPrediction.status}
- Confidence: ${(currentPrediction.confidence * 100).toFixed(1)}%
- Stress Risk: ${currentPrediction.stressRisk || "N/A"}
- Model Drivers: ${JSON.stringify(currentPrediction.drivers || {})}

=== 2. RECENT 24H PREDICTION TIMELINE ===
${historyLines}

=== 3. 48-HOUR SENSOR ROLLING WINDOW AGGREGATES ===
- Window: ${sensorSummary.windowStart.toISOString()} to ${sensorSummary.windowEnd.toISOString()} (${sensorSummary.sampleCount} readings)
- Brood Nest Temperature (°C): min=${sensorSummary.temperature.min}, max=${sensorSummary.temperature.max}, avg=${sensorSummary.temperature.avg}, latest=${sensorSummary.temperature.latest}, trend=${sensorSummary.temperature.trend}
- Internal Relative Humidity (%): min=${sensorSummary.humidity.min}, max=${sensorSummary.humidity.max}, avg=${sensorSummary.humidity.avg}, latest=${sensorSummary.humidity.latest}, trend=${sensorSummary.humidity.trend}
- Hive Weight (kg): min=${sensorSummary.weight.min}, max=${sensorSummary.weight.max}, netChange=${sensorSummary.weight.netChangeKg > 0 ? "+" : ""}${sensorSummary.weight.netChangeKg}kg, latest=${sensorSummary.weight.latest}, trend=${sensorSummary.weight.trend}
${
  sensorSummary.flow
    ? `- Bee Flow / Foraging: totalIn=${sensorSummary.flow.totalIn ?? "N/A"}, totalOut=${sensorSummary.flow.totalOut ?? "N/A"}, netFlow=${sensorSummary.flow.netFlow ?? "N/A"}`
    : ""
}
${
  sensorSummary.acoustics
    ? `- Acoustics: avgFreq=${sensorSummary.acoustics.avgFrequencyHz ?? "N/A"}Hz, avgDb=${sensorSummary.acoustics.avgDb ?? "N/A"}dB`
    : ""
}

=== 4. AMBIENT WEATHER CONDITIONS ===
${weatherText}

=== INSTRUCTIONS & CONSTRAINTS ===
1. NEVER invent or hallucinate sensor readings, weather values, or dates.
2. Distinguish the ML prediction from your own biological deduction.
3. Explain why the colony appears healthy, stressed, warning, or critical based on the physical data.
4. Identify supporting evidence (e.g. brood nest hypothermia, sudden weight loss indicating potential swarming or honey theft, high humidity fostering chalkbrood/fungal pathogens).
5. DO NOT claim that a disease or pest infestation is confirmed. Explicitly treat your analysis as an AI-assisted decision-support assessment.
6. Provide concrete, practical beekeeper actions (e.g., inspect brood frame, check food reserves, ventilate entrance).
7. Return ONLY a valid JSON object strictly matching this schema:

{
  "status": "normal" | "warning" | "critical",
  "severity": "low" | "medium" | "high" | "critical",
  "summary": "Brief 1-2 sentence executive assessment of colony condition.",
  "possibleFactors": [
    "string factor 1",
    "string factor 2"
  ],
  "sensorEvidence": [
    "string evidence 1 citing specific metrics",
    "string evidence 2"
  ],
  "weatherImpact": "Explanation of how ambient weather interacts with hive metrics (or 'Weather data not available').",
  "recommendedAction": "Clear actionable recommendation for the beekeeper.",
  "urgency": "low" | "medium" | "high" | "immediate"
}
`.trim();
  }

  /**
   * Generates rule-based heuristic assessment if Gemini API is unreachable, suspended, or fails.
   */
  private generateFallbackAnalysis(
    input: GeminiAnalysisInput,
    errorMessage?: string
  ): IGeminiAnalysis {
    const { currentPrediction, sensorSummary, triggerReason, weather } = input;
    const score = currentPrediction.healthScore;
    const status = currentPrediction.status;

    let severity: "low" | "medium" | "high" | "critical" = "medium";
    let urgency: "low" | "medium" | "high" | "immediate" = "medium";
    const factors: string[] = [];
    const evidence: string[] = [];

    if (score < 40 || status === "critical") {
      severity = "critical";
      urgency = "immediate";
      factors.push("Severe biological stress detected by ML classifier");
    } else if (score < 70 || status === "warning") {
      severity = "medium";
      urgency = "medium";
      factors.push("Moderate colony stress deviation from baseline");
    } else {
      severity = "low";
      urgency = "low";
    }

    if (sensorSummary.temperature.min < 32) {
      factors.push("Brood nest temperature drop below optimal brood threshold (32°C)");
      evidence.push(`Temperature fell to ${sensorSummary.temperature.min}°C (optimal is 34-35°C)`);
    } else if (sensorSummary.temperature.max > 37.5) {
      factors.push("Brood nest hyperthermia risk (>37.5°C)");
      evidence.push(`Temperature reached high of ${sensorSummary.temperature.max}°C`);
    }

    if (sensorSummary.weight.netChangeKg < -1.5) {
      factors.push("Sudden colony weight reduction (potential swarming or robbing)");
      evidence.push(`48-hour net weight loss of ${Math.abs(sensorSummary.weight.netChangeKg)} kg`);
    }

    if (sensorSummary.humidity.latest > 75) {
      factors.push("Elevated hive humidity creating fungal or condensation risk");
      evidence.push(`Current internal humidity at ${sensorSummary.humidity.latest}%`);
    }

    if (factors.length === 0) {
      factors.push("Colony metrics within acceptable dynamic boundaries");
      evidence.push(`Brood nest temperature stable around ${sensorSummary.temperature.avg}°C`);
    }

    const weatherImpact = weather
      ? `Ambient conditions (${weather.temperature}°C, ${weather.condition}, rain: ${weather.rain}mm) may influence entrance foraging activity.`
      : "Weather data was unavailable during this evaluation.";

    const action =
      severity === "critical"
        ? "Perform an urgent physical brood box inspection within 12-24 hours to check queen viability and hive stores."
        : severity === "medium"
        ? "Schedule an apiary check within 48 hours to monitor entrance flow and verify moisture levels."
        : "Maintain standard inspection schedule; colony telemetry remains in balance.";

    return {
      triggered: true,
      triggerReason,
      status,
      severity,
      summary: `AI colony assessment: Health score is ${score}/100 (${status}). ${factors[0]}.`,
      possibleFactors: factors,
      sensorEvidence: evidence,
      weatherImpact,
      recommendedAction: action,
      urgency,
      generatedAt: new Date(),
      modelUsed: "heuristic-fallback-reasoner",
      error: errorMessage,
    };
  }

  /**
   * Calls Gemini API and returns structured apiculture decision support analysis.
   * Completely resilient: falls back safely to heuristic reasoning on network/key errors.
   */
  public async analyzeHiveHealth(
    input: GeminiAnalysisInput
  ): Promise<IGeminiAnalysis> {
    if (!this.apiKey) {
      console.warn("[GeminiService] GEMINI_API_KEY not configured. Using heuristic reasoning engine.");
      return this.generateFallbackAnalysis(input, "GEMINI_API_KEY not configured");
    }

    const prompt = this.buildPrompt(input);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      let responseToUse = res;
      let modelUsed = this.model;

      if (!responseToUse.ok && (responseToUse.status === 503 || responseToUse.status === 404 || responseToUse.status === 429) && this.model !== "gemini-2.5-flash") {
        console.log(`[GeminiService] Model '${this.model}' returned HTTP ${responseToUse.status}. Retrying with stable 'gemini-2.5-flash'...`);
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;
        try {
          const fallbackRes = await fetch(fallbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
            signal: AbortSignal.timeout(this.timeoutMs),
          });
          if (fallbackRes.ok) {
            responseToUse = fallbackRes;
            modelUsed = "gemini-2.5-flash";
          }
        } catch (fallbackErr: any) {
          console.warn("[GeminiService] Secondary model fallback failed:", fallbackErr.message);
        }
      }

      if (!responseToUse.ok) {
        const errorText = await responseToUse.text().catch(() => "");
        console.warn(
          `[GeminiService] Gemini API returned HTTP ${responseToUse.status}: ${errorText.slice(0, 150)}`
        );
        return this.generateFallbackAnalysis(
          input,
          `Gemini API returned HTTP ${responseToUse.status}: ${errorText.slice(0, 120)}`
        );
      }

      const json = (await responseToUse.json()) as any;
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        return this.generateFallbackAnalysis(input, "Gemini returned empty response text");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr: any) {
        console.warn("[GeminiService] Could not parse Gemini JSON response:", parseErr.message);
        return this.generateFallbackAnalysis(input, `JSON parse error: ${parseErr.message}`);
      }

      return {
        triggered: true,
        triggerReason: input.triggerReason,
        status: parsed.status || input.currentPrediction.status,
        severity: parsed.severity || "medium",
        summary: parsed.summary || "AI decision-support analysis generated.",
        possibleFactors: Array.isArray(parsed.possibleFactors) ? parsed.possibleFactors : [],
        sensorEvidence: Array.isArray(parsed.sensorEvidence) ? parsed.sensorEvidence : [],
        weatherImpact: parsed.weatherImpact || "No direct adverse weather impact reported.",
        recommendedAction: parsed.recommendedAction || "Inspect hive as needed.",
        urgency: parsed.urgency || "medium",
        rawResponse: rawText,
        generatedAt: new Date(),
        modelUsed: modelUsed,
      };
    } catch (err: any) {
      console.warn(`[GeminiService] Error contacting Gemini: ${err.message}`);
      return this.generateFallbackAnalysis(input, `Error contacting Gemini: ${err.message}`);
    }
  }

  /**
   * Builds the prompt instructing Gemini on apiculture honey yield, nectar flow dynamics, and harvest planning.
   */
  private buildHarvestYieldPrompt(input: HarvestYieldGeminiInput): string {
    const {
      hiveId,
      expectedHarvestWindowDays,
      harvestWindowRange,
      minDays,
      maxDays,
      daysIntoFlow,
      gainRate7d,
      totalWeightGain14d,
      currentWeight,
      confidence,
      note,
      historySummary,
      weather,
    } = input;

    const weatherText = weather
      ? `Current Local Weather:
  - Ambient Temperature: ${weather.temperature}°C
  - Ambient Humidity: ${weather.humidity}%
  - Rain / Precipitation: ${weather.rain} mm
  - Wind Speed: ${weather.windSpeed} km/h
  - Sky Condition: ${weather.condition}`
      : "Current Local Weather: Standard seasonal conditions (no acute weather alerts reported)";

    return `
You are an expert master apiarist and honey harvest optimization specialist on the HoneyChain platform.
You are evaluating hive "${hiveId}" during active honey flow season to determine precise harvest timing, honey quality, comb capping progress, and surplus yield projection.

=== 1. MACHINE LEARNING HARVEST WINDOW PREDICTION ===
- Expected Remaining Flow Window: ${expectedHarvestWindowDays} days (${harvestWindowRange})
- Lower Bound: ${minDays} days | Upper Bound: ${maxDays} days
- Active Days Into Current Nectar Flow: ${daysIntoFlow} days
- 7-Day Net Weight Gain Velocity: ${gainRate7d.toFixed(2)} kg/day
- Total 14-Day Weight Gain: +${totalWeightGain14d.toFixed(2)} kg
- Current Gross Hive Mass: ${currentWeight.toFixed(2)} kg
- Model Confidence Tier: ${confidence}
- Model Operational Caveat: ${note || "Typical error margin +/-5 days"}

=== 2. 14-DAY APICULTURAL METRICS & SENSOR SUMMARY ===
- Telemetry Duration: ${historySummary.daysAnalyzed} days of continuous sensor monitoring
- Mean Brood Nest Temperature: ${historySummary.avgTemp.toFixed(1)}°C (norm 34-35°C)
- Mean Internal Humidity: ${historySummary.avgHumidity.toFixed(1)}% (ideal curing 55-65%)
- Mean Daily Foraging Bee Traffic: ${historySummary.avgDailyFlow.toFixed(0)} bees/min
- Initial Weight (14d ago): ${historySummary.startWeight.toFixed(2)} kg -> Current Weight: ${historySummary.latestWeight.toFixed(2)} kg

=== 3. LOCAL WEATHER CONDITIONS ===
${weatherText}

=== INSTRUCTIONS & CONSTRAINTS ===
1. NEVER hallucinate raw data outside the provided telemetry and prediction.
2. Estimate the extractable surplus honey (in kilograms) based on the 14-day weight gain minus hive maintenance reserve.
3. Assess honey comb capping readiness (bees cap cells when moisture drops below 18-19%).
4. Give specific guidance on adding supers vs preparing the honey extractor.
5. Return ONLY a valid JSON object strictly matching this schema:

{
  "status": "normal" | "warning" | "critical",
  "severity": "low" | "medium" | "high",
  "summary": "Concise 2-sentence executive summary of harvest readiness and colony foraging state.",
  "estimatedYieldKg": 14.5,
  "harvestReadiness": "OPTIMAL_SOON" | "ACTIVE_FLOW" | "PLATEAUING" | "HARVEST_READY",
  "cappingProgressEstimate": "e.g. Approximately 65-75% capped, moisture reducing to target 17.5%",
  "supersRecommendation": "Actionable recommendation regarding adding or clearing honey supers",
  "weatherImpact": "Impact of ambient weather on remaining nectar flow days",
  "possibleFactors": [
    "factor 1",
    "factor 2"
  ],
  "sensorEvidence": [
    "evidence 1 citing specific metrics",
    "evidence 2"
  ],
  "recommendedAction": "Primary immediate instruction for the beekeeper",
  "actionableSteps": [
    "Step 1: Inspect outer honey frames in upper super",
    "Step 2: Check refractometer moisture level before spinning",
    "Step 3: Ensure uncapped nectar is not mixed with cured frames"
  ],
  "urgency": "low" | "medium" | "high"
}
`.trim();
  }

  /**
   * Generates rule-based heuristic harvest analysis if Gemini API is unreachable or fails.
   */
  private generateHarvestYieldFallback(
    input: HarvestYieldGeminiInput,
    errorMessage?: string
  ): IHarvestYieldAnalysis {
    const {
      expectedHarvestWindowDays,
      totalWeightGain14d,
      currentWeight,
      gainRate7d,
      daysIntoFlow,
      historySummary,
    } = input;

    // Surplus yield estimate: 70-75% of net flow gain
    const surplusGain = Math.max(3.0, totalWeightGain14d * 0.72);
    const estimatedYieldKg = Number(Math.min(35.0, Math.max(4.0, surplusGain)).toFixed(1));

    let harvestReadiness = "ACTIVE_FLOW";
    let status: "normal" | "warning" | "critical" = "normal";
    let urgency: "low" | "medium" | "high" = "low";

    if (expectedHarvestWindowDays <= 5) {
      harvestReadiness = "HARVEST_READY";
      urgency = "high";
    } else if (expectedHarvestWindowDays <= 9) {
      harvestReadiness = "OPTIMAL_SOON";
      urgency = "medium";
    } else if (gainRate7d < 0.15 && daysIntoFlow > 14) {
      harvestReadiness = "PLATEAUING";
      urgency = "medium";
    }

    const cappingPct = Math.min(90, Math.max(35, Math.round(40 + daysIntoFlow * 2.5)));

    return {
      triggered: true,
      triggerReason: input.triggerReason || "HARVEST_YIELD_PREDICTION",
      status,
      severity: "low",
      summary: `Colony has gained +${totalWeightGain14d.toFixed(1)} kg over 14 days with expected harvest window in ${input.harvestWindowRange}. Foraging and brood temperatures remain favorable for nectar ripening.`,
      estimatedYieldKg,
      harvestReadiness,
      cappingProgressEstimate: `Estimated ~${cappingPct}% comb capping completed across honey supers. Honey moisture trending toward 17-18%.`,
      supersRecommendation:
        currentWeight > 42
          ? "Hive mass indicates high super fill. Inspect upper frames for capping; prepare extraction line."
          : "Keep existing supers in place to allow bees to complete ripening and cell capping.",
      weatherImpact: "Current ambient temperature and humidity support steady nectar evaporation and curing.",
      possibleFactors: [
        `Active nectar flow of ${gainRate7d.toFixed(2)} kg/day`,
        `Colony thermoregulation stable at ${historySummary.avgTemp.toFixed(1)}°C`,
      ],
      sensorEvidence: [
        `14-day cumulative weight change: +${totalWeightGain14d.toFixed(2)} kg`,
        `Recent 7-day velocity: ${gainRate7d.toFixed(2)} kg/day`,
        `Mean bee foraging flow: ${historySummary.avgDailyFlow.toFixed(0)} bees/min`,
      ],
      recommendedAction:
        expectedHarvestWindowDays <= 7
          ? "Check comb capping on upper supers; extract when at least 75% capped."
          : "Maintain supers and monitor daily weight gain velocity as peak flow tapers.",
      actionableSteps: [
        "1. Inspect honey super frames to confirm minimum 75% wax capping before harvest.",
        "2. Check moisture content with a calibrated refractometer (target < 18.0%).",
        "3. Ensure escape boards or bee brushes are staged for chemical-free bee clearing.",
      ],
      urgency,
      rawResponse: errorMessage ? `Fallback generated due to: ${errorMessage}` : "Generated by rule-based apicultural engine",
      generatedAt: new Date(),
      modelUsed: "honeychain-apiculture-rules-v1",
    };
  }

  /**
   * Generates AI-assisted honey yield, harvest window, and decision support using Gemini.
   */
  public async analyzeHarvestYield(
    input: HarvestYieldGeminiInput
  ): Promise<IHarvestYieldAnalysis> {
    if (!this.apiKey) {
      console.log("[GeminiService] GEMINI_API_KEY not configured. Using apicultural yield fallback.");
      return this.generateHarvestYieldFallback(input, "GEMINI_API_KEY not configured");
    }

    const prompt = this.buildHarvestYieldPrompt(input);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      let res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      let responseToUse = res;
      let modelUsed = this.model;

      if (
        !responseToUse.ok &&
        (responseToUse.status === 503 || responseToUse.status === 404 || responseToUse.status === 429) &&
        this.model !== "gemini-2.5-flash"
      ) {
        console.log(`[GeminiService] Model '${this.model}' returned HTTP ${responseToUse.status}. Retrying harvest yield with 'gemini-2.5-flash'...`);
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`;
        try {
          const fallbackRes = await fetch(fallbackUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
            signal: AbortSignal.timeout(this.timeoutMs),
          });
          if (fallbackRes.ok) {
            responseToUse = fallbackRes;
            modelUsed = "gemini-2.5-flash";
          }
        } catch (fallbackErr: any) {
          console.warn("[GeminiService] Harvest yield secondary fallback failed:", fallbackErr.message);
        }
      }

      if (!responseToUse.ok) {
        const errorText = await responseToUse.text().catch(() => "");
        console.warn(`[GeminiService] Gemini API returned HTTP ${responseToUse.status}: ${errorText.slice(0, 150)}`);
        return this.generateHarvestYieldFallback(input, `Gemini API HTTP ${responseToUse.status}`);
      }

      const json = (await responseToUse.json()) as any;
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        return this.generateHarvestYieldFallback(input, "Gemini returned empty response text");
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch (parseErr: any) {
        console.warn("[GeminiService] Could not parse Gemini harvest JSON response:", parseErr.message);
        return this.generateHarvestYieldFallback(input, `JSON parse error: ${parseErr.message}`);
      }

      const calculatedYield =
        typeof parsed.estimatedYieldKg === "number"
          ? parsed.estimatedYieldKg
          : Number(Math.max(4.0, input.totalWeightGain14d * 0.72).toFixed(1));

      return {
        triggered: true,
        triggerReason: input.triggerReason || "HARVEST_YIELD_PREDICTION",
        status: parsed.status || "normal",
        severity: parsed.severity || "low",
        summary: parsed.summary || "AI harvest window assessment generated.",
        estimatedYieldKg: calculatedYield,
        harvestReadiness: parsed.harvestReadiness || "ACTIVE_FLOW",
        cappingProgressEstimate: parsed.cappingProgressEstimate,
        supersRecommendation: parsed.supersRecommendation,
        weatherImpact: parsed.weatherImpact || "Standard foraging weather observed.",
        possibleFactors: Array.isArray(parsed.possibleFactors) ? parsed.possibleFactors : [],
        sensorEvidence: Array.isArray(parsed.sensorEvidence) ? parsed.sensorEvidence : [],
        recommendedAction: parsed.recommendedAction || "Inspect supers for capping progress.",
        actionableSteps: Array.isArray(parsed.actionableSteps) ? parsed.actionableSteps : [],
        urgency: parsed.urgency || "low",
        rawResponse: rawText,
        generatedAt: new Date(),
        modelUsed: modelUsed,
      };
    } catch (err: any) {
      console.warn(`[GeminiService] Error during harvest yield analysis: ${err.message}`);
      return this.generateHarvestYieldFallback(input, `Error contacting Gemini: ${err.message}`);
    }
  }
}

export const geminiService = new GeminiService();
export default geminiService;
