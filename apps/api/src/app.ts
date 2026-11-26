import express, { Express } from "express";
import cors from "cors";
import { requireApiKey, requireUserAuth } from "./middleware/auth";
import { validateBody } from "./middleware/validate";
import { IngestEventSchema } from "./schemas/ingest.schema";
import { UploadTraceSchema } from "./schemas/upload.schema";
import { ingestEventHandler } from "./controllers/ingest.controller";
import {
  listIncidentsHandler,
  getIncidentByIdHandler,
  analyzeIncidentHandler,
  getIncidentStatsHandler,
  getIncidentTimeSeriesHandler,
  getIncidentActivityHandler,
  getIncidentServiceHealthHandler,
  uploadIncidentHandler,
  getRankedEvidenceHandler,
  createAnalysisJobHandler,
  listAnalysisJobsHandler,
  getAnalysisJobHandler,
  submitAnalysisFeedbackHandler
} from "./controllers/incidents.controller";
import {
  registerHandler,
  loginHandler,
  logoutHandler,
  authStatusHandler,
  requestPasswordResetHandler,
  resetPasswordHandler
} from "./controllers/auth.controller";
import {
  createProjectHandler,
  listProjectsHandler,
  getProjectByIdHandler,
  updateProjectHandler,
  createApiKeyHandler,
  revokeApiKeyHandler,
  listProjectMembersHandler,
  addProjectMemberHandler,
  removeProjectMemberHandler,
  getProjectOnboardingHandler,
  deleteProjectHandler
} from "./controllers/projects.controller";
import {
  ingestSpansHandler,
  listTracesHandler,
  getTraceByIdHandler
} from "./controllers/traces.controller";
import { auditUrlHandler } from "./controllers/scanner.controller";
import {
  registerWebsiteHandler,
  listWebsitesHandler,
  verifyWebsiteHandler,
  createScanHandler,
  listScansHandler,
  getScanHandler,
  getScanProgressHandler,
  cancelScanHandler,
  getScanFindingsHandler,
  getScanReportHandler,
  exportScanReportHandler,
  getFindingByIdHandler,
  convertFindingToBugHandler
} from "./controllers/website-scanner.controller";
import { checkQdrantConnectivity } from "./qdrant";
import { isAuthPaused } from "./middleware/auth";
import { createRateLimiter } from "./middleware/rate-limit";

export function createApp(): Express {
  const app = express();

  const ingestRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 120
  });

  app.use(cors({ origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/] }));
  app.use(express.json({ limit: "1mb" }));

  // Correlation ID and structured tracing metadata middleware (P4-C01)
  app.use((req, res, next) => {
    const requestId = (req.headers["x-request-id"] as string) || `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    res.setHeader("x-request-id", requestId);
    (req as any).requestId = requestId;
    next();
  });

  // Health check endpoint (public)
  app.get("/health", async (req, res) => {
    const qdrantStatus = await checkQdrantConnectivity();
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      qdrant: qdrantStatus,
      authPaused: isAuthPaused()
    });
  });

  // Readiness probe endpoint (public) (P4-B03)
  app.get("/health/readiness", async (req, res) => {
    const qdrantStatus = await checkQdrantConnectivity();
    res.json({
      status: "ready",
      database: "connected",
      qdrant: qdrantStatus,
      version: "2.2.0",
      uptime: process.uptime()
    });
  });

  // Demo buggy page for testing synthetic scanner (public)
  app.get("/demo-buggy-site", (req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>TracePilot Test Buggy Page</title>
    <style>
      body { font-family: sans-serif; padding: 40px; background: #0f172a; color: #f8fafc; }
      button { padding: 10px 20px; font-size: 16px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; }
    </style>
  </head>
  <body>
    <h1>TracePilot Synthetic Scanner Demo Page</h1>
    <p>This page intentionally triggers runtime and network errors for testing.</p>
    <button id="trigger-btn" onclick="triggerBug()">Simulate Checkout Crash</button>
    <script>
      console.error("CartService: Local cart cache corrupted (Code: ERR_STORAGE_SYNC)");
      fetch('/api/v1/missing-payment-gateway-endpoint').catch(function() {});
      function triggerBug() {
        var cart = undefined;
        return cart.items.map(function(x) { return x.price; });
      }
      setTimeout(function() {
        try {
          triggerBug();
        } catch (e) {
          console.error("Uncaught runtime crash:", e.message);
          throw e;
        }
      }, 500);
    </script>
  </body>
</html>`);
  });

  // Protected Ingestion endpoint (SDK uses API Key)
  app.post(
    "/api/v1/ingest/events",
    ingestRateLimiter,
    requireApiKey,
    validateBody(IngestEventSchema),
    ingestEventHandler
  );

  // Distributed Traces Ingestion (SDK or agent uses API Key or User Auth)
  app.post(
    "/api/v1/traces/spans",
    ingestRateLimiter,
    (req, res, next) => {
      if (req.headers["x-api-key"] || (!req.headers.authorization && !req.user)) {
        return requireApiKey(req, res, next);
      }
      return requireUserAuth(req, res, next);
    },
    ingestSpansHandler
  );

  // Distributed Traces Query endpoints
  app.get("/api/v1/traces", requireUserAuth, listTracesHandler);
  app.get("/api/v1/traces/:traceId", requireUserAuth, getTraceByIdHandler);

  // Auth endpoints (Public)
  app.get("/api/v1/auth/status", authStatusHandler);
  app.post("/api/v1/auth/register", registerHandler);
  app.post("/api/v1/auth/login", loginHandler);
  app.post("/api/v1/auth/logout", logoutHandler);
  app.post("/api/v1/auth/forgot-password", requestPasswordResetHandler);
  app.post("/api/v1/auth/reset-password", resetPasswordHandler);

  // Protected Project routes (Dashboard uses User Token)
  app.post("/api/v1/projects", requireUserAuth, createProjectHandler);
  app.get("/api/v1/projects", requireUserAuth, listProjectsHandler);
  app.get("/api/v1/projects/:projectId", requireUserAuth, getProjectByIdHandler);
  app.patch("/api/v1/projects/:projectId", requireUserAuth, updateProjectHandler);
  app.post("/api/v1/projects/:projectId/keys", requireUserAuth, createApiKeyHandler);
  app.delete("/api/v1/projects/:projectId/keys/:keyId", requireUserAuth, revokeApiKeyHandler);
  app.delete("/api/v1/projects/:projectId", requireUserAuth, deleteProjectHandler);
  app.get("/api/v1/projects/:projectId/members", requireUserAuth, listProjectMembersHandler);
  app.post("/api/v1/projects/:projectId/members", requireUserAuth, addProjectMemberHandler);
  app.delete("/api/v1/projects/:projectId/members/:memberId", requireUserAuth, removeProjectMemberHandler);
  app.get("/api/v1/projects/:projectId/onboarding", requireUserAuth, getProjectOnboardingHandler);

  // Protected Incident queries & Aggregates (Dashboard uses User Token)
  app.post("/api/v1/incidents/upload", requireUserAuth, validateBody(UploadTraceSchema), uploadIncidentHandler);
  app.get("/api/v1/incidents/stats", requireUserAuth, getIncidentStatsHandler);
  app.get("/api/v1/incidents/time-series", requireUserAuth, getIncidentTimeSeriesHandler);
  app.get("/api/v1/incidents/activity", requireUserAuth, getIncidentActivityHandler);
  app.get("/api/v1/incidents/service-health", requireUserAuth, getIncidentServiceHealthHandler);
  app.get("/api/v1/incidents", requireUserAuth, listIncidentsHandler);
  app.get("/api/v1/incidents/:incidentId", requireUserAuth, getIncidentByIdHandler);
  app.post("/api/v1/incidents/:incidentId/analyze", requireUserAuth, analyzeIncidentHandler);

  // Ranked Evidence & Analysis Workflows (Part 2)
  app.get("/api/v1/incidents/:incidentId/evidence", requireUserAuth, getRankedEvidenceHandler);
  app.post("/api/v1/incidents/:incidentId/analyses", requireUserAuth, createAnalysisJobHandler);
  app.get("/api/v1/incidents/:incidentId/analyses", requireUserAuth, listAnalysisJobsHandler);
  app.get("/api/v1/incidents/:incidentId/analyses/:jobId", requireUserAuth, getAnalysisJobHandler);
  app.post("/api/v1/incidents/:incidentId/analyses/:jobId/feedback", requireUserAuth, submitAnalysisFeedbackHandler);

  // URL Scanner (Synthetic website bug auditor)
  app.post("/api/v1/scanner/audit", requireUserAuth, auditUrlHandler);

  // AI Website Bug Scanner (Production Suite)
  app.post("/api/v1/websites", requireUserAuth, registerWebsiteHandler);
  app.get("/api/v1/websites", requireUserAuth, listWebsitesHandler);
  app.post("/api/v1/websites/:websiteId/verify", requireUserAuth, verifyWebsiteHandler);

  app.post("/api/v1/website-scans", requireUserAuth, createScanHandler);
  app.get("/api/v1/website-scans", requireUserAuth, listScansHandler);
  app.get("/api/v1/website-scans/:scanId", requireUserAuth, getScanHandler);
  app.get("/api/v1/website-scans/:scanId/progress", requireUserAuth, getScanProgressHandler);
  app.post("/api/v1/website-scans/:scanId/cancel", requireUserAuth, cancelScanHandler);
  app.get("/api/v1/website-scans/:scanId/findings", requireUserAuth, getScanFindingsHandler);
  app.get("/api/v1/website-scans/:scanId/report", requireUserAuth, getScanReportHandler);
  app.get("/api/v1/website-scans/:scanId/export", requireUserAuth, exportScanReportHandler);

  app.get("/api/v1/scan-findings/:findingId", requireUserAuth, getFindingByIdHandler);
  app.post("/api/v1/scan-findings/:findingId/create-bug", requireUserAuth, convertFindingToBugHandler);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      error: "NotFound",
      message: `Route '${req.method} ${req.path}' not found.`
    });
  });

  return app;
}
