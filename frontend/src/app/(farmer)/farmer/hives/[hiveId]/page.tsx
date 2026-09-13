// src/app/(farmer)/farmer/hives/[hiveId]/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBattery,
  IconBrain,
  IconCheck,
  IconClock,
  IconDeviceAnalytics,
  IconDroplets,
  IconEdit,
  IconHexagon,
  IconMapPin,
  IconMinus,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconTemperature,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconWeight,
  IconActivity,
} from "@tabler/icons-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

import { hiveService } from "@/services/hive.service";
import { telemetryService } from "@/services/telemetry.service";
import { socketService } from "@/services/socket.service";
import { mlService } from "@/services/ml.service";
import type { Hive, HiveStatus } from "@/types/hive";
import type { TelemetryHistoryPoint } from "@/types/telemetry";
import type { Prediction, HarvestYieldData } from "@/types/prediction";

import TelemetrySimulator from "@/components/telemetry/TelemetrySimulator";
import TelemetryForm from "@/components/telemetry/TelemetryForm";
import PredictionHistory from "@/components/telemetry/PredictionHistory";
import MLHealthIndicator from "@/components/telemetry/MLHealthIndicator";
import RecentTelemetryTable from "@/components/telemetry/RecentTelemetryTable";
import HarvestYieldCard from "@/components/telemetry/HarvestYieldCard";

export default function HiveDetailsPage() {
  const params = useParams<{ hiveId: string }>();
  const router = useRouter();
  const rawHiveId = params.hiveId;
  const hiveId = decodeURIComponent(rawHiveId);

  // Hive details
  const [hive, setHive] = useState<Hive | null>(null);
  const [hiveLoading, setHiveLoading] = useState(true);

  // Telemetry history & live socket stream
  const [telemetry, setTelemetry] = useState<TelemetryHistoryPoint[]>([]);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [activeMetricTab, setActiveMetricTab] = useState<
    "temperature" | "humidity" | "weight" | "flow"
  >("temperature");

  // AI Prediction
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<any[]>([]);
  const [predictionLoading, setPredictionLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // AI Yield & Harvest Window Prediction
  const [yieldData, setYieldData] = useState<HarvestYieldData | null>(null);
  const [yieldLoading, setYieldLoading] = useState(true);
  const [isAnalyzingYield, setIsAnalyzingYield] = useState(false);
  const [yieldError, setYieldError] = useState<string | null>(null);

  // Edit status modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<HiveStatus>("active");
  const [editNotes, setEditNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Error & action states
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadHive = useCallback(async () => {
    try {
      setHiveLoading(true);
      const res = await hiveService.getById(hiveId);
      setHive(res.data);
      if (res.data) {
        setEditStatus(res.data.status);
        setEditNotes(res.data.notes || "");
      }
    } catch {
      setError("Failed to load hive details.");
    } finally {
      setHiveLoading(false);
    }
  }, [hiveId]);

  const loadTelemetry = useCallback(async () => {
    try {
      setTelemetryLoading(true);
      // 1. First fetch latest 10 readings from Redis rolling buffer
      try {
        const recentRes = await telemetryService.getRecent(hiveId);
        if (recentRes?.data && recentRes.data.length > 0) {
          setTelemetry(recentRes.data);
          return;
        }
      } catch {
        // Fallback to MongoDB history if Redis route is unavailable
      }

      // 2. Cold-start fallback
      const res = await telemetryService.getHistory(hiveId, { limit: 10 });
      setTelemetry(res.data || []);
    } catch {
      // Telemetry might be empty for newly created hive
      setTelemetry([]);
    } finally {
      setTelemetryLoading(false);
    }
  }, [hiveId]);

  const loadPrediction = useCallback(async () => {
    try {
      setPredictionLoading(true);
      const [latestRes, historyRes] = await Promise.allSettled([
        mlService.getLatest(hiveId),
        mlService.getHistory(hiveId, 1, 5),
      ]);

      if (latestRes.status === "fulfilled" && latestRes.value?.data) {
        setPrediction(latestRes.value.data);
      } else {
        setPrediction(null);
      }

      if (
        historyRes.status === "fulfilled" &&
        historyRes.value?.data?.predictions
      ) {
        setPredictionHistory(historyRes.value.data.predictions);
      } else {
        setPredictionHistory([]);
      }
    } catch {
      setPrediction(null);
      setPredictionHistory([]);
    } finally {
      setPredictionLoading(false);
    }
  }, [hiveId]);

  const loadYield = useCallback(async () => {
    try {
      setYieldLoading(true);
      const res = await mlService.getLatestYield(hiveId);
      if (res?.data) {
        setYieldData(res.data);
      } else {
        setYieldData(null);
      }
    } catch {
      setYieldData(null);
    } finally {
      setYieldLoading(false);
    }
  }, [hiveId]);

  useEffect(() => {
    loadHive();
    loadTelemetry();
    loadPrediction();
    loadYield();
  }, [loadHive, loadTelemetry, loadPrediction, loadYield]);

  // Periodic heartbeat timer to keep Live / Stale status fresh
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Connect to Socket.IO, join hive room, and receive live telemetry updates
  useEffect(() => {
    const unsubStatus = socketService.onConnectionChange(setIsSocketConnected);
    socketService.joinHive(hiveId);

    const unsubTelemetry = socketService.onTelemetry((newReading) => {
      setTelemetry((prev) => {
        const exists = prev.some(
          (r) =>
            (r.id && newReading.id && r.id === newReading.id) ||
            new Date(r.timestamp).getTime() === new Date(newReading.timestamp).getTime()
        );
        if (exists) return prev;
        const updated = [...prev, newReading];
        return updated.slice(-10);
      });
    });

    return () => {
      unsubStatus();
      unsubTelemetry();
      socketService.leaveHive(hiveId);
    };
  }, [hiveId]);

  // Latest readings from telemetry or prediction
  const latestReading = useMemo(() => {
    if (telemetry.length > 0) {
      return [...telemetry].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
    }
    if (prediction?.metricsSnapshot) {
      return {
        temperature: prediction.metricsSnapshot.temperature,
        humidity: prediction.metricsSnapshot.humidity,
        weightKg: prediction.metricsSnapshot.weightKg,
        flow: prediction.metricsSnapshot.beeFlow,
        beeInCount: prediction.metricsSnapshot.beeFlow ? Math.max(0, prediction.metricsSnapshot.beeFlow) : undefined,
        beeOutCount: prediction.metricsSnapshot.beeFlow ? Math.max(0, -prediction.metricsSnapshot.beeFlow) : undefined,
      } as TelemetryHistoryPoint;
    }
    return null;
  }, [telemetry, prediction]);

  // Live / Stale telemetry indicator based on expected interval (30s)
  const telemetryStatus = useMemo(() => {
    if (!latestReading?.timestamp) {
      return { label: "Awaiting Hardware", color: "bg-gray-400", isLive: false };
    }
    const readingMs = new Date(latestReading.timestamp).getTime();
    if (isNaN(readingMs)) {
      return { label: "Awaiting Hardware", color: "bg-gray-400", isLive: false };
    }
    const ageSeconds = Math.max(0, Math.round((nowMs - readingMs) / 1000));
    if (ageSeconds <= 60) {
      return { label: "Live Stream", color: "bg-emerald-500", isLive: true };
    }
    return {
      label: `Standby (${ageSeconds}s ago)`,
      color: "bg-amber-500",
      isLive: false,
    };
  }, [latestReading, nowMs]);

  // Run AI analysis
  async function runAnalysis() {
    try {
      setIsAnalyzing(true);
      setActionError(null);
      const res = await mlService.predict(hiveId, { forceAi: true });
      const resData = res?.data;
      if (resData?.prediction) {
        const pred = { ...resData.prediction };
        if (!pred.gemini && resData.geminiAnalysis) {
          pred.gemini = resData.geminiAnalysis;
        }
        setPrediction(pred);
      } else if (resData?.geminiAnalysis) {
        const ga = resData.geminiAnalysis;
        setPrediction((prev: any) =>
          prev ? { ...prev, gemini: ga } : ({ gemini: ga } as any)
        );
      }
      await loadPrediction();
      await loadHive();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "AI analysis failed. Ensure IoT readings are ingested first.";
      setActionError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Run Yield & Harvest Window analysis
  async function runYieldPrediction() {
    try {
      setIsAnalyzingYield(true);
      setYieldError(null);
      const res = await mlService.predictYield(hiveId, { forceAi: true });
      if (res?.data) {
        setYieldData(res.data);
      }
      await loadYield();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Yield prediction failed. Ensure sufficient IoT readings are ingested.";
      setYieldError(msg);
    } finally {
      setIsAnalyzingYield(false);
    }
  }

  // 1. Current Hive Health (ML Score & Status)
  const currentHealth = useMemo(() => {
    const score =
      prediction?.result?.healthScore ??
      prediction?.healthScore ??
      hive?.currentHealthSummary?.healthScore ??
      null;

    const rawStatus =
      prediction?.result?.status ||
      prediction?.status ||
      hive?.currentHealthSummary?.status ||
      "healthy";

    const normalizedStatus = String(rawStatus).toLowerCase().replace("_", " ");

    let badgeColor =
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    let statusText = "Healthy Colony";

    if (
      normalizedStatus.includes("critical") ||
      (typeof score === "number" && score <= 40)
    ) {
      badgeColor =
        "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800";
      statusText = "Critical Health Risk";
    } else if (
      normalizedStatus.includes("warning") ||
      normalizedStatus.includes("attention") ||
      normalizedStatus.includes("stress") ||
      (typeof score === "number" && score < 75)
    ) {
      badgeColor =
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800";
      statusText = "Attention Needed";
    }

    return {
      score: score ?? 100,
      statusText,
      badgeColor,
    };
  }, [prediction, hive]);

  // Existing health trend computed from past evaluations
  const healthTrend = useMemo(() => {
    const currentScore =
      prediction?.result?.healthScore ??
      prediction?.healthScore ??
      hive?.currentHealthSummary?.healthScore ??
      null;

    if (currentScore === null || predictionHistory.length < 2) {
      return {
        direction: "stable" as const,
        label: "Stable (Continuous Monitoring)",
        diff: 0,
      };
    }

    const prevScore =
      predictionHistory[1]?.result?.healthScore ??
      predictionHistory[1]?.healthScore ??
      null;

    if (prevScore === null) {
      return {
        direction: "stable" as const,
        label: "Stable Baseline",
        diff: 0,
      };
    }

    const diff = Math.round((currentScore - prevScore) * 10) / 10;
    if (diff > 1) {
      return {
        direction: "up" as const,
        label: `Improving (+${diff} pts)`,
        diff,
      };
    }
    if (diff < -1) {
      return {
        direction: "down" as const,
        label: `Declining (${diff} pts)`,
        diff,
      };
    }
    return {
      direction: "stable" as const,
      label: "Stable (±1 pt)",
      diff,
    };
  }, [prediction, predictionHistory, hive]);

  // 2. AI Hive Insight (Gemini AI Analysis)
  const aiInsight = useMemo(() => {
    const gemini =
      prediction?.gemini && (prediction.gemini.triggered || prediction.gemini.summary)
        ? prediction.gemini
        : hive?.currentHealthSummary?.latestGeminiAnalysis &&
          (hive.currentHealthSummary.latestGeminiAnalysis.triggered ||
            hive.currentHealthSummary.latestGeminiAnalysis.summary)
        ? hive.currentHealthSummary.latestGeminiAnalysis
        : null;

    if (!gemini || !gemini.summary) {
      return null;
    }

    const summary = gemini.summary;
    const factors: string[] = [
      ...(Array.isArray((gemini as any).possibleFactors) ? (gemini as any).possibleFactors : []),
      ...(Array.isArray((gemini as any).sensorEvidence) ? (gemini as any).sensorEvidence : []),
    ];

    const weather = (gemini as any).weatherImpact || null;
    const action =
      gemini.recommendedAction ||
      prediction?.result?.recommendation ||
      prediction?.recommendations?.[0] ||
      null;
    const severity = gemini.severity || "low";
    const urgency = gemini.urgency || "low";
    const timestamp =
      gemini.generatedAt ||
      prediction?.predictionTimestamp ||
      prediction?.createdAt ||
      null;

    return {
      summary,
      factors,
      weather,
      action,
      severity,
      urgency,
      timestamp,
    };
  }, [prediction, hive]);

  // Save hive edits
  async function handleSaveEdit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      setIsSaving(true);
      setActionError(null);
      const res = await hiveService.update(hiveId, {
        status: editStatus,
        notes: editNotes,
      });
      setHive(res.data);
      setIsEditOpen(false);
    } catch {
      setActionError("Failed to update status.");
    } finally {
      setIsSaving(false);
    }
  }

  // Delete hive
  async function handleDeleteHive() {
    if (!window.confirm(`Are you sure you want to delete hive ${hiveId}? This action cannot be undone.`)) {
      return;
    }
    try {
      await hiveService.delete(hiveId);
      router.push("/farmer/hives");
    } catch {
      setActionError("Failed to delete hive.");
    }
  }

  // Format telemetry for charts
  const chartData = useMemo(() => {
    return telemetry.map((pt) => {
      const beeIn = typeof pt.beeInCount === "number" ? pt.beeInCount : null;
      const beeOut = typeof pt.beeOutCount === "number" ? pt.beeOutCount : null;
      const netFlow =
        typeof pt.flow === "number"
          ? pt.flow
          : beeIn !== null && beeOut !== null
          ? beeIn - beeOut
          : 0;

      return {
        time: new Date(pt.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        temperature: pt.temperature,
        humidity: pt.humidity,
        weight: pt.weightKg,
        beeIn: beeIn ?? Math.max(0, netFlow),
        beeOut: beeOut ?? Math.max(0, -netFlow),
        flow: netFlow,
      };
    });
  }, [telemetry]);

  const apiaryName =
    typeof hive?.apiary === "object" ? hive.apiary?.name : hive?.apiaryId;
  const apiaryRegion =
    typeof hive?.apiary === "object" ? hive.apiary?.location?.region : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Link
            href="/farmer/hives"
            className="rounded-xl border border-black/10 p-2 transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
            aria-label="Back to hives"
          >
            <IconArrowLeft size={19} />
          </Link>

          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-honey">
              <IconHexagon size={14} />
              <span>Colony Details</span>
              {apiaryName && (
                <>
                  <span>•</span>
                  <span>{apiaryName}</span>
                </>
              )}
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
              {hiveId}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              loadHive();
              loadTelemetry();
              loadPrediction();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3.5 py-2 text-xs font-medium text-ink transition hover:bg-black/5 dark:border-white/10 dark:bg-white/4 dark:text-ink-dark"
          >
            <IconRefresh size={15} className={hiveLoading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-xs font-medium text-ink transition hover:bg-black/5 dark:border-white/10 dark:bg-white/4 dark:text-ink-dark"
          >
            <IconEdit size={15} />
            Edit Hive
          </button>

          <button
            type="button"
            onClick={handleDeleteHive}
            className="inline-flex items-center gap-1.5 rounded-xl border border-alert/20 bg-alert/5 px-3.5 py-2 text-xs font-medium text-alert transition hover:bg-alert/10"
          >
            <IconTrash size={15} />
            Delete
          </button>
        </div>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl border border-alert/20 bg-alert/5 p-4 text-xs text-alert">
          <IconAlertTriangle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Colony & Hardware Summary Header Card */}
      <section className="grid gap-4 rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-black/50 dark:text-white/50">
            Hive Status
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                hive?.status === "active"
                  ? "bg-emerald-500"
                  : hive?.status === "quarantined"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            />
            <span className="text-base font-semibold capitalize">
              {hive?.status || "active"}
            </span>
          </div>
          <p className="mt-1 text-xs text-black/40 dark:text-white/40">
            {hive?.hiveType || "Langstroth"} • {hive?.beeSpecies || "Apis cerana"}
          </p>
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-black/50 dark:text-white/50">
            Sanctuary Apiary
          </span>
          <div className="mt-2 flex items-center gap-1.5">
            <IconMapPin size={16} className="text-honey" />
            <span className="truncate text-base font-semibold">
              {apiaryName || "Not assigned"}
            </span>
          </div>
          {apiaryRegion && (
            <p className="mt-1 text-xs text-black/40 dark:text-white/40">
              Region: {apiaryRegion}
            </p>
          )}
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-black/50 dark:text-white/50">
            IoT Edge Gateway
          </span>
          <div className="mt-2 flex items-center gap-1.5">
            <IconDeviceAnalytics size={16} className="text-honey" />
            <span className="font-mono text-sm font-semibold">
              {hive?.deviceMetadata?.deviceId || `ESP32-${hiveId}`}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
            <span className="flex items-center gap-1">
              <IconBattery size={13} className="text-emerald-500" />
              {hive?.deviceMetadata?.batteryLevelPct ?? 100}%
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${telemetryStatus.color} ${telemetryStatus.isLive ? "animate-pulse" : ""}`} />
              <span className="font-medium text-ink dark:text-ink-dark">{telemetryStatus.label}</span>
            </span>
          </div>
        </div>

        <div>
          <span className="text-xs font-medium uppercase tracking-wider text-black/50 dark:text-white/50">
            Colony Health Score
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-honey">
              {hive?.currentHealthSummary?.healthScore ?? 100}%
            </span>
            <span className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">
              {hive?.currentHealthSummary?.status?.replace("_", " ") || "healthy"}
            </span>
          </div>
          {hive?.installationDate && (
            <p className="mt-1 text-xs text-black/40 dark:text-white/40">
              Installed: {new Date(hive.installationDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </section>

      {/* Real-time Metric Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Brood Temperature"
          value={latestReading ? latestReading.temperature.toFixed(1) : "—"}
          unit="°C"
          icon={IconTemperature}
          status={
            latestReading && (latestReading.temperature < 33 || latestReading.temperature > 37)
              ? "alert"
              : "normal"
          }
        />

        <MetricCard
          label="Relative Humidity"
          value={latestReading ? latestReading.humidity.toFixed(1) : "—"}
          unit="%"
          icon={IconDroplets}
          status="normal"
        />

        <MetricCard
          label="Hive Net Weight"
          value={latestReading ? latestReading.weightKg.toFixed(1) : "—"}
          unit="kg"
          icon={IconWeight}
          status="normal"
        />

        <MetricCard
          label="Foraging Bee Traffic"
          value={
            latestReading?.beeInCount !== undefined && latestReading?.beeOutCount !== undefined
              ? `+${latestReading.beeInCount} / -${latestReading.beeOutCount}`
              : latestReading?.flow !== undefined
              ? `${latestReading.flow > 0 ? "+" : ""}${latestReading.flow}`
              : "—"
          }
          unit={latestReading?.beeInCount !== undefined ? "in / out" : latestReading?.flow !== undefined ? "net/min" : undefined}
          icon={IconActivity}
          status="normal"
        />
      </section>

      {/* Telemetry Time-Series Charts (Recharts) */}
      <section className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/3">
        <div className="flex flex-col justify-between gap-4 border-b border-black/5 pb-4 dark:border-white/5 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <IconActivity size={20} className="text-honey" />
              <h2 className="font-semibold text-ink dark:text-ink-dark">
                Telemetry Analytics
              </h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                telemetryStatus.isLive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${telemetryStatus.color} ${telemetryStatus.isLive ? "animate-pulse" : ""}`} />
                {telemetryStatus.label}
              </span>
              {isSocketConnected && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-black/40 dark:text-white/40">
                  • Socket.IO Connected
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              Continuous IoT sensor metrics recorded from Edge Gateway {hive?.deviceMetadata?.deviceId || `ESP32-${hiveId}`}
            </p>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-black/2 p-1 dark:border-white/10 dark:bg-white/3">
            {[
              { id: "temperature", label: "Temp (°C)" },
              { id: "humidity", label: "Humidity (%)" },
              { id: "weight", label: "Weight (kg)" },
              { id: "flow", label: "Bee Traffic" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMetricTab(tab.id as any)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  activeMetricTab === tab.id
                    ? "bg-white text-ink shadow-xs dark:bg-white/10 dark:text-ink-dark"
                    : "text-black/50 hover:text-ink dark:text-white/50 dark:hover:text-ink-dark"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chart View */}
        <div className="mt-6">
          {telemetryLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-black/50 dark:text-white/50">
              <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-honey border-t-transparent" />
              Loading telemetry time-series…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-black/10 p-6 text-center dark:border-white/10">
              <IconActivity size={28} className="text-black/30 dark:text-white/30" />
              <h3 className="mt-3 text-sm font-semibold">Awaiting Telemetry Stream</h3>
              <p className="mt-1 max-w-sm text-xs text-black/50 dark:text-white/50">
                Awaiting incoming readings from edge gateway {hive?.deviceMetadata?.deviceId || `ESP32-${hiveId}`}. Once connected, real-time telemetry will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
                    domain={
                      activeMetricTab === "temperature"
                        ? [25, 45]
                        : activeMetricTab === "humidity"
                        ? [30, 90]
                        : ["auto", "auto"]
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(18, 18, 18, 0.9)",
                      borderColor: "rgba(255, 255, 255, 0.15)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      color: "#fff",
                    }}
                  />
                  {activeMetricTab === "temperature" && (
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      name="Temperature (°C)"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {activeMetricTab === "humidity" && (
                    <Line
                      type="monotone"
                      dataKey="humidity"
                      name="Humidity (%)"
                      stroke="#06b6d4"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {activeMetricTab === "weight" && (
                    <Line
                      type="monotone"
                      dataKey="weight"
                      name="Weight (kg)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  )}
                  {activeMetricTab === "flow" && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="beeIn"
                        name="Bees Entering (+in)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="beeOut"
                        name="Bees Leaving (-out)"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="flow"
                        name="Net Flow (in - out)"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Live Telemetry Rolling Buffer Table (Last 10 Readings from Redis) */}
      <RecentTelemetryTable
        readings={telemetry}
        hiveId={hiveId}
        loading={telemetryLoading}
        isSocketConnected={isSocketConnected}
      />

      {/* 
        =======================================================
        HIVE HEALTH & AI HIVE INSIGHT (GEMINI AI DECISION SUPPORT)
        Flow: Hive Health → AI Insight → Recommendation
        =======================================================
      */}
      <section
        id="ai-insight"
        className="scroll-mt-6 rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/4 sm:p-7"
      >
        {/* Section Header with Simple Action Button */}
        <div className="flex flex-col justify-between gap-4 border-b border-black/5 pb-5 dark:border-white/5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-honey/15 p-2.5 text-honey">
              <IconBrain size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink dark:text-ink-dark">
                  AI Hive Health & Insight
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-honey/10 px-2.5 py-0.5 text-[10px] font-semibold text-honey">
                  <IconSparkles size={11} />
                  Gemini Supported
                </span>
              </div>
              <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                Continuous ML colony diagnostics coupled with AI-assisted decision support
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={runAnalysis}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 rounded-xl bg-honey px-4 py-2.5 text-xs font-semibold text-comb shadow-xs transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconRefresh
              size={15}
              className={isAnalyzing ? "animate-spin" : ""}
            />
            {isAnalyzing
              ? "Analyzing Hive…"
              : aiInsight
              ? "Re-analyze"
              : "Analyze with AI"}
          </button>
        </div>

        {/* Loading State during active inference */}
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-honey border-t-transparent" />
            <p className="mt-4 text-sm font-semibold text-ink dark:text-ink-dark">
              Evaluating 48h rolling telemetry…
            </p>
            <p className="mt-1 max-w-sm text-xs text-black/50 dark:text-white/50">
              Querying Hive Health ML baseline and consulting Gemini decision support for current brood conditions.
            </p>
          </div>
        ) : predictionLoading ? (
          <div className="flex items-center justify-center py-10 text-xs text-black/50 dark:text-white/50">
            <IconRefresh size={16} className="mr-2 animate-spin text-honey" />
            Loading colony health assessment…
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* 1. Hive Health (ML Score, Status, Trend) */}
            <div className="grid gap-4 rounded-xl border border-black/5 bg-black/[0.015] p-4.5 dark:border-white/5 dark:bg-white/[0.02] sm:grid-cols-3">
              {/* Health Score */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                  Hive Health Score
                </span>
                <div className="mt-1.5 flex items-baseline gap-2.5">
                  <span className="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
                    {currentHealth.score}%
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${currentHealth.badgeColor}`}
                  >
                    {currentHealth.statusText}
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      currentHealth.score >= 80
                        ? "bg-emerald-500"
                        : currentHealth.score >= 50
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.max(5, Math.min(100, currentHealth.score))}%` }}
                  />
                </div>
              </div>

              {/* Health Trend */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                  Health Trend
                </span>
                <div className="mt-2 flex items-center gap-2">
                  {healthTrend.direction === "up" ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <IconTrendingUp size={16} />
                    </div>
                  ) : healthTrend.direction === "down" ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
                      <IconTrendingDown size={16} />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60">
                      <IconMinus size={16} />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-semibold text-ink dark:text-ink-dark">
                      {healthTrend.label}
                    </p>
                    <p className="text-[11px] text-black/45 dark:text-white/45">
                      Compared to previous evaluations
                    </p>
                  </div>
                </div>
              </div>

              {/* Monitoring Baseline Window */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
                  Diagnostics Model
                </span>
                <p className="mt-2 text-sm font-semibold text-ink dark:text-ink-dark">
                  48-Hour Rolling Window
                </p>
                <p className="text-[11px] text-black/45 dark:text-white/45">
                  {prediction?.tier ? `Tier ${prediction.tier}` : "Automated Hourly"} • Circadian Baseline
                </p>
              </div>
            </div>

            {/* 2. AI Hive Insight & 3. Recommendation */}
            {aiInsight ? (
              <div className="space-y-5">
                {/* Meta Banner: Severity, Urgency & Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 text-xs dark:border-white/5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-black/60 dark:text-white/60">
                      AI Assessment:
                    </span>
                    {aiInsight.severity && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          aiInsight.severity === "critical"
                            ? "bg-red-500/15 text-red-700 dark:text-red-400"
                            : aiInsight.severity === "high"
                            ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                            : aiInsight.severity === "medium"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        Severity: {aiInsight.severity}
                      </span>
                    )}
                    {aiInsight.urgency && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          aiInsight.urgency === "immediate"
                            ? "animate-pulse bg-red-600 text-white"
                            : aiInsight.urgency === "high"
                            ? "bg-orange-500/20 text-orange-800 dark:text-orange-300"
                            : aiInsight.urgency === "medium"
                            ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                            : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"
                        }`}
                      >
                        Urgency: {aiInsight.urgency}
                      </span>
                    )}
                  </div>

                  {aiInsight.timestamp && (
                    <div className="flex items-center gap-1.5 text-black/45 dark:text-white/45">
                      <IconClock size={13} />
                      <span>
                        Analyzed {new Date(aiInsight.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Explanation: What's Happening */}
                <div className="rounded-xl bg-honey/10 p-4.5 text-ink dark:text-ink-dark">
                  <div className="flex items-start gap-3">
                    <IconSparkles size={18} className="mt-0.5 shrink-0 text-honey" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-honey">
                        What&apos;s Happening
                      </h4>
                      <p className="mt-1 text-sm leading-relaxed text-ink/90 dark:text-ink-dark/90">
                        {aiInsight.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Key Contributing Factors */}
                {aiInsight.factors && aiInsight.factors.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-black/60 dark:text-white/60">
                      Key Contributing Factors
                    </h4>
                    <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                      {aiInsight.factors.map((factor, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-xl border border-black/5 bg-black/[0.02] p-3 text-xs text-ink/80 dark:border-white/5 dark:bg-white/[0.02] dark:text-ink-dark/80"
                        >
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-honey" />
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weather Context Impact */}
                {aiInsight.weather && (
                  <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-black/[0.015] px-3.5 py-2.5 text-xs text-black/65 dark:border-white/5 dark:bg-white/[0.02] dark:text-white/65">
                    <span className="font-semibold text-ink dark:text-ink-dark">
                      Local Weather Impact:
                    </span>
                    <span>{aiInsight.weather}</span>
                  </div>
                )}

                {/* 3. Recommended Action */}
                {aiInsight.action && (
                  <div className="rounded-xl border border-honey/30 bg-honey/5 p-4.5 dark:border-honey/20 dark:bg-honey/10">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-honey/20 p-2 text-honey">
                        <IconShieldCheck size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-honey">
                          Recommended Beekeeper Action
                        </h4>
                        <p className="mt-1 text-sm font-medium text-ink dark:text-ink-dark">
                          {aiInsight.action}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* If No AI Analysis Exists Yet */
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/10 p-8 text-center dark:border-white/10">
                <div className="rounded-xl bg-honey/10 p-3 text-honey">
                  <IconBrain size={28} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink dark:text-ink-dark">
                  No AI analysis available yet
                </h3>
                <p className="mt-1 max-w-md text-xs text-black/50 dark:text-white/50">
                  No AI analysis available yet. Analyze this hive to get an AI-assisted assessment.
                </p>
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={isAnalyzing}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-honey px-4 py-2 text-xs font-semibold text-comb shadow-xs transition hover:brightness-95 disabled:opacity-50"
                >
                  <IconRefresh size={14} className={isAnalyzing ? "animate-spin" : ""} />
                  Analyze with AI
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* AI Harvest Window & Yield Forecast (LightGBM + Gemini) */}
      <HarvestYieldCard
        hiveId={hiveId}
        yieldData={yieldData}
        loading={yieldLoading}
        isAnalyzing={isAnalyzingYield}
        onRunPrediction={runYieldPrediction}
        errorMessage={yieldError}
      />

      {/* Historical Predictions */}
      <PredictionHistory hiveId={hiveId} />

      {/* Ingestion & Simulation Controls */}
      <div className="space-y-6">
        <TelemetryForm
          hiveId={hiveId}
          onSubmitted={async () => {
            await loadTelemetry();
            await loadPrediction();
            await loadYield();
            await loadHive();
          }}
        />

        <TelemetrySimulator />
      </div>

      {/* Edit Hive Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-black/10 bg-paper p-6 shadow-2xl dark:border-white/10 dark:bg-paper-dark">
            <h3 className="text-lg font-bold text-ink dark:text-ink-dark">
              Edit Hive Status
            </h3>
            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
              Update colony status or operational notes for {hiveId}.
            </p>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink/70 dark:text-ink-dark/70">
                  Colony Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-black/15 bg-transparent p-2.5 text-xs text-ink outline-none focus:border-honey dark:border-white/15 dark:text-ink-dark"
                >
                  <option value="active">Active</option>
                  <option value="quarantined">Quarantined</option>
                  <option value="inactive">Inactive</option>
                  <option value="collapsed">Collapsed</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink/70 dark:text-ink-dark/70">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Colony notes, queen condition, honey flow status..."
                  className="w-full rounded-xl border border-black/15 bg-transparent p-2.5 text-xs text-ink outline-none focus:border-honey dark:border-white/15 dark:text-ink-dark"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-xl border border-black/10 px-4 py-2 text-xs font-semibold hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-honey px-4 py-2 text-xs font-semibold text-comb hover:brightness-95 disabled:opacity-50"
                >
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  status = "normal",
}: {
  label: string;
  value: string;
  unit?: string;
  icon: typeof IconTemperature;
  status?: "normal" | "alert";
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 dark:bg-white/5 ${
        status === "alert"
          ? "border-alert/30 bg-alert/5"
          : "border-black/8 dark:border-white/10"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-black/55 dark:text-white/55">{label}</span>
        <Icon
          size={20}
          stroke={1.7}
          className={status === "alert" ? "text-alert" : "text-honey"}
        />
      </div>

      <div className="flex items-baseline gap-1">
        <span
          className={`text-2xl font-semibold tracking-tight ${
            status === "alert" ? "text-alert" : ""
          }`}
        >
          {value}
        </span>

        {unit && (
          <span className="text-sm text-black/45 dark:text-white/45">{unit}</span>
        )}
      </div>
    </div>
  );
}
