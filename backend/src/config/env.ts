import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGO_URI: z.string().default(process.env.MONGODB_URI || "mongodb://localhost:27017/honeychain"),
  MONGO_DB_NAME: z.string().default("honeychain"),
  JWT_SECRET: z.string().default("honeychain_dev_jwt_secret_change_in_production"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  GOOGLE_CLIENT_ID: z.string().default("dev-google-client-id"),
  RATE_LIMIT_WINDOW_MS: z.string().default("900000"),
  RATE_LIMIT_MAX: z.string().default("100"),

  // Blockchain Configuration (Ethereum Sepolia Testnet - Chain ID: 11155111)
  SEPOLIA_RPC_URL: z.string().default("https://ethereum-sepolia-rpc.publicnode.com"),
  CONTRACT_ADDRESS: z.string().default("0x65afF3B44441FfF68171a9a0AA28063BC83C208d"),

  // Dedicated Testnet Wallets for Backend Role Simulation
  ADMIN_PRIVATE_KEY: z.string().optional(),
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  BEEKEEPER_PRIVATE_KEY: z.string().optional(),
  LABORATORY_PRIVATE_KEY: z.string().optional(),
  LAB_PRIVATE_KEY: z.string().optional(),
  PROCESSOR_PRIVATE_KEY: z.string().optional(),
  DISTRIBUTOR_PRIVATE_KEY: z.string().optional(),
  TRANSPORTER_PRIVATE_KEY: z.string().optional(),
  AUDITOR_PRIVATE_KEY: z.string().optional(),

  // Demo user seeding password
  DEMO_PASSWORD: z.string().default("Password123!"),

  // IoT Telemetry Simulation (hits backend itself over HTTP)
  IOT_TARGET_URL: z.string().optional(),
  IOT_INTERVAL_MS: z.string().optional(),

  // Frontend URL / CORS Origin (for separate frontend service, e.g. https://honeychain-frontend.onrender.com or http://localhost:3000)
  FRONTEND_URL: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),

  // Public Base URL for Consumer QR Verification (e.g. https://honeychain-frontend.onrender.com or http://localhost:3000)
  PUBLIC_BASE_URL: z.string().optional(),

  // Independent Python ML Inference Microservices
  ML_SERVICE_URL: z.string().default("http://localhost:5001"),
  ML_API_KEY: z.string().optional(),
  ML_TIMEOUT_MS: z.string().default("10000"),
  YIELD_ML_SERVICE_URL: z.string().default("https://honeychain-yield-ml.onrender.com"),

  // Cloudinary Document Storage
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // IoT High-Frequency Telemetry & Persistence Intervals
  TELEMETRY_PERSIST_INTERVAL_SECONDS: z.string().default("600"),
  TELEMETRY_EXPECTED_INTERVAL_SECONDS: z.string().default("30"),
  TELEMETRY_RECENT_LIMIT: z.string().default("10"),

  // Redis Live Telemetry Buffer
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Twilio SMS Alerting
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  TWILIO_ALERT_TO_NUMBER: z.string().optional(),
  TWILIO_SMS_COOLDOWN_SECONDS: z.string().default("900"),

  // Gemini AI Decision Support & Reasoning
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),
  GEMINI_COOLDOWN_HOURS: z.string().default("6"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

export const env = {
  ...parsed.data,
  MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || parsed.data.MONGO_URI,
  ADMIN_PRIVATE_KEY: parsed.data.ADMIN_PRIVATE_KEY || parsed.data.DEPLOYER_PRIVATE_KEY,
  LABORATORY_PRIVATE_KEY: parsed.data.LABORATORY_PRIVATE_KEY || parsed.data.LAB_PRIVATE_KEY,
  TRANSPORTER_PRIVATE_KEY: parsed.data.TRANSPORTER_PRIVATE_KEY || parsed.data.DISTRIBUTOR_PRIVATE_KEY,
  DISTRIBUTOR_PRIVATE_KEY: parsed.data.DISTRIBUTOR_PRIVATE_KEY || parsed.data.TRANSPORTER_PRIVATE_KEY,
  FRONTEND_URL: parsed.data.FRONTEND_URL || parsed.data.CORS_ORIGIN,
  PUBLIC_BASE_URL: parsed.data.PUBLIC_BASE_URL
    ? parsed.data.PUBLIC_BASE_URL.replace(/\/+$/, "")
    : (parsed.data.FRONTEND_URL ? parsed.data.FRONTEND_URL.split(",")[0].trim().replace(/\/+$/, "") : undefined),
  TELEMETRY_PERSIST_INTERVAL_SECONDS: parseInt(parsed.data.TELEMETRY_PERSIST_INTERVAL_SECONDS || "600", 10) || 600,
  TELEMETRY_EXPECTED_INTERVAL_SECONDS: parseInt(parsed.data.TELEMETRY_EXPECTED_INTERVAL_SECONDS || "30", 10) || 30,
  TELEMETRY_RECENT_LIMIT: parseInt(parsed.data.TELEMETRY_RECENT_LIMIT || "10", 10) || 10,
  TWILIO_SMS_COOLDOWN_SECONDS: parseInt(parsed.data.TWILIO_SMS_COOLDOWN_SECONDS || "900", 10) || 900,
  GEMINI_COOLDOWN_HOURS: parseInt(parsed.data.GEMINI_COOLDOWN_HOURS || "6", 10) || 6,
};