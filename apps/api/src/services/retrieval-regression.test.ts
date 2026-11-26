import { describe, it, expect, beforeEach } from "vitest";
import path from "path";
import { setRepository, InMemoryTracePilotRepository, IncidentRecord } from "../db";
import { sourceIngestionService } from "./source-ingestion.service";
import { evidenceRetrievalService, parseStackFrames } from "./evidence-retrieval.service";
import { gitMetadataService } from "./git-metadata.service";

describe("P2-C01 - P2-C03: Authorized Retrieval, Git Metadata & Regression", () => {
  let repo: InMemoryTracePilotRepository;
  const PROJECT_A = "proj_retrieval_a";
  const PROJECT_B = "proj_retrieval_b";
  const FIXTURE_DIR = path.resolve(__dirname, "../../../../fixtures/sample-repo");

  beforeEach(async () => {
    repo = new InMemoryTracePilotRepository();
    setRepository(repo);

    // Ingest fixture into Project A
    await sourceIngestionService.ingestDirectory({
      projectId: PROJECT_A,
      repo: "sample-repo",
      commitSha: "sha_c01",
      dirPath: FIXTURE_DIR
    });
  });

  it("P2-C01: Stack trace frame parser extracts function name, file path, and line numbers", () => {
    const stack = `Error: Invalid payment amount
    at validatePaymentRequest (src/payment.ts:10:11)
    at processPayment (src/payment.ts:25:3)
    at Object.<anonymous> (server.ts:40:5)`;

    const frames = parseStackFrames(stack);
    expect(frames.length).toBe(3);
    expect(frames[0].functionName).toBe("validatePaymentRequest");
    expect(frames[0].filePath).toBe("src/payment.ts");
    expect(frames[0].lineNumber).toBe(10);
    expect(frames[1].functionName).toBe("processPayment");
    expect(frames[1].lineNumber).toBe(25);
  });

  it("P2-C01: Authorized retrieval returns revision-correct evidence matching stack frames", async () => {
    const incident: IncidentRecord = {
      id: "inc_test_1",
      projectId: PROJECT_A,
      fingerprint: "fp_test_1",
      eventType: "exception",
      exceptionType: "Error",
      message: "Invalid payment amount: must be positive",
      stackTrace: "Error: Invalid payment amount\n    at validatePaymentRequest (src/payment.ts:10:11)",
      environment: "production",
      release: "1.0.0",
      runtime: { language: "typescript", version: "5.0", platform: "node" },
      context: { service: "payment" },
      occurredAt: new Date(),
      status: "unresolved",
      createdAt: new Date()
    };

    const candidates = await evidenceRetrievalService.retrieveCandidates({
      projectId: PROJECT_A,
      incident,
      commitSha: "sha_c01"
    });

    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    expect(top.filePath).toContain("payment.ts");
    expect(top.stackFrameMatch?.matched).toBe(true);
    expect(top.stackFrameMatch?.targetLine).toBe(10);
    expect(top.stackFrameMatch?.distance).toBe(0); // in range
  });

  it("P2-C02: Git and deployment metadata extractor handles local git and marks absent signals unavailable", () => {
    // When no git repo or invalid path is passed, signals are marked unavailable without throwing
    const meta = gitMetadataService.extractMetadata({
      environment: "production",
      service: "payment"
    });

    expect(meta.signalsAvailable.gitCommit).toBe(false);
    expect(meta.signalsAvailable.gitDiff).toBe(false);
    expect(meta.signalsAvailable.deployment).toBe(false);
    expect(meta.unavailableReasons.git).toBeDefined();
    expect(meta.unavailableReasons.deployment).toBeDefined();

    // When deployment time is provided
    const deployMeta = gitMetadataService.extractMetadata({
      environment: "staging",
      service: "payment",
      deploymentTime: new Date("2026-11-24T12:00:00Z")
    });
    expect(deployMeta.signalsAvailable.deployment).toBe(true);
    expect(deployMeta.environment).toBe("staging");
  });

  it("P2-C03: Retrieval regression: empty results handling and strict tenant isolation", async () => {
    const incidentB: IncidentRecord = {
      id: "inc_test_b",
      projectId: PROJECT_B,
      fingerprint: "fp_test_b",
      eventType: "exception",
      exceptionType: "Error",
      message: "Payment failed in Tenant B",
      stackTrace: "Error: Payment failed\n    at validatePaymentRequest (src/payment.ts:10:11)",
      environment: "production",
      release: "1.0.0",
      runtime: { language: "typescript", version: "5.0", platform: "node" },
      context: {},
      occurredAt: new Date(),
      status: "unresolved",
      createdAt: new Date()
    };

    // Tenant B has 0 evidence ingested
    const candidatesB = await evidenceRetrievalService.retrieveCandidates({
      projectId: PROJECT_B,
      incident: incidentB
    });

    expect(candidatesB).toEqual([]); // Zero results returned, does not leak Tenant A evidence!
  });
});
