import { describe, it, expect, beforeEach } from "vitest";
import http from "http";
import path from "path";
import { createApp } from "../app";
import { setRepository, InMemoryTracePilotRepository, IncidentRecord } from "../db";
import { signUserToken } from "../crypto";
import { sourceIngestionService } from "./source-ingestion.service";
import { evidenceRetrievalService } from "./evidence-retrieval.service";
import { evidenceRankingService } from "./evidence-ranking.service";
import { analysisService, OfflineTestProvider } from "./analysis.service";

describe("P2-E01 - P2-E03: AI Analysis Jobs, Schema Citations, Safety & Feedback", () => {
  let server: http.Server;
  let repo: InMemoryTracePilotRepository;
  let userTokenA: string;
  let userTokenB: string;
  let incidentA: IncidentRecord;
  const PORT = 4192;
  const PROJECT_A = "proj_ai_tenant_a";
  const PROJECT_B = "proj_ai_tenant_b";
  const FIXTURE_DIR = path.resolve(__dirname, "../../../../fixtures/sample-repo");

  beforeEach(async () => {
    process.env.PAUSE_AUTH = "false";
    process.env.DISABLE_AUTH = "false";
    repo = new InMemoryTracePilotRepository();
    setRepository(repo);

    analysisService.setProvider(new OfflineTestProvider());

    const userA = await repo.createUser("aiUserA@tracepilot.dev", "pw_a");
    const userB = await repo.createUser("aiUserB@tracepilot.dev", "pw_b");
    userTokenA = signUserToken(userA.id);
    userTokenB = signUserToken(userB.id);

    await repo.createProject("AI Project A", userA.id, PROJECT_A);
    await repo.createProject("AI Project B", userB.id, PROJECT_B);

    await sourceIngestionService.ingestDirectory({
      projectId: PROJECT_A,
      repo: "sample-repo",
      commitSha: "sha_ai_1",
      dirPath: FIXTURE_DIR
    });

    incidentA = await repo.createIncident({
      projectId: PROJECT_A,
      fingerprint: "fp_ai_payment_1",
      eventType: "exception",
      exceptionType: "Error",
      message: "Invalid payment amount: must be positive",
      stackTrace: "Error: Invalid payment amount\n    at validatePaymentRequest (src/payment.ts:10:11)",
      environment: "production",
      release: "1.0.0",
      runtime: { language: "typescript", version: "5.0", platform: "node" },
      context: { service: "payment" },
      occurredAt: new Date()
    });
  });

  it("P2-E01: POST /api/v1/incidents/:id/analyses creates durable analysis job with 202 Accepted", async () => {
    const app = createApp();
    let port = 0;
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/incidents/${incidentA.id}/analyses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userTokenA}` }
      });

      expect(res.status).toBe(202);
      const body: any = await res.json();
      expect(body.data.id).toBeDefined();
      expect(body.data.status).toBe("completed");
      expect(body.data.summary).toBeDefined();
      expect(body.data.rootCause).toBeDefined();
      expect(body.data.suggestedFix).toBeDefined();
      expect(body.data.evidenceRefs).toBeDefined();
      expect(Array.isArray(body.data.evidenceRefs)).toBe(true);

      // Verify GET /api/v1/incidents/:id/analyses/:jobId returns the completed job
      const getRes = await fetch(`http://localhost:${port}/api/v1/incidents/${incidentA.id}/analyses/${body.data.id}`, {
        headers: { Authorization: `Bearer ${userTokenA}` }
      });
      expect(getRes.status).toBe(200);
      const getBody: any = await getRes.json();
      expect(getBody.data.id).toBe(body.data.id);

      // Verify GET /api/v1/incidents/:id/analyses lists the job
      const listRes = await fetch(`http://localhost:${port}/api/v1/incidents/${incidentA.id}/analyses`, {
        headers: { Authorization: `Bearer ${userTokenA}` }
      });
      expect(listRes.status).toBe(200);
      const listBody: any = await listRes.json();
      expect(listBody.data.length).toBeGreaterThanOrEqual(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("P2-E02: Citation validation enforces that all cited evidenceRefs exist in authorized pool", async () => {
    const candidates = await evidenceRetrievalService.retrieveCandidates({
      projectId: PROJECT_A,
      incident: incidentA
    });

    const ranked = evidenceRankingService.rankCandidates({
      candidates,
      incident: incidentA
    });

    const authorizedIds = new Set(ranked.map(r => r.id));

    // Custom provider attempting to return a hallucinated ID
    const hallucinatingProvider = {
      name: "hallucinating-provider",
      async analyze() {
        return JSON.stringify({
          summary: "Hallucinated diagnosis",
          rootCause: "Fake cause",
          supportLevel: "moderate",
          alternativeHypotheses: [],
          suggestedFix: "Fake fix",
          validationSteps: [],
          patchDiff: null,
          uncertainty: "None",
          evidenceRefs: ["fake_hallucinated_id_12345", "cross_tenant_id_99999"],
          modelVersion: "test",
          rankingVersion: "1.0.0"
        });
      }
    };

    analysisService.setProvider(hallucinatingProvider);
    const job = await analysisService.runAnalysis({
      incident: incidentA,
      rankedEvidence: ranked
    });

    // Hallucinated IDs must be rejected/filtered out!
    expect(job.evidenceRefs?.includes("fake_hallucinated_id_12345")).toBe(false);
    expect(job.evidenceRefs?.includes("cross_tenant_id_99999")).toBe(false);
    expect(job.evidenceRefs?.every(id => authorizedIds.has(id))).toBe(true);
  });

  it("P2-E03: Explicit abstention occurs when evidence is insufficient or low-coverage gate triggers", async () => {
    // Empty evidence pool
    const job = await analysisService.runAnalysis({
      incident: incidentA,
      rankedEvidence: []
    });

    expect(job.status).toBe("completed");
    expect(job.supportLevel).toBe("insufficient");
    expect(job.rootCause).toContain("Abstained");
    expect(job.evidenceRefs).toEqual([]);
    expect(job.patchDiff).toBeNull();
  });

  it("P2-F01: User feedback submission is recorded and tenant-isolated", async () => {
    const app = createApp();
    let port = 0;
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });

    try {
      // Create analysis job
      const createRes = await fetch(`http://localhost:${port}/api/v1/incidents/${incidentA.id}/analyses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${userTokenA}` }
      });
      const createBody: any = await createRes.json();
      const jobId = createBody.data.id;

      // Submit feedback as Tenant A
      const fbRes = await fetch(`http://localhost:${port}/api/v1/incidents/${incidentA.id}/analyses/${jobId}/feedback`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userTokenA}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          helpful: true,
          score: 5,
          comment: "Accurate root cause analysis and clean patch diff."
        })
      });

      expect(fbRes.status).toBe(200);
      const fbBody: any = await fbRes.json();
      expect(fbBody.data.feedback.helpful).toBe(true);
      expect(fbBody.data.feedback.score).toBe(5);

      // Attempt feedback as Tenant B returns 403 Forbidden
      const fbResB = await fetch(`http://localhost:${port}/api/v1/incidents/${incidentA.id}/analyses/${jobId}/feedback`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userTokenB}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ helpful: false })
      });
      expect(fbResB.status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
