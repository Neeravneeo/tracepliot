import dotenv from "dotenv";
dotenv.config();

import { validateConfig } from "./config";
// Runtime validation of required environment configuration at server startup
validateConfig();

import { createApp } from "./app";
import { initializeQdrantCollection } from "./qdrant";
import { EMBEDDING_DIMENSION } from "./embedding";

process.on("unhandledRejection", (reason) => {
  console.error("[Process] Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Process] Uncaught Exception:", err);
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const app = createApp();

const server = app.listen(port, () => {
  console.log(`🚀 TracePilot API server listening on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  
  // Initialize Qdrant as an optional dependency
  initializeQdrantCollection(EMBEDDING_DIMENSION).catch(err => {
    console.error("Failed to initialize Qdrant:", err);
  });
});

// Graceful shutdown handling (SIGTERM, SIGINT)
function gracefulShutdown(signal: string) {
  console.log(`[Lifecycle] Received ${signal}. Initiating graceful shutdown...`);
  server.close(async () => {
    console.log("[Lifecycle] HTTP server closed. Draining database and active connections...");
    try {
      const { getPrismaClient } = await import("./db");
      const prisma = getPrismaClient();
      await prisma.$disconnect();
      console.log("[Lifecycle] Database client disconnected.");
    } catch {
      // In-memory or offline fallback
    }
    console.log("[Lifecycle] Graceful shutdown complete. Exiting process.");
    process.exit(0);
  });

  // Force exit after 10s if connections refuse to drain
  setTimeout(() => {
    console.error("[Lifecycle] Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

