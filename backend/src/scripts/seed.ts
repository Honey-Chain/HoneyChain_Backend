import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDB, disconnectDB } from "../config/db.js";
import {
  Apiary,
  Hive,
  SensorReading,
  Batch,
  AIPrediction,
} from "../models/index.js";
import { seedDemoUsers } from "./seedUsers.js";

async function seed() {
  console.log("\n=======================================================");
  console.log("            HONEYCHAIN DATABASE SEED SCRIPT            ");
  console.log("=======================================================\n");

  await connectDB(env.MONGO_URI);

  // Define dedicated Beekeeper and Stakeholder addresses
  const BEEKEEPER_SUNDARBANS = "0x111748e2D54D3f151746Af8B508CE8AD626d7A93"; // Verified testnet beekeeper
  const BEEKEEPER_KASHMIR = "0x222748e2D54D3f151746Af8B508CE8AD626d7A99";
  const BEEKEEPER_WESTERN_GHATS = "0x333748e2D54D3f151746Af8B508CE8AD626d7B11";

  // Target IDs for idempotency
  const seedApiaryIds = ["APIARY-SB-01", "APIARY-KV-02", "APIARY-WG-03"];
  const seedHiveIds = [
    "HIVE-SB-101",
    "HIVE-SB-102",
    "HIVE-KV-201",
    "HIVE-KV-202",
    "HIVE-WG-301",
    "HIVE-WG-302",
    "HIVE-HW-401",
  ];
  const seedBatchIds = ["HC-SEED-BATCH-001", "HC-SEED-BATCH-002"];
  const seedPredictionIds = [
    "PRED-HEALTH-SB101-01",
    "PRED-SWARM-KV201-01",
    "PRED-YIELD-WG301-01",
  ];

  console.log("Cleaning up prior seed data for idempotency...");
  await Promise.all([
    Apiary.deleteMany({ apiaryId: { $in: seedApiaryIds } }),
    Hive.deleteMany({ hiveId: { $in: seedHiveIds } }),
    SensorReading.deleteMany({ hiveId: { $in: seedHiveIds } }),
    Batch.deleteMany({ batchId: { $in: seedBatchIds } }),
    AIPrediction.deleteMany({ predictionId: { $in: seedPredictionIds } }),
  ]);
  console.log("Cleaned prior seed records successfully.\n");

  // -------------------------------------------------------------
  // 1. Seed Apiaries
  // -------------------------------------------------------------
  console.log(">>> [1/5] Seeding Apiaries...");
  const apiariesData = [
    {
      apiaryId: "APIARY-SB-01",
      name: "Sundarbans Biosphere Apiary Alpha",
      beekeeper: BEEKEEPER_SUNDARBANS,
      beekeeperContact: {
        name: "Subhash Mondal",
        phone: "+91 98300 12345",
        email: "subhash.mondal@sundarbans-honey.coop",
      },
      location: {
        latitude: 21.9497,
        longitude: 89.1833,
        region: "Sundarbans Biosphere Reserve, West Bengal",
        address: "Gosaba Island Block IV, South 24 Parganas, WB 743370",
        elevationMeters: 4,
        coordinates: { type: "Point" as const, coordinates: [89.1833, 21.9497] },
      },
      floraType: ["Mangrove Wildflower", "Sundari", "Gewa", "Khalsi"],
      status: "active" as const,
      capacity: 30,
      notes: "Certified organic wild coastal mangrove honey production site.",
    },
    {
      apiaryId: "APIARY-KV-02",
      name: "Kashmir Highland Acacia Apiary",
      beekeeper: BEEKEEPER_KASHMIR,
      beekeeperContact: {
        name: "Bashir Ahmad Rather",
        phone: "+91 94190 54321",
        email: "bashir.rather@kashmir-apiculture.org",
      },
      location: {
        latitude: 34.0837,
        longitude: 74.7973,
        region: "Kashmir Valley, Jammu & Kashmir",
        address: "Pampore Saffron & Blossom Belt, Pulwama, J&K 192121",
        elevationMeters: 1590,
        coordinates: { type: "Point" as const, coordinates: [74.7973, 34.0837] },
      },
      floraType: ["Robinia Pseudoacacia", "Wild Apple Blossom", "Mustard"],
      status: "active" as const,
      capacity: 40,
      notes: "High altitude single-origin white acacia honey sanctuary.",
    },
    {
      apiaryId: "APIARY-WG-03",
      name: "Western Ghats Biodiversity Reserve Apiary",
      beekeeper: BEEKEEPER_WESTERN_GHATS,
      beekeeperContact: {
        name: "Ananya Hegde",
        phone: "+91 98450 67890",
        email: "ananya.hegde@malnad-beekeepers.in",
      },
      location: {
        latitude: 14.167,
        longitude: 74.833,
        region: "Uttara Kannada, Western Ghats, Karnataka",
        address: "Sirsi Evergreen Forest Buffer Zone, KA 581401",
        elevationMeters: 620,
        coordinates: { type: "Point" as const, coordinates: [74.833, 14.167] },
      },
      floraType: ["Strobilanthes (Kurunji)", "Wild Jamun", "Coffee Blossom"],
      status: "active" as const,
      capacity: 25,
      notes: "Rich rainforest canopy apiculture supporting stingless & cerana bees.",
    },
  ];

  const createdApiaries = await Apiary.insertMany(apiariesData);
  const apiaryMap: Record<string, typeof createdApiaries[0]> = {};
  for (const a of createdApiaries) {
    apiaryMap[a.apiaryId] = a;
    console.log(`  + Apiary Created: ${a.name} (${a.apiaryId}) [ID: ${a._id}]`);
  }
  console.log();

  // -------------------------------------------------------------
  // 2. Seed Hives
  // -------------------------------------------------------------
  console.log(">>> [2/5] Seeding Hives...");
  const hivesData = [
    {
      hiveId: "HIVE-SB-101",
      apiary: apiaryMap["APIARY-SB-01"]._id,
      apiaryId: "APIARY-SB-01",
      beekeeper: BEEKEEPER_SUNDARBANS,
      hiveType: "Smart-IoT-Box" as const,
      beeSpecies: "Apis cerana indica",
      queenInfo: {
        queenId: "QN-SB-2025-01",
        installedDate: new Date("2025-04-10"),
        markedColor: "Yellow" as const,
        isMated: true,
        notes: "High brood pattern stability and aggressive defensive instinct against wasps.",
      },
      installationDate: new Date("2025-04-15"),
      status: "active" as const,
      location: {
        latitude: 21.9497,
        longitude: 88.9008,
        address: "Sundarbans Mangrove Delta, Sector 4, WB",
        isApproximate: true,
      },
      deviceMetadata: {
        deviceId: "ESP32-SB-GW-01",
        hardwareModel: "ESP32-WROOM-32U + BME280 + HX711 + I2S Mic",
        firmwareVersion: "v2.3.0-prod",
        communicationProtocol: "MQTT" as const,
        lastPingAt: new Date(),
        batteryLevelPct: 96,
      },
      currentHealthSummary: {
        healthScore: 94,
        status: "healthy" as const,
        stressIndex: 0.08,
        latestInspectionDate: new Date("2026-03-01"),
        latestReadingAt: new Date(),
        activeAlerts: [],
      },
      notes: "Primary production hive. High honey accumulation rate.",
    },
    {
      hiveId: "HIVE-SB-102",
      apiary: apiaryMap["APIARY-SB-01"]._id,
      apiaryId: "APIARY-SB-01",
      beekeeper: BEEKEEPER_SUNDARBANS,
      hiveType: "Langstroth" as const,
      beeSpecies: "Apis cerana indica",
      queenInfo: {
        queenId: "QN-SB-2025-02",
        installedDate: new Date("2025-05-01"),
        markedColor: "Yellow" as const,
        isMated: true,
      },
      installationDate: new Date("2025-05-05"),
      status: "active" as const,
      location: {
        latitude: 21.9497,
        longitude: 88.9008,
        address: "Sundarbans Mangrove Delta, Sector 4, WB",
        isApproximate: true,
      },
      deviceMetadata: {
        deviceId: "ESP32-SB-GW-02",
        hardwareModel: "ESP32-WROOM-32U + HX711 Load Cell",
        firmwareVersion: "v2.3.0-prod",
        communicationProtocol: "MQTT" as const,
        lastPingAt: new Date(),
        batteryLevelPct: 89,
      },
      currentHealthSummary: {
        healthScore: 82,
        status: "healthy" as const,
        stressIndex: 0.18,
        latestInspectionDate: new Date("2026-03-01"),
        latestReadingAt: new Date(),
        activeAlerts: [],
      },
    },
    {
      hiveId: "HIVE-KV-201",
      apiary: apiaryMap["APIARY-KV-02"]._id,
      apiaryId: "APIARY-KV-02",
      beekeeper: BEEKEEPER_KASHMIR,
      hiveType: "Smart-IoT-Box" as const,
      beeSpecies: "Apis mellifera",
      queenInfo: {
        queenId: "QN-KV-2025-09",
        installedDate: new Date("2025-06-12"),
        markedColor: "White" as const,
        isMated: true,
      },
      installationDate: new Date("2025-06-15"),
      status: "active" as const,
      location: {
        latitude: 34.0837,
        longitude: 74.7973,
        address: "Pampore Saffron & Acacia Valley, Kashmir",
        isApproximate: true,
      },
      deviceMetadata: {
        deviceId: "ESP32-KV-GW-01",
        hardwareModel: "ESP32-S3 + LoRa SX1262 + Environmental Array",
        firmwareVersion: "v3.1.0",
        communicationProtocol: "LoRaWAN" as const,
        lastPingAt: new Date(),
        batteryLevelPct: 92,
      },
      currentHealthSummary: {
        healthScore: 78,
        status: "warning" as const,
        stressIndex: 0.35,
        latestInspectionDate: new Date("2026-02-20"),
        latestReadingAt: new Date(),
        activeAlerts: ["Pre-swarming acoustic frequency elevation (242 Hz)"],
      },
      notes: "Early spring build-up fast. High swarming potential.",
    },
    {
      hiveId: "HIVE-KV-202",
      apiary: apiaryMap["APIARY-KV-02"]._id,
      apiaryId: "APIARY-KV-02",
      beekeeper: BEEKEEPER_KASHMIR,
      hiveType: "Langstroth" as const,
      beeSpecies: "Apis mellifera",
      installationDate: new Date("2025-06-20"),
      status: "active" as const,
      location: {
        latitude: 34.0837,
        longitude: 74.7973,
        address: "Pampore Saffron & Acacia Valley, Kashmir",
        isApproximate: true,
      },
      deviceMetadata: {
        deviceId: "ESP32-KV-GW-02",
        hardwareModel: "ESP32-C3 + BLE Beacon",
        firmwareVersion: "v2.0.1",
        communicationProtocol: "BLE" as const,
        lastPingAt: new Date(),
        batteryLevelPct: 98,
      },
      currentHealthSummary: {
        healthScore: 91,
        status: "healthy" as const,
        stressIndex: 0.1,
        latestInspectionDate: new Date("2026-02-22"),
        latestReadingAt: new Date(),
        activeAlerts: [],
      },
    },
    {
      hiveId: "HIVE-WG-301",
      apiary: apiaryMap["APIARY-WG-03"]._id,
      apiaryId: "APIARY-WG-03",
      beekeeper: BEEKEEPER_WESTERN_GHATS,
      hiveType: "Smart-IoT-Box" as const,
      beeSpecies: "Apis cerana indica",
      installationDate: new Date("2025-08-01"),
      status: "active" as const,
      location: {
        latitude: 14.167,
        longitude: 74.833,
        address: "Sirsi Evergreen Forest Buffer Zone, KA",
        isApproximate: true,
      },
      deviceMetadata: {
        deviceId: "ESP32-WG-GW-01",
        hardwareModel: "ESP32-WROOM-32U",
        firmwareVersion: "v2.2.0",
        communicationProtocol: "MQTT" as const,
        lastPingAt: new Date(),
        batteryLevelPct: 95,
      },
      currentHealthSummary: {
        healthScore: 96,
        status: "healthy" as const,
        stressIndex: 0.05,
        latestInspectionDate: new Date("2026-03-02"),
        latestReadingAt: new Date(),
        activeAlerts: [],
      },
    },
    {
      hiveId: "HIVE-WG-302",
      apiary: apiaryMap["APIARY-WG-03"]._id,
      apiaryId: "APIARY-WG-03",
      beekeeper: BEEKEEPER_WESTERN_GHATS,
      hiveType: "Traditional-Box" as const,
      beeSpecies: "Tetragonula iridipennis", // Stingless bee
      installationDate: new Date("2025-08-10"),
      status: "active" as const,
      location: {
        latitude: 14.167,
        longitude: 74.833,
        address: "Sirsi Evergreen Forest Buffer Zone, KA",
        isApproximate: true,
      },
      currentHealthSummary: {
        healthScore: 89,
        status: "healthy" as const,
        stressIndex: 0.12,
        latestInspectionDate: new Date("2026-02-15"),
        latestReadingAt: new Date(),
        activeAlerts: [],
      },
      deviceMetadata: {
        deviceId: "ESP32-WG-GW-02",
        hardwareModel: "ESP32-WROOM-32U",
        firmwareVersion: "v2.2.0",
        communicationProtocol: "HTTP" as const,
        batteryLevelPct: 100,
      },
    },
    {
      hiveId: "HIVE-HW-401",
      apiary: apiaryMap["APIARY-WG-03"]._id,
      apiaryId: "APIARY-WG-03",
      beekeeper: BEEKEEPER_SUNDARBANS,
      hiveType: "Smart-IoT-Box" as const,
      beeSpecies: "Apis cerana indica",
      installationDate: new Date(),
      status: "active" as const,
      location: {
        latitude: 14.167,
        longitude: 74.833,
        address: "Sirsi Evergreen Forest Buffer Zone, KA 581401",
        isApproximate: false,
      },
      deviceMetadata: {
        deviceId: "ESP32-HW-01",
        hardwareModel: "ESP32 Physical Edge Node",
        firmwareVersion: "v1.0.0-hw",
        communicationProtocol: "HTTP" as const,
        batteryLevelPct: 100,
      },
      currentHealthSummary: {
        healthScore: 95,
        status: "healthy" as const,
        stressIndex: 0.05,
        latestInspectionDate: new Date(),
        latestReadingAt: new Date(),
        activeAlerts: [],
      },
      notes: "Dedicated physical hardware edge node (ESP32/Arduino) transmitting live telemetry.",
    },
  ];

  const createdHives = await Hive.insertMany(hivesData);
  const hiveMap: Record<string, typeof createdHives[0]> = {};
  for (const h of createdHives) {
    hiveMap[h.hiveId] = h;
    // Link hive to parent apiary document
    await Apiary.updateOne(
      { _id: h.apiary },
      { $addToSet: { hives: h._id } }
    );
    console.log(`  + Hive Created: ${h.hiveId} (${h.beeSpecies}) -> Apiary: ${h.apiaryId}`);
  }
  console.log();

  // -------------------------------------------------------------
  // 3. Seed Sensor Telemetry Readings
  // -------------------------------------------------------------
  console.log(">>> [3/5] Seeding Time-Series Sensor Readings...");
  const readingsToInsert: any[] = [];
  const nowMs = Date.now();

  // Generate 48 hourly readings for each monitored hive to support full T1-T48 tiers
  const monitoredHives = [
    { hiveId: "HIVE-SB-101", deviceId: "ESP32-SB-GW-01", baseTemp: 34.6, baseWeight: 31.2, baseHz: 215 },
    { hiveId: "HIVE-SB-102", deviceId: "ESP32-SB-GW-02", baseTemp: 34.2, baseWeight: 28.5, baseHz: 205 },
    { hiveId: "HIVE-KV-201", deviceId: "ESP32-KV-GW-01", baseTemp: 33.8, baseWeight: 35.8, baseHz: 238 },
    { hiveId: "HIVE-WG-301", deviceId: "ESP32-WG-GW-01", baseTemp: 35.0, baseWeight: 29.4, baseHz: 210 },
  ];

  for (const h of monitoredHives) {
    for (let hour = 49; hour >= 0; hour--) {
      const timestamp = new Date(nowMs - hour * 3600 * 1000);
      // Realistic diurnal variation (brood core holds tight temperature ~34.5-35.5°C)
      const hourOfDay = timestamp.getHours();
      const ambientVariation = Math.sin((hourOfDay - 8) * (Math.PI / 12)) * 4;
      const internalVariation = Math.sin((hourOfDay - 8) * (Math.PI / 12)) * 0.4;
      // Diurnal bee foraging flow: active during daylight (7am-7pm), quiet at night
      const isDay = hourOfDay >= 7 && hourOfDay <= 19;
      const diurnalFlow = isDay
        ? Math.round(Math.sin(((hourOfDay - 7) * Math.PI) / 12) * 80 + (Math.random() * 20 - 10))
        : Math.round(Math.random() * 6 - 3);

      readingsToInsert.push({
        hiveId: h.hiveId,
        hive: hiveMap[h.hiveId]._id,
        deviceId: h.deviceId,
        timestamp,
        temperature: Number((h.baseTemp + internalVariation + (Math.random() * 0.2 - 0.1)).toFixed(2)),
        humidity: Number((58.5 + (Math.random() * 3.0 - 1.5)).toFixed(1)),
        weightKg: Number((h.baseWeight + (48 - hour) * 0.02 + (Math.random() * 0.05)).toFixed(3)),
        flow: diurnalFlow,
        soundFrequencyHz: Math.round(h.baseHz + (Math.random() * 8 - 4)),
        acousticsDb: Number((58.0 + (Math.random() * 5.0)).toFixed(1)),
        batteryLevelPct: Math.round(95 - hour * 0.05),
        ambientTemperature: Number((26.0 + ambientVariation + (Math.random() * 0.5)).toFixed(1)),
        ambientHumidity: Number((65.0 - ambientVariation * 1.5 + (Math.random() * 2)).toFixed(1)),
        metadata: {
          flow: diurnalFlow,
          rssi: -78 - Math.round(Math.random() * 8),
          snr: 9.2,
          packetLossPct: 0.0,
        },
      });
    }
  }

  await SensorReading.insertMany(readingsToInsert);
  console.log(`  + Inserted ${readingsToInsert.length} time-series IoT readings spanning past 24 hours across ${monitoredHives.length} hives.\n`);

  // -------------------------------------------------------------
  // 4. Seed AI Predictions
  // -------------------------------------------------------------
  console.log(">>> [4/5] Seeding AI Predictions & Analytics...");
  const predictionsData = [
    {
      predictionId: "PRED-HEALTH-SB101-01",
      targetType: "hive" as const,
      hive: hiveMap["HIVE-SB-101"]._id,
      hiveId: "HIVE-SB-101",
      apiary: apiaryMap["APIARY-SB-01"]._id,
      apiaryId: "APIARY-SB-01",
      predictionType: "colony_health" as const,
      modelVersion: "honeychain-health-v1.4.0",
      confidence: 0.96,
      predictionTimestamp: new Date(nowMs - 2 * 3600 * 1000),
      inputWindow: {
        startTime: new Date(nowMs - 26 * 3600 * 1000),
        endTime: new Date(nowMs - 2 * 3600 * 1000),
        sampleCount: 24,
        featureSummary: {
          meanTemperature: 34.62,
          tempStdDev: 0.28,
          meanWeightGainKg: 0.72,
          acousticStabilityScore: 0.98,
        },
      },
      result: {
        status: "normal" as const,
        healthScore: 95,
        riskScore: 0.05,
        detectedAnomalies: [],
        probableCauses: ["Optimal brood temperature regulation", "Active nectar foraging flow"],
        recommendedActions: ["Maintain routine supers expansion schedule"],
        metricsSnapshot: { broodThermoregulationEfficiency: "98.4%" },
      },
      status: "active" as const,
    },
    {
      predictionId: "PRED-SWARM-KV201-01",
      targetType: "hive" as const,
      hive: hiveMap["HIVE-KV-201"]._id,
      hiveId: "HIVE-KV-201",
      apiary: apiaryMap["APIARY-KV-02"]._id,
      apiaryId: "APIARY-KV-02",
      predictionType: "swarming_risk" as const,
      modelVersion: "honeychain-swarm-detector-v2.1",
      confidence: 0.88,
      predictionTimestamp: new Date(nowMs - 1 * 3600 * 1000),
      inputWindow: {
        startTime: new Date(nowMs - 25 * 3600 * 1000),
        endTime: new Date(nowMs - 1 * 3600 * 1000),
        sampleCount: 24,
        featureSummary: {
          acousticDominantFrequencyHz: 242,
          frequencyElevatedHours: 6,
          weightPlateauDetected: true,
        },
      },
      result: {
        status: "warning" as const,
        riskScore: 0.72,
        detectedAnomalies: ["Dominant acoustic frequency elevated from 210Hz to 242Hz (Swarm Whine)"],
        probableCauses: ["Colony congestion", "Swarm cell preparation"],
        recommendedActions: [
          "Perform physical hive inspection within 48 hours",
          "Add honey super or perform artificial swarm split if queen cells present",
        ],
      },
      status: "active" as const,
    },
    {
      predictionId: "PRED-YIELD-WG301-01",
      targetType: "hive" as const,
      hive: hiveMap["HIVE-WG-301"]._id,
      hiveId: "HIVE-WG-301",
      apiary: apiaryMap["APIARY-WG-03"]._id,
      apiaryId: "APIARY-WG-03",
      predictionType: "productivity_yield" as const,
      modelVersion: "honeychain-yield-estimator-v1.0",
      confidence: 0.91,
      predictionTimestamp: new Date(nowMs - 3 * 3600 * 1000),
      result: {
        status: "normal" as const,
        estimatedYieldKg: 28.5,
        metricsSnapshot: {
          currentHoneyWeightEstimateKg: 18.2,
          dailyNectarIntakeKg: 0.85,
          optimalHarvestDate: new Date(nowMs + 14 * 86400 * 1000),
        },
        recommendedActions: ["Inspect super capping progress in 10 days."],
      },
      status: "active" as const,
    },
  ];

  await AIPrediction.insertMany(predictionsData);
  for (const p of predictionsData) {
    console.log(`  + Prediction Created: ${p.predictionId} [Type: ${p.predictionType}, Confidence: ${p.confidence * 100}%] -> Hive: ${p.hiveId}`);
  }
  console.log();

  // -------------------------------------------------------------
  // 5. Seed Operational Honey Batches
  // -------------------------------------------------------------
  console.log(">>> [5/5] Seeding Operational Honey Batches...");
  const batchesData = [
    {
      batchId: "HC-SEED-BATCH-001",
      batchIdBytes32: "0x1111111111111111111111111111111111111111111111111111111111111111",
      producer: BEEKEEPER_SUNDARBANS,
      currentCustodian: BEEKEEPER_SUNDARBANS,
      quantityGrams: 30000, // 30 kg
      harvestTimestamp: Math.floor((nowMs - 5 * 86400 * 1000) / 1000),
      floralOrigin: "Sundarbans Wild Mangrove",
      sourceHives: ["HIVE-SB-101", "HIVE-SB-102"],
      apiary: apiaryMap["APIARY-SB-01"]._id,
      apiaryId: "APIARY-SB-01",
      hives: [hiveMap["HIVE-SB-101"]._id, hiveMap["HIVE-SB-102"]._id],
      apiaryLocation: {
        latitude: 21.9497,
        longitude: 89.1833,
        region: "Sundarbans Biosphere Reserve, West Bengal",
        elevationMeters: 4,
      },
      metadata: {
        batchId: "HC-SEED-BATCH-001",
        floralOrigin: "Sundarbans Wild Mangrove",
        quantityGrams: 30000,
        harvestTimestamp: Math.floor((nowMs - 5 * 86400 * 1000) / 1000),
        sourceHives: ["HIVE-SB-101", "HIVE-SB-102"],
        weatherAtHarvest: "Clear, 28C, 62% humidity",
      },
      metadataHash: "0x3a4f89d1b0c82736451e93abcf7190012489cbeaf538201a4e9b7201cd821a94",
      status: "Registered" as const,
      quality: {
        grade: "None" as const,
      },
      custodyHistory: [],
      recall: { recalled: false },
      blockchain: {
        network: "Ethereum Sepolia",
        chainId: 11155111,
        contractAddress: env.CONTRACT_ADDRESS,
        registrationConfirmed: false, // Flagged for on-chain submission via POST /api/batches
      },
    },
    {
      batchId: "HC-SEED-BATCH-002",
      batchIdBytes32: "0x2222222222222222222222222222222222222222222222222222222222222222",
      producer: BEEKEEPER_KASHMIR,
      currentCustodian: BEEKEEPER_KASHMIR,
      quantityGrams: 20000, // 20 kg
      harvestTimestamp: Math.floor((nowMs - 12 * 86400 * 1000) / 1000),
      floralOrigin: "Kashmir White Acacia",
      sourceHives: ["HIVE-KV-201", "HIVE-KV-202"],
      apiary: apiaryMap["APIARY-KV-02"]._id,
      apiaryId: "APIARY-KV-02",
      hives: [hiveMap["HIVE-KV-201"]._id, hiveMap["HIVE-KV-202"]._id],
      apiaryLocation: {
        latitude: 34.0837,
        longitude: 74.7973,
        region: "Kashmir Valley, Jammu & Kashmir",
        elevationMeters: 1590,
      },
      metadata: {
        batchId: "HC-SEED-BATCH-002",
        floralOrigin: "Kashmir White Acacia",
        quantityGrams: 20000,
      },
      metadataHash: "0x82bca19045761e38920cdbf41a7891234bcadef128490a02194857bdf1290345",
      status: "Certified" as const,
      quality: {
        grade: "GradeA" as const,
        moisturePercentage: 17.2,
        moistureBasisPoints: 1720,
        certifiedBy: "0x88bcE6325a09Fb4943d61A48eA5282EBeEb7744c",
        certifiedAt: Math.floor((nowMs - 10 * 86400 * 1000) / 1000),
      },
      custodyHistory: [],
      recall: { recalled: false },
      blockchain: {
        network: "Ethereum Sepolia",
        chainId: 11155111,
        contractAddress: env.CONTRACT_ADDRESS,
        registrationConfirmed: false,
      },
    },
  ];

  const createdBatches = await Batch.insertMany(batchesData);
  for (const b of createdBatches) {
    console.log(`  + Batch Created: ${b.batchId} (${b.floralOrigin}, ${b.quantityGrams / 1000} kg) -> Apiary: ${b.apiaryId}`);
  }

  // Seed Demo Users and Organizations
  console.log("\n>>> [5/5] Seeding Demo Users & Organizations...");
  await seedDemoUsers();

  console.log("\n=======================================================");
  console.log("            DATABASE SEEDING COMPLETED CLEANLY         ");
  console.log("=======================================================\n");

  await disconnectDB();
}

seed().catch(async (err) => {
  console.error("\n[SEED ERROR]", err);
  await disconnectDB();
  process.exit(1);
});
