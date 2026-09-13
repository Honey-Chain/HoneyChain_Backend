// backend/src/scripts/seed14dTelemetry.ts
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "../config/db.js";
import { Hive, SensorReading } from "../models/index.js";
import { yieldMLService } from "../services/yieldML.service.js";
import { mlService } from "../services/ml.service.js";

interface Hive14dConfig {
  startWeight: number;
  dailyGainTarget: number;
  baseBroodTemp: number;
  baseBroodHum: number;
  baseHz: number;
}

const HIVE_CONFIGS: Record<string, Hive14dConfig> = {
  "HIVE-SB-101": {
    startWeight: 32.2,
    dailyGainTarget: 0.73, // ~10.2 kg gain over 14 days -> reaches ~42.4 kg
    baseBroodTemp: 34.8,
    baseBroodHum: 58.5,
    baseHz: 218,
  },
  "HIVE-KV-201": {
    startWeight: 34.5,
    dailyGainTarget: 0.88, // ~12.3 kg gain over 14 days -> reaches ~46.8 kg
    baseBroodTemp: 34.5,
    baseBroodHum: 59.0,
    baseHz: 232,
  },
  "HIVE-WG-301": {
    startWeight: 30.0,
    dailyGainTarget: 0.44, // ~6.2 kg gain over 14 days -> reaches ~36.2 kg
    baseBroodTemp: 34.9,
    baseBroodHum: 58.0,
    baseHz: 215,
  },
};

export async function seed14dTelemetry(force = true): Promise<void> {
  const hives = await Hive.find({ status: "active" });
  if (hives.length === 0) {
    console.log("[Seed14d] No active hives found in database.");
    return;
  }

  const nowMs = Date.now();
  const fourteenDaysHours = 14 * 24; // 336 hourly observations

  for (const hive of hives) {
    const hiveId = hive.hiveId;
    const config = HIVE_CONFIGS[hiveId] || {
      startWeight: 31.0,
      dailyGainTarget: 0.60,
      baseBroodTemp: 34.7,
      baseBroodHum: 58.5,
      baseHz: 220,
    };

    // Remove all previous sensor readings for this hive to eliminate static/corrupted simulator data
    await SensorReading.deleteMany({ hiveId });

    console.log(`[Seed14d] Generating 14 days (336 hourly points) of apicultural telemetry for ${hiveId}...`);

    const deviceId = hive.deviceMetadata?.deviceId || `ESP32-${hiveId}`;
    const readingsToInsert: any[] = [];

    // Total 14 days * 24 hours = 336 points
    for (let dayIndex = 0; dayIndex < 14; dayIndex++) {
      // Days go from 13 days ago (dayIndex 0) to today (dayIndex 13)
      const dayOffsetMs = (13 - dayIndex) * 24 * 3600 * 1000;
      const baseDayWeight = config.startWeight + dayIndex * config.dailyGainTarget;

      for (let hour = 0; hour < 24; hour++) {
        // Compute exact timestamp for this hour
        const timestamp = new Date(nowMs - dayOffsetMs + (hour - 23) * 3600 * 1000);
        const hourOfDay = timestamp.getHours();

        // Diurnal Ambient Weather (Sundarbans subtropical climate: 20-31°C, 55-85% humidity)
        const ambientSunCurve = Math.sin(((hourOfDay - 8) * Math.PI) / 12);
        const ambientTemp = Number((23.0 + ambientSunCurve * 6.5 + (Math.random() * 0.4 - 0.2)).toFixed(1));
        const ambientHum = Number((72.0 - ambientSunCurve * 16.0 + (Math.random() * 1.5 - 0.75)).toFixed(1));

        // Worker bees regulate internal brood temperature tightly: 34.4°C - 35.2°C
        const internalBroodTemp = Number(
          (config.baseBroodTemp + ambientSunCurve * 0.32 + (Math.random() * 0.08 - 0.04)).toFixed(2)
        );
        const internalBroodHum = Number(
          (config.baseBroodHum - ambientSunCurve * 1.8 + (Math.random() * 0.8 - 0.4)).toFixed(1)
        );

        // Intraday biological weight dynamics:
        // - 00:00 to 07:00: slight overnight moisture evaporation from fanning
        // - 08:00 to 17:00: active daytime nectar foraging intake
        // - 18:00 to 23:00: nectar curing / moisture evaporation
        let intradayGain = 0;
        if (hourOfDay >= 8 && hourOfDay <= 17) {
          const forageProgress = Math.sin(((hourOfDay - 8) * Math.PI) / 9);
          intradayGain = config.dailyGainTarget * 0.5 * (1 - Math.cos(((hourOfDay - 8) * Math.PI) / 9));
        } else if (hourOfDay > 17) {
          intradayGain = config.dailyGainTarget * 0.85 - ((hourOfDay - 17) * 0.012);
        } else {
          intradayGain = -(0.02 + (7 - hourOfDay) * 0.005);
        }

        const currentWeightKg = Number((baseDayWeight + intradayGain + (Math.random() * 0.02 - 0.01)).toFixed(3));

        // Bee foraging traffic
        let beeIn = 0;
        let beeOut = 0;
        if (hourOfDay >= 7 && hourOfDay <= 18) {
          const trafficActivity = Math.sin(((hourOfDay - 7) * Math.PI) / 11);
          beeIn = Math.round(60 + trafficActivity * 210 + Math.random() * 20);
          beeOut = Math.round(55 + trafficActivity * 195 + Math.random() * 20);
        } else {
          beeIn = Math.round(Math.random() * 3);
          beeOut = Math.round(Math.random() * 2);
        }
        const flow = beeIn - beeOut;

        // Acoustic Queen-Right colony buzzing (210 - 240 Hz, 56 - 63 dB)
        const soundFrequencyHz = Math.round(config.baseHz + (Math.random() * 6 - 3));
        const acousticsDb = Number((58.5 + (Math.random() * 3.0)).toFixed(1));

        // Battery solar cycle
        const isSunlight = hourOfDay >= 7 && hourOfDay <= 17;
        const batteryLevelPct = isSunlight
          ? Math.min(100, Math.round(97 + Math.random() * 3))
          : Math.max(92, Math.round(95 - ((hourOfDay > 17 ? hourOfDay - 17 : hourOfDay + 7) * 0.25)));

        readingsToInsert.push({
          hiveId,
          hive: hive._id,
          deviceId,
          timestamp,
          temperature: internalBroodTemp,
          humidity: internalBroodHum,
          weightKg: currentWeightKg,
          flow,
          beeInCount: beeIn,
          beeOutCount: beeOut,
          soundFrequencyHz,
          acousticsDb,
          batteryLevelPct,
          ambientTemperature: ambientTemp,
          ambientHumidity: ambientHum,
          metadata: {
            seeded: true,
            seedWindow: "14d_continuous",
          },
        });
      }
    }

    await SensorReading.insertMany(readingsToInsert);
    const endWeight = readingsToInsert[readingsToInsert.length - 1].weightKg;
    console.log(`  + Inserted ${readingsToInsert.length} telemetry readings for ${hiveId} spanning 14 days.`);
    console.log(`  + Hive weight progression: ${config.startWeight} kg -> ${endWeight} kg (Net Gain: +${(endWeight - config.startWeight).toFixed(2)} kg).`);

    // Execute Harvest Window & Yield prediction
    try {
      console.log(`  + Triggering Harvest Window & Yield prediction for ${hiveId}...`);
      const yieldResult = await yieldMLService.predictForHive(hiveId, {
        persist: true,
        forceAi: true,
      });
      console.log(`  + Yield Prediction for ${hiveId}: Harvest in ${yieldResult.harvestWindowRange}, Estimated Yield: ${yieldResult.estimatedYieldKg} kg`);
      console.log(`  + Gemini AI Insights: ${yieldResult.geminiAnalysis.summary}`);
    } catch (yErr: any) {
      console.warn(`  - Harvest yield prediction warning for ${hiveId}:`, yErr.message);
    }

    // Also execute Hive Health prediction to keep health status updated
    try {
      console.log(`  + Updating Hive Health prediction for ${hiveId}...`);
      await mlService.predictForHive(hiveId, {
        persist: true,
        forceAi: true,
      });
    } catch (hErr: any) {
      console.warn(`  - Hive health prediction warning for ${hiveId}:`, hErr.message);
    }
  }

  console.log("[Seed14d] Telemetry seeding and AI inferences completed successfully.");
}

// Allow direct execution from CLI
if (process.argv[1]?.endsWith("seed14dTelemetry.ts") || process.argv[1]?.endsWith("seed14dTelemetry.js")) {
  connectDB()
    .then(async () => {
      await seed14dTelemetry(true);
      await mongoose.disconnect();
      console.log("[Seed14d] Database connection closed. Exiting.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seed14d] Fatal error:", err);
      process.exit(1);
    });
}
