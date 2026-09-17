import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import batchRoutes from "./routes/batch.routes.js";
import verifyRoutes from "./routes/verify.routes.js";
import iotRoutes from "./routes/iot.routes.js";
import mlRoutes from "./routes/ml.routes.js";
import authRoutes from "./routes/auth.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import apiaryRoutes from "./routes/apiary.routes.js";
import hiveRoutes from "./routes/hive.routes.js";
import harvestRoutes from "./routes/harvest.routes.js";
import alertRoutes from "./routes/alert.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import errorHandler from "./middlewares/errorHandler.js";
import AppError from "./utils/AppError.js";
import Batch from "./models/Batch.js";

import { env } from "./config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const HTML_FILE = fs.existsSync(path.join(PUBLIC_DIR, "index.html"))
  ? path.join(PUBLIC_DIR, "index.html")
  : path.resolve(__dirname, "../index.html");

const app = express();

// Cross-Origin Resource Sharing (CORS) Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  ...(env.FRONTEND_URL ? env.FRONTEND_URL.split(",").map((s) => s.trim().replace(/\/+$/, "")) : []),
  ...(env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",").map((s) => s.trim().replace(/\/+$/, "")) : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Check if origin is explicitly allowed
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        return callback(null, true);
      }

      // Allow any localhost origin in non-production
      if (process.env.NODE_ENV !== "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      // Allow Render and Vercel preview/production domains
      if (origin.endsWith(".onrender.com") || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      // Permissive fallback so legitimate client calls are not blocked
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
    exposedHeaders: ["Set-Cookie"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Dedicated Production Health Check
app.get("/health", (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  const status = isDbConnected ? "ok" : "degraded";
  const statusCode = isDbConnected ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: isDbConnected ? "connected" : "disconnected",
    },
    blockchain: {
      network: "Ethereum Sepolia",
      chainId: 11155111,
    },
  });
});

// Root Information / Landing Page
app.get("/", (req, res) => {
  // If API client explicitly asking for JSON without HTML, return API metadata
  if (!req.accepts("html") && req.accepts("json")) {
    return res.json({
      success: true,
      message: "HoneyChain backend is running",
      version: "1.0.0",
      network: "Ethereum Sepolia",
    });
  }

  // Serve static HTML page if available, otherwise send inline lightweight HTML
  if (fs.existsSync(HTML_FILE)) {
    return res.sendFile(HTML_FILE);
  }

  res.type("html").send(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>HoneyChain Backend &bull; Batch Provenance Verification</title><link rel="icon" type="image/png" href="/logohb.png"><link rel="shortcut icon" type="image/png" href="/logohb.png"></head><body style="font-family:system-ui,sans-serif;background:#0d0a07;color:#fbf8f2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;"><div style="text-align:center;padding:32px;border:1px solid #2a2015;border-radius:12px;background:#14100b;max-width:520px;"><h1 style="color:#d69e1f;">HoneyChain</h1><p style="font-size:16px;font-weight:500;margin:8px 0;">This is the backend service.</p><p style="color:#a89f91;font-size:14px;">This server handles API communication and data processing for the frontend.</p></div></body></html>`
  );
});

// Favicon resolution route
app.get("/favicon.ico", (req, res) => {
  const iconPath = path.join(PUBLIC_DIR, "logohb.png");
  if (fs.existsSync(iconPath)) {
    return res.sendFile(iconPath);
  }
  res.status(204).end();
});

// Mount Operational & Provenance Routes
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/iot", iotRoutes);
app.use("/api/ml", mlRoutes);
app.use("/api/apiaries", apiaryRoutes);
app.use("/api/hives", hiveRoutes);
app.use("/hives", hiveRoutes); // Frontend compatibility alias
app.use("/api/harvests", harvestRoutes);
app.use("/harvests", harvestRoutes); // Frontend compatibility alias
app.use("/api/alerts", alertRoutes);
app.use("/api/analytics", analyticsRoutes);

// Static serving for public landing assets and uploaded verification documents (PDFs)
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

// Dedicated Consumer QR Verification Route
app.get(["/verify", "/verify/:batchId"], async (req, res) => {
  const batchId = (req.params as any)?.batchId || "";
  let batchData: any = null;

  if (batchId) {
    try {
      batchData = await Batch.findOne({ batchId: batchId.trim() }).lean();
    } catch {
      // ignore lookup error
    }
  }

  const labReportUrl = batchData?.quality?.labReportUrl;
  const grade = batchData?.quality?.grade || "";
  const moisture =
    batchData?.quality?.moisturePercentage != null
      ? `${batchData.quality.moisturePercentage}%`
      : "";
  const labHash = batchData?.quality?.labReportHash || "";

  let labSection = "";
  if (labReportUrl) {
    labSection = `
    <div style="margin-top: 24px; padding: 20px; background: #fffbe8; border: 1px solid #f6e05e; border-radius: 12px;">
      <h3 style="margin-top: 0; color: #b7791f; font-size: 1.1rem;">Laboratory Certification & Quality Assay</h3>
      <p style="margin: 6px 0;"><strong>Quality Grade:</strong> ${grade} | <strong>Moisture Content:</strong> ${moisture}</p>
      ${
        labHash
          ? `<p style="margin: 6px 0; font-family: monospace; font-size: 12px; word-break: break-all; color: #4a5568;"><strong>SHA-256 Hash:</strong> ${labHash}</p>`
          : ""
      }
      <a id="viewLabReportBtn" href="${labReportUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 14px; padding: 10px 22px; background: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">View Lab Report</a>
    </div>`;
  }

  res
    .status(200)
    .type("html")
    .send(
      `<!DOCTYPE html><html><head><title>HoneyChain Verification</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; color: #1a202c; line-height: 1.5; } h1 { color: #d97706; font-size: 1.6rem; }</style></head><body><h1>HoneyChain Consumer Verification</h1><div id="verifyDisplayArea">${batchId}</div>${labSection}</body></html>`
    );
});

// 404 Route Handler
app.use((req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
