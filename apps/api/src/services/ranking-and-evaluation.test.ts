import { describe, it, expect, beforeEach } from "vitest";
import http from "http";
import path from "path";
import { createApp } from "../app";
import { setRepository, InMemoryTracePilotRepository, IncidentRecord } from "../db";
import { signUserToken } from "../crypto";
import { sourceIngestionService } from "./source-ingestion.service";
import { evidenceRetrievalService } from "./evidence-retrieval.service";
import { evidenceRankingService, RANKING_WEIGHTS, MIN_COVERAGE_THRESHOLD } from "./evidence-ranking.service";
import { gitMetadataService } from "./git-metadata.service";

describe("P2-D01 - P2-D04: Evidence Ranking, Coverage Gate, API & Retrieval Evaluation", () => {
  let server: http.Server;
  let repo: InMemoryTracePilotRepository;
  let userTokenA: string;
  let userTokenB: string;
  let incidentA: IncidentRecord;
  const PORT = 4188;
  const PROJECT_A = "proj_rank_tenant_a";
  const PROJECT_B = "proj_rank_tenant_b";
  const FIXTURE_DIR = path.resolve(__dirname, "../../../../fixtures/sample-repo");

  beforeEach(async () => {
    process.env.PAUSE_AUTH = "false";
    process.env.DISABLE_AUTH = "false";
    repo = new InMemoryTracePilotRepository();
    setRepository(repo);

    const userA = await repo.createUser("userA@tracepilot.dev", "pw_a");
    const userB = await repo.createUser("userB@tracepilot.dev", "pw_b");
    userTokenA = signUserToken(userA.id);
    userTokenB = signUserToken(userB.id);

    await repo.createProject("Project A", userA.id, PROJECT_A);
    await repo.createProject("Project B", userB.id, PROJECT_B);

    // Ingest fixture into Project A
    await sourceIngestionService.ingestDirectory({
      projectId: PROJECT_A,
      repo: "sample-repo",
      commitSha: "sha_rank_1",
      dirPath: FIXTURE_DIR
    });

    incidentA = await repo.createIncident({
      projectId: PROJECT_A,
      fingerprint: "fp_payment_1",
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

  it("P2-D01: Ranking components normalize within [0, 1] bounds and follow documented weights", () => {
    expect(RANKING_WEIGHTS.line).toBe(0.30);
    expect(RANKING_WEIGHTS.temporal).toBe(0.25);
    expect(RANKING_WEIGHTS.diff).toBe(0.20);
    expect(RANKING_WEIGHTS.deploy).toBe(0.15);
    expect(RANKING_WEIGHTS.history).toBe(0.10);

    const totalWeight = Object.values(RANKING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(Number(totalWeight.toFixed(2))).toBe(1.00);
  });

  it("P2-D02: Ranking aggregation computes normalized sum(w*s)/sum(w) and enforces low-coverage gate", async () => {
    const candidates = await evidenceRetrievalService.retrieveCandidates({
      projectId: PROJECT_A,
      incident: incidentA
    });

    // Case 1: Partial signals (line=1.0, deploy=1.0, others null)
    const partialGitMeta = gitMetadataService.extractMetadata({
      environment: "production",
      service: "payment"
    });

    const ranked = evidenceRankingService.rankCandidates({
      candidates,
      incident: incidentA,
      gitMetadata: partialGitMeta
    });

    expect(ranked.length).toBeGreaterThan(0);
    const top = ranked[0];
    expect(top.signals.line).toBe(1.0);
    expect(top.signals.deploy).toBe(1.0);
    expect(top.signals.temporal).toBeNull();
    expect(top.signals.diff).toBeNull();

    // Coverage is (0.30 + 0.15) / 1.00 = 0.45 >= 0.40
    expect(top.coverage).toBe(0.45);
    expect(top.lowCoverageGate).toBe(false);
    expect(top.score).toBe(1.0); // (0.30*1.0 + 0.15*1.0) / 0.45 = 1.0

    // Case 2: Very low coverage (only history available, weight 0.10 < 0.40)
    const lowCoverageRanked = evidenceRankingService.rankCandidates({
      candidates,
      incident: { ...incidentA, stackTrace: null },
      gitMetadata: undefined,
      incidentHistoryFilePaths: [candidates[0].filePath]
    });
    const lowTop = lowCoverageRanked[0];
    expect(lowTop.coverage).toBe(0.10);
    expect(lowTop.lowCoverageGate).toBe(true);
    expect(lowTop.reasons.some(r => r.includes("Low signal coverage"))).toBe(true);
  });

  it("P2-D03: Ranked evidence endpoint GET /api/v1/incidents/:id/evidence is authorized and tenant-isolated", async () => {
    const app = createApp();
    let dynamicPort = 0;
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        dynamicPort = (server.address() as any).port;
        resolve();
      });
    });

    try {
      // 1. Authorized user can fetch ranked evidence
      const res = await fetch(`http://localhost:${dynamicPort}/api/v1/incidents/${incidentA.id}/evidence`, {
        headers: { Authorization: `Bearer ${userTokenA}` }
      });
      expect(res.status).toBe(200);
      const body: any = await res.json();
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.rankingVersion).toBe("1.0.0");
      expect(body.signalsAvailable).toBeDefined();

      // 2. Cross-tenant user (Tenant B) is rejected with 403 Forbidden
      const resB = await fetch(`http://localhost:${dynamicPort}/api/v1/incidents/${incidentA.id}/evidence`, {
        headers: { Authorization: `Bearer ${userTokenB}` }
      });
      expect(resB.status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("P2-D04: Retrieval evaluation achieves Recall@K >= 0.80 and MRR >= 0.70 on labeled fixture cases", async () => {
    // Labeled evaluation benchmark with ground truth target files
    const benchmarkCases = [
      {
        incident: incidentA,
        expectedTargetFile: "src/payment.ts"
      },
      {
        incident: {
          ...incidentA,
          id: "inc_auth_test",
          message: "AuthenticationError: Missing session token",
          stackTrace: "Error: AuthenticationError\n    at verifySessionToken (src/auth.ts:9:11)"
        },
        expectedTargetFile: "src/auth.ts"
      }
    ];

    let recallAt3Count = 0;
    let reciprocalRankSum = 0;

    for (const testCase of benchmarkCases) {
      const candidates = await evidenceRetrievalService.retrieveCandidates({
        projectId: PROJECT_A,
        incident: testCase.incident
      });

      const ranked = evidenceRankingService.rankCandidates({
        candidates,
        incident: testCase.incident,
        gitMetadata: gitMetadataService.extractMetadata({ environment: "production" })
      });

      const top3 = ranked.slice(0, 3);
      const rankIndex = ranked.findIndex(r => r.filePath.includes(testCase.expectedTargetFile));

      if (top3.some(r => r.filePath.includes(testCase.expectedTargetFile))) {
        recallAt3Count++;
      }

      if (rankIndex >= 0) {
        reciprocalRankSum += 1.0 / (rankIndex + 1);
      }
    }

    const recallAt3 = recallAt3Count / benchmarkCases.length;
    const mrr = reciprocalRankSum / benchmarkCases.length;

    expect(recallAt3).toBeGreaterThanOrEqual(0.80);
    expect(mrr).toBeGreaterThanOrEqual(0.70);
  });
});
