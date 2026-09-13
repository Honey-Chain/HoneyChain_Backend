// src/components/telemetry/HarvestYieldCard.tsx
"use client";

import React from "react";
import {
  IconCalendarTime,
  IconSparkles,
  IconRefresh,
  IconScale,
  IconDroplet,
  IconActivity,
  IconCheck,
  IconSun,
  IconInfoCircle,
} from "@tabler/icons-react";
import type { HarvestYieldData } from "@/types/prediction";

interface HarvestYieldCardProps {
  hiveId: string;
  yieldData: HarvestYieldData | null;
  loading: boolean;
  isAnalyzing: boolean;
  onRunPrediction: () => Promise<void>;
  errorMessage?: string | null;
}

export default function HarvestYieldCard({
  hiveId,
  yieldData,
  loading,
  isAnalyzing,
  onRunPrediction,
  errorMessage,
}: HarvestYieldCardProps) {
  const raw: any = yieldData || {};
  const gemini = raw.geminiAnalysis || raw.gemini;

  const currentWeight = Number(
    raw.currentWeight ??
    raw.inputWindow?.featureSummary?.currentWeight ??
    raw.result?.metricsSnapshot?.currentWeight ??
    0
  );
  const totalWeightGain14d = Number(
    raw.totalWeightGain14d ??
    raw.inputWindow?.featureSummary?.totalWeightGain14d ??
    raw.result?.metricsSnapshot?.totalWeightGain14d ??
    0
  );
  const gainRate7d = Number(
    raw.gainRate7d ??
    raw.result?.gainRate7d ??
    raw.inputWindow?.featureSummary?.gainRate7d ??
    0
  );
  const expectedHarvestWindowDays = Number(
    raw.expectedHarvestWindowDays ??
    raw.result?.expectedHarvestWindowDays ??
    10
  );
  const harvestWindowRange = String(
    raw.harvestWindowRange ||
    raw.result?.harvestWindowRange ||
    (expectedHarvestWindowDays > 0 ? `${Math.max(3, expectedHarvestWindowDays - 4)}-${expectedHarvestWindowDays + 5} days` : "10-20 days")
  );
  const estimatedYieldKg = Number(
    raw.estimatedYieldKg ??
    raw.result?.estimatedYieldKg ??
    gemini?.estimatedYieldKg ??
    0
  );
  const daysIntoFlow = Number(
    raw.daysIntoFlow ??
    raw.result?.daysIntoFlow ??
    raw.inputWindow?.featureSummary?.daysIntoFlow ??
    0
  );
  const confidence = String(
    raw.confidence ||
    raw.result?.confidenceTier ||
    "MEDIUM"
  );

  return (
    <section className="scroll-mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-white/4 sm:p-7">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-black/5 pb-5 dark:border-white/5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400">
            <IconCalendarTime size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-ink dark:text-ink-dark">
                AI Harvest Window & Yield Forecast
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-honey/10 px-2.5 py-0.5 text-[10px] font-semibold text-honey">
                <IconSparkles size={11} />
                LightGBM + Gemini
              </span>
            </div>
            <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
              Machine learning harvest timing predictor based on 14-day continuous nectar flow velocity
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRunPrediction}
          disabled={isAnalyzing}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconRefresh size={15} className={isAnalyzing ? "animate-spin" : ""} />
          {isAnalyzing ? "Forecasting Yield…" : yieldData ? "Update Forecast" : "Predict Harvest"}
        </button>
      </div>

      {errorMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
          <IconInfoCircle size={16} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Loading state */}
      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-amber-500 border-t-transparent" />
          <p className="mt-4 text-sm font-semibold text-ink dark:text-ink-dark">
            Computing 14-Day Nectar Flow Dynamics…
          </p>
          <p className="mt-1 max-w-sm text-xs text-black/50 dark:text-white/50">
            Evaluating daily weight gain acceleration and consulting Gemini decision support for comb capping readiness.
          </p>
        </div>
      ) : loading && !yieldData ? (
        <div className="flex items-center justify-center py-10 text-xs text-black/50 dark:text-white/50">
          <IconRefresh size={16} className="mr-2 animate-spin text-honey" />
          Loading harvest forecast for {hiveId}…
        </div>
      ) : !yieldData ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <IconScale size={32} className="text-black/30 dark:text-white/30" />
          <h3 className="mt-3 text-sm font-semibold text-ink dark:text-ink-dark">
            No Harvest Window Prediction Yet
          </h3>
          <p className="mt-1 max-w-md text-xs text-black/50 dark:text-white/50">
            Click &quot;Predict Harvest&quot; to analyze 14 days of hive telemetry and receive an AI-powered harvest date range and honey yield estimate.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Key Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* 1. Expected Harvest Window */}
            <div className="rounded-xl border border-black/5 bg-black/[0.015] p-4.5 dark:border-white/5 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                  Optimal Harvest Window
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {confidence} Confidence
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">
                  {harvestWindowRange}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-black/50 dark:text-white/50">
                Target: ~{expectedHarvestWindowDays} days remaining in nectar flow
              </p>
            </div>

            {/* 2. Estimated Surplus Honey */}
            <div className="rounded-xl border border-black/5 bg-black/[0.015] p-4.5 dark:border-white/5 dark:bg-white/[0.02]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                Surplus Honey Yield
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  {isNaN(estimatedYieldKg) ? "0.0" : estimatedYieldKg.toFixed(1)} kg
                </span>
                <span className="text-xs font-medium text-black/50 dark:text-white/50">
                  extractable surplus
                </span>
              </div>
              <p className="mt-1 text-[11px] text-black/50 dark:text-white/50">
                Gross weight: {isNaN(currentWeight) ? "0.0" : currentWeight.toFixed(1)} kg (+{isNaN(totalWeightGain14d) ? "0.0" : totalWeightGain14d.toFixed(1)} kg in 14d)
              </p>
            </div>

            {/* 3. Nectar Flow Velocity */}
            <div className="rounded-xl border border-black/5 bg-black/[0.015] p-4.5 dark:border-white/5 dark:bg-white/[0.02]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                Nectar Flow Intake
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  +{isNaN(gainRate7d) ? "0.00" : gainRate7d.toFixed(2)}
                </span>
                <span className="text-xs font-medium text-black/50 dark:text-white/50">
                  kg / day (7d avg)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-black/50 dark:text-white/50">
                Active flow duration: {daysIntoFlow} days
              </p>
            </div>

            {/* 4. Honey Capping Progress */}
            <div className="rounded-xl border border-black/5 bg-black/[0.015] p-4.5 dark:border-white/5 dark:bg-white/[0.02]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                Ripening & Capping
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-base font-bold text-ink dark:text-ink-dark">
                  {gemini?.harvestReadiness ? String(gemini.harvestReadiness).replace(/_/g, " ") : "ACTIVE FLOW"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-black/50 dark:text-white/50">
                Target moisture: &lt; 18.5%
              </p>
            </div>
          </div>

          {/* Gemini AI Apicultural Decision Support Section */}
          {gemini && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 p-5 dark:border-amber-500/15 dark:bg-amber-950/15">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
                  <IconSparkles size={16} />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                      Gemini Apicultural Harvest Assessment
                    </h3>
                    <p className="mt-1 text-xs text-amber-950/80 dark:text-amber-200/80">
                      {gemini.summary}
                    </p>
                  </div>

                  {/* Recommendations & Capping Detail */}
                  <div className="grid gap-3 pt-1 text-xs sm:grid-cols-2">
                    {gemini.cappingProgressEstimate && (
                      <div className="rounded-lg bg-white/70 p-3 shadow-2xs dark:bg-white/5">
                        <div className="flex items-center gap-1.5 font-semibold text-ink dark:text-ink-dark">
                          <IconDroplet size={14} className="text-honey" />
                          Comb Capping & Moisture
                        </div>
                        <p className="mt-1 text-[11px] text-black/60 dark:text-white/60">
                          {gemini.cappingProgressEstimate}
                        </p>
                      </div>
                    )}

                    {gemini.supersRecommendation && (
                      <div className="rounded-lg bg-white/70 p-3 shadow-2xs dark:bg-white/5">
                        <div className="flex items-center gap-1.5 font-semibold text-ink dark:text-ink-dark">
                          <IconScale size={14} className="text-honey" />
                          Super Space & Extraction
                        </div>
                        <p className="mt-1 text-[11px] text-black/60 dark:text-white/60">
                          {gemini.supersRecommendation}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Weather impact */}
                  {gemini.weatherImpact && (
                    <div className="flex items-center gap-2 rounded-lg bg-white/50 px-3 py-2 text-[11px] text-black/60 dark:bg-white/5 dark:text-white/60">
                      <IconSun size={14} className="text-amber-500 shrink-0" />
                      <span>{gemini.weatherImpact}</span>
                    </div>
                  )}

                  {/* Actionable Steps */}
                  {Array.isArray(gemini.actionableSteps) && gemini.actionableSteps.length > 0 && (
                    <div className="pt-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-950/70 dark:text-amber-300/70">
                        Actionable Beekeeper Checklist Before Extraction
                      </h4>
                      <ul className="mt-1.5 space-y-1 text-xs text-amber-950/90 dark:text-amber-200/90">
                        {gemini.actionableSteps.map((step: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <IconCheck size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
