import { expect } from "chai";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { Hive, Apiary, SensorReading } from "../models/index.js";
import { ActiveAlertState } from "../models/ActiveAlertState.js";
import { iotController } from "../controllers/iot.controller.js";
import notificationService from "../services/notification.service.js";

describe("HoneyChain High-Frequency IoT Telemetry & Twilio SMS Alert Test Suite", function () {
  this.timeout(20000);

  let mongoServer: MongoMemoryServer;
  let testApiary: any;
  let hiveOne: any;
  let hiveTwo: any;

  // Captured outgoing SMS during testing
  let sentSmsList: Array<{ to: string; body: string }> = [];

  before(async function () {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.disconnect();
    await mongoose.connect(uri);

    await Promise.all([
      Apiary.init(),
      Hive.init(),
      SensorReading.init(),
      ActiveAlertState.init(),
    ]);

    testApiary = await Apiary.create({
      apiaryId: "APIARY-HF-TEST",
      name: "High Frequency Telemetry Sanctuary",
      beekeeper: "0x111748e2D54D3f151746Af8B508CE8AD626d7A93",
      location: { latitude: 22.57, longitude: 88.36, region: "Kolkata Hub" },
    });

    hiveOne = await Hive.create({
      hiveId: "HIVE-HF-01",
      apiary: testApiary._id,
      apiaryId: testApiary.apiaryId,
      beekeeper: testApiary.beekeeper,
      status: "active",
      deviceMetadata: {
        deviceId: "ESP32-HF-01",
        hardwareModel: "ESP32-S3",
        batteryLevelPct: 100,
      },
      currentHealthSummary: {
        healthScore: 95,
        status: "healthy",
      },
    });

    hiveTwo = await Hive.create({
      hiveId: "HIVE-HF-02",
      apiary: testApiary._id,
      apiaryId: testApiary.apiaryId,
      beekeeper: testApiary.beekeeper,
      status: "active",
      deviceMetadata: {
        deviceId: "ESP32-HF-02",
        hardwareModel: "ESP32-S3",
        batteryLevelPct: 100,
      },
      currentHealthSummary: {
        healthScore: 90,
        status: "healthy",
      },
    });

    // Configure mock SMS sender to capture alerts without sending real SMS
    notificationService.setMockSender(async (to: string, body: string) => {
      sentSmsList.push({ to, body });
      return { success: true, messageId: `mock-msg-${Date.now()}` };
    });
  });

  after(async function () {
    notificationService.setMockSender(null);
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async function () {
    await SensorReading.deleteMany({});
    await ActiveAlertState.deleteMany({});
    await Hive.updateMany({}, { status: "active", "currentHealthSummary.status": "healthy" });
    await iotController.clearPersistenceCache();
    sentSmsList = [];
  });

  describe("1. High-Frequency Ingestion & Downsampled Persistence (15s & 30s Intervals)", function () {
    it("accepts valid 15-second telemetry readings and persists only first reading", async function () {
      const baseTime = new Date("2026-09-11T10:00:00.000Z");

      // 1. Reading at T0 (0s)
      const res1 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: baseTime.toISOString(),
          temperature: 34.5,
          humidity: 58.0,
          weightKg: 30.2,
          batteryLevelPct: 95,
        });

      expect(res1.status).to.equal(201);
      expect(res1.body.success).to.be.true;
      expect(res1.body.persisted).to.be.true;
      expect(await SensorReading.countDocuments({ hiveId: "HIVE-HF-01" })).to.equal(1);

      // 2. Reading at T0 + 15 seconds
      const time15s = new Date(baseTime.getTime() + 15 * 1000);
      const res2 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: time15s.toISOString(),
          temperature: 34.6,
          humidity: 58.2,
          weightKg: 30.22,
          batteryLevelPct: 95,
        });

      expect(res2.status).to.equal(200);
      expect(res2.body.success).to.be.true;
      expect(res2.body.persisted).to.be.false;
      expect(res2.body.message).to.include("10-minute");

      // Verify MongoDB was NOT written for the 15-second reading
      expect(await SensorReading.countDocuments({ hiveId: "HIVE-HF-01" })).to.equal(1);
    });

    it("accepts valid 30-second telemetry readings without persisting inside the window", async function () {
      const baseTime = new Date("2026-09-11T10:00:00.000Z");

      // Reading 1 (T0)
      const res1 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: baseTime.toISOString(),
          temperature: 35.0,
          humidity: 55.0,
          weightKg: 28.5,
          batteryLevelPct: 92,
        });
      expect(res1.status).to.equal(201);
      expect(res1.body.persisted).to.be.true;

      // Reading 2 (T0 + 30s)
      const time30s = new Date(baseTime.getTime() + 30 * 1000);
      const res2 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: time30s.toISOString(),
          temperature: 35.1,
          humidity: 55.2,
          weightKg: 28.51,
          batteryLevelPct: 92,
        });

      expect(res2.status).to.equal(200);
      expect(res2.body.success).to.be.true;
      expect(res2.body.persisted).to.be.false;
      expect(await SensorReading.countDocuments({ hiveId: "HIVE-HF-01" })).to.equal(1);
    });

    it("persists a reading to MongoDB when the 10-minute interval has elapsed", async function () {
      const baseTime = new Date("2026-09-11T10:00:00.000Z");

      // Reading 1 at T0
      await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: baseTime.toISOString(),
          temperature: 34.5,
          humidity: 58.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(await SensorReading.countDocuments({ hiveId: "HIVE-HF-01" })).to.equal(1);

      // Reading 2 at T0 + 5 minutes (300s, within 10-minute window) -> not persisted
      const time5m = new Date(baseTime.getTime() + 300 * 1000);
      const res5m = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: time5m.toISOString(),
          temperature: 34.6,
          humidity: 58.1,
          weightKg: 30.05,
          batteryLevelPct: 90,
        });
      expect(res5m.body.persisted).to.be.false;
      expect(await SensorReading.countDocuments({ hiveId: "HIVE-HF-01" })).to.equal(1);

      // Reading 3 at T0 + 10 minutes and 5 seconds (605s, exceeds 10-minute window) -> PERSISTED!
      const time10m = new Date(baseTime.getTime() + 605 * 1000);
      const res10m = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: time10m.toISOString(),
          temperature: 34.7,
          humidity: 58.3,
          weightKg: 30.1,
          batteryLevelPct: 89,
        });

      expect(res10m.status).to.equal(201);
      expect(res10m.body.persisted).to.be.true;
      expect(await SensorReading.countDocuments({ hiveId: "HIVE-HF-01" })).to.equal(2);
    });

    it("enforces persistence timing independently per hive/device", async function () {
      const baseTime = new Date("2026-09-11T10:00:00.000Z");

      // 1. Ingest for Hive 1 at T0 -> Persisted
      const resHive1 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: baseTime.toISOString(),
          temperature: 34.5,
          humidity: 58.0,
          weightKg: 30.0,
          batteryLevelPct: 95,
        });
      expect(resHive1.status).to.equal(201);
      expect(resHive1.body.persisted).to.be.true;

      // 2. Ingest for Hive 2 at T0 + 15s -> Also Persisted (separate hive/device clock!)
      const time15s = new Date(baseTime.getTime() + 15 * 1000);
      const resHive2 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-02",
          hiveId: "HIVE-HF-02",
          timestamp: time15s.toISOString(),
          temperature: 33.8,
          humidity: 62.0,
          weightKg: 25.0,
          batteryLevelPct: 98,
        });
      expect(resHive2.status).to.equal(201);
      expect(resHive2.body.persisted).to.be.true;

      // 3. Second reading for Hive 1 at T0 + 30s -> Skipped
      const time30s = new Date(baseTime.getTime() + 30 * 1000);
      const resHive1Subsequent = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: time30s.toISOString(),
          temperature: 34.6,
          humidity: 58.1,
          weightKg: 30.02,
          batteryLevelPct: 95,
        });
      expect(resHive1Subsequent.body.persisted).to.be.false;

      expect(await SensorReading.countDocuments({ hiveId: "HIVE-HF-01" })).to.equal(1);
      expect(await SensorReading.countDocuments({ hiveId: "HIVE-HF-02" })).to.equal(1);
    });
  });

  describe("2. Immediate Sensor Validation (NaN, Infinity, null, malformed values)", function () {
    it("rejects NaN values, triggers SMS alert, and does NOT persist reading", async function () {
      const res = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: "NaN",
          humidity: 58.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(res.body.error.message).to.include("temperature is required and must be a valid number");

      // Verify SMS was triggered (plain text GSM-7)
      expect(sentSmsList.length).to.equal(1);
      expect(sentSmsList[0].body).to.include("HoneyChain Alert");
      expect(sentSmsList[0].body).to.not.include("🚨");
      expect(sentSmsList[0].body).to.include("Abnormal temperature: NaN");
      expect(sentSmsList[0].body).to.include("Expected: -40C to 70C");

      // Verify NOT persisted to MongoDB
      expect(await SensorReading.countDocuments({})).to.equal(0);
    });

    it("rejects Infinity values, triggers SMS alert, and does NOT persist reading", async function () {
      const res = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: 34.5,
          humidity: Infinity,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
      expect(sentSmsList.length).to.equal(1);
      expect(sentSmsList[0].body).to.include("Abnormal humidity");
      expect(sentSmsList[0].body).to.not.include("🚨");
      expect(await SensorReading.countDocuments({})).to.equal(0);
    });

    it("rejects null and non-numeric string values", async function () {
      const resNull = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: 34.5,
          humidity: null,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(resNull.status).to.equal(400);

      const resString = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: 34.5,
          humidity: 58.0,
          weightKg: "not_a_number",
          batteryLevelPct: 90,
        });
      expect(resString.status).to.equal(400);
      expect(await SensorReading.countDocuments({})).to.equal(0);
    });
  });

  describe("3. Impossible Physical Values & Immediate Twilio SMS Alerting", function () {
    it("detects impossible temperature (100°C), logs in-app alert, does NOT send SMS, and does NOT store reading", async function () {
      const res = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: 100.0, // Impossible reading
          humidity: 55.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });

      expect(res.status).to.equal(400);
      expect(res.body.error.message).to.include("temperature out of plausible range");

      // Verify NO SMS message was sent for extreme data
      expect(sentSmsList.length).to.equal(0);

      // Verify reading was NOT saved in database
      expect(await SensorReading.countDocuments({})).to.equal(0);
    });

    it("detects impossible humidity (>100%), does NOT send SMS, and does NOT store reading", async function () {
      const res = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: 34.5,
          humidity: 125.0, // Impossible humidity
          weightKg: 30.0,
          batteryLevelPct: 90,
        });

      expect(res.status).to.equal(400);
      expect(res.body.error.message).to.include("humidity out of plausible range");
      expect(sentSmsList.length).to.equal(0);
      expect(await SensorReading.countDocuments({})).to.equal(0);
    });

    it("detects impossible weight (<0kg or >300kg), does NOT send SMS, and does NOT store reading", async function () {
      const res = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: 34.5,
          humidity: 58.0,
          weightKg: -12.5, // Negative weight
          batteryLevelPct: 90,
        });

      expect(res.status).to.equal(400);
      expect(res.body.error.message).to.include("weightKg out of plausible range");
      expect(sentSmsList.length).to.equal(0);
      expect(await SensorReading.countDocuments({})).to.equal(0);
    });

    it("stateful alert state — only sends SMS for NEW malformed condition, suppresses CONTINUING, re-sends after RECOVERY", async function () {
      // 1. First malformed temperature reading → NEW condition → SMS sent, isActive=true
      const res1 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: null as any,
          humidity: 55.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(res1.status).to.equal(400);
      expect(sentSmsList.length).to.equal(1); // NEW condition → SMS

      // 2. Second identical malformed reading 15s later → CONTINUING condition → NO new SMS
      const res2 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date(Date.now() + 15000).toISOString(),
          temperature: null as any,
          humidity: 55.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(res2.status).to.equal(400);
      expect(sentSmsList.length).to.equal(1); // CONTINUING → no new SMS

      // 3. Normal reading → RECOVERY → clears state (isActive=false)
      const res3 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date(Date.now() + 30000).toISOString(),
          temperature: 35.0, // Normal!
          humidity: 55.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(res3.status).to.be.oneOf([200, 201]);
      expect(sentSmsList.length).to.equal(1); // Recovery doesn't send SMS

      // 4. New malformed reading after recovery → state was cleared → NEW condition → SMS again!
      const res4 = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date(Date.now() + 45000).toISOString(),
          temperature: null as any,
          humidity: 55.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(res4.status).to.equal(400);
      expect(sentSmsList.length).to.equal(2); // NEW after recovery → second SMS
    });

    it("per-sensor state is independent — different sensors on same hive each get their own state", async function () {
      // 1. Malformed temperature → SMS for temp
      await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: null as any, humidity: 55.0, weightKg: 30.0, batteryLevelPct: 90,
        });
      expect(sentSmsList.length).to.equal(1);

      // 2. Temperature recovers, but now humidity is malformed → SMS for humidity (new state)
      await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date(Date.now() + 30000).toISOString(),
          temperature: 35.0, // Recovered
          humidity: null as any, // Malformed humidity
          weightKg: 30.0, batteryLevelPct: 90,
        });
      expect(sentSmsList.length).to.equal(2); // New SMS for humidity

      // 3. Humidity still malformed → CONTINUING → no new SMS
      await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date(Date.now() + 45000).toISOString(),
          temperature: 35.0, humidity: null as any, weightKg: 30.0, batteryLevelPct: 90,
        });
      expect(sentSmsList.length).to.equal(2); // No new SMS
    });

    it("handles Twilio dispatch failure gracefully without crashing telemetry ingestion", async function () {
      // Configure mock sender to simulate network failure
      notificationService.setMockSender(async () => {
        throw new Error("Twilio API 503 Service Unavailable");
      });

      // 1. Normal telemetry still ingests successfully
      const resValid = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: 34.5,
          humidity: 58.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(resValid.status).to.equal(201);
      expect(resValid.body.success).to.be.true;

      // 2. Malformed reading returns 400 error without crashing the backend process
      const resAbnormal = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date(Date.now() + 15000).toISOString(),
          temperature: null as any,
          humidity: 58.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(resAbnormal.status).to.equal(400);
      expect(resAbnormal.body.error.message).to.include("temperature is required");
    });

    it("keeps hive status active and telemetry route always open even when abnormal or extreme data arrives", async function () {
      // 1. Initial hive state is active
      const initialHive = await Hive.findOne({ hiveId: "HIVE-HF-01" });
      expect(initialHive?.status).to.equal("active");

      // 2. Trigger critical extreme temperature (100°C)
      const resAbnormal = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date().toISOString(),
          temperature: 99.5,
          humidity: 58.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(resAbnormal.status).to.equal(400);

      // Verify hive remains ACTIVE (does not deactivate)
      const alertHive = await Hive.findOne({ hiveId: "HIVE-HF-01" });
      expect(alertHive?.status).to.equal("active");

      // 3. Subsequent reading while malformed: still active
      const resStillAbnormal = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date(Date.now() + 15000).toISOString(),
          temperature: null as any,
          humidity: 58.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(resStillAbnormal.status).to.equal(400);
      const stillAlertHive = await Hive.findOne({ hiveId: "HIVE-HF-01" });
      expect(stillAlertHive?.status).to.equal("active");

      // 4. Ingest valid/normal sensor data -> Hive successfully processes reading
      const resNormal = await request(app)
        .post("/api/iot/telemetry")
        .send({
          deviceId: "ESP32-HF-01",
          hiveId: "HIVE-HF-01",
          timestamp: new Date(Date.now() + 30000).toISOString(),
          temperature: 34.5,
          humidity: 58.0,
          weightKg: 30.0,
          batteryLevelPct: 90,
        });
      expect(resNormal.status).to.be.oneOf([200, 201]);

      const finalHive = await Hive.findOne({ hiveId: "HIVE-HF-01" });
      expect(finalHive?.status).to.equal("active");
    });
  });

  describe("4. Telemetry History API (GET /api/iot/telemetry/:hiveId)", function () {
    it("returns clean sampled telemetry at >=10-minute intervals", async function () {
      const baseTime = new Date("2026-09-11T10:00:00.000Z");

      // Ingest at T0 (stored)
      await request(app).post("/api/iot/telemetry").send({
        deviceId: "ESP32-HF-01",
        hiveId: "HIVE-HF-01",
        timestamp: baseTime.toISOString(),
        temperature: 34.0,
        humidity: 55.0,
        weightKg: 28.0,
        batteryLevelPct: 95,
      });

      // Ingest at T0 + 15s (skipped)
      await request(app).post("/api/iot/telemetry").send({
        deviceId: "ESP32-HF-01",
        hiveId: "HIVE-HF-01",
        timestamp: new Date(baseTime.getTime() + 15000).toISOString(),
        temperature: 34.1,
        humidity: 55.1,
        weightKg: 28.01,
        batteryLevelPct: 95,
      });

      // Ingest at T0 + 610s (stored)
      await request(app).post("/api/iot/telemetry").send({
        deviceId: "ESP32-HF-01",
        hiveId: "HIVE-HF-01",
        timestamp: new Date(baseTime.getTime() + 610 * 1000).toISOString(),
        temperature: 34.2,
        humidity: 55.2,
        weightKg: 28.05,
        batteryLevelPct: 94,
      });

      const res = await request(app)
        .get("/api/iot/telemetry/HIVE-HF-01")
        .expect(200);

      expect(res.body.success).to.be.true;
      expect(res.body.hiveId).to.equal("HIVE-HF-01");
      expect(res.body.data).to.have.lengthOf(2);
      expect(res.body.data[0].temperature).to.equal(34.0);
      expect(res.body.data[1].temperature).to.equal(34.2);
    });
  });
});
