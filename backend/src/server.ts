import http from "node:http";
import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB, setupGracefulShutdown } from "./config/db.js";
import { mlService } from "./services/ml.service.js";
import { yieldMLService } from "./services/yieldML.service.js";
import { socketService } from "./services/socket.service.js";
import { redisService } from "./services/redis.service.js";
import { populateHiveLocations } from "./scripts/populateHiveLocations.js";
import { seed48hTelemetryIfNeeded } from "./scripts/seed48hTelemetry.js";
import { hiveHealthScheduler } from "./services/hiveHealthScheduler.service.js";

const PORT = env.PORT || 5000;

const httpServer = http.createServer(app);
socketService.init(httpServer);

async function startServer() {
  try {
    // Initialize production-quality database connection with connection pooling
    await connectDB(env.MONGO_URI);

    // Backfill any hives missing location data from parent apiary
    populateHiveLocations().catch((err) =>
      console.warn("[HoneyChain] Hive location backfill warning:", err.message)
    );

    // Ensure hives have 48-hour continuous sensor telemetry for AI evaluations
    seed48hTelemetryIfNeeded(false).catch((err) =>
      console.warn("[HoneyChain] 48h telemetry check warning:", err.message)
    );

    // Start automated hourly hive health and Gemini reasoning loop
    hiveHealthScheduler.start();

    httpServer.listen(PORT, () => {
      console.log(`[HoneyChain] API server running on http://localhost:${PORT}`);
      console.log(`[HoneyChain] Connected to Ethereum Sepolia contract: ${env.CONTRACT_ADDRESS}`);

      // Asynchronously probe external ML microservices availability
      mlService.checkHealth().then((health) => {
        if (health.healthy) {
          console.log(`[HoneyChain] Connected to Hive Health ML at ${health.serviceUrl} (Tiers: ${health.tiers.join(", ")})`);
        } else {
          console.log(`[HoneyChain] Hive Health ML at ${health.serviceUrl} is not reachable yet (${health.error || "offline"})`);
        }
      });

      yieldMLService.checkHealth().then((health) => {
        if (health.healthy) {
          console.log(`[HoneyChain] Connected to Yield & Harvest ML at ${health.serviceUrl} (Model: ${health.modelVersion})`);
        } else {
          console.log(`[HoneyChain] Yield & Harvest ML at ${health.serviceUrl} is not reachable yet (${health.error || "offline"})`);
        }
      });
    });

    // Register graceful shutdown listeners for SIGINT and SIGTERM
    setupGracefulShutdown(httpServer, async () => {
      hiveHealthScheduler.stop();
      socketService.close();
      await redisService.close();
    });
  } catch (err: any) {
    console.error("[HoneyChain] Fatal startup failure:", err.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export { httpServer };
export default app;