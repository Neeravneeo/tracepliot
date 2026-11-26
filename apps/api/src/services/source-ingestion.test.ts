import { describe, it, expect, beforeEach } from "vitest";
import path from "path";
import { setRepository, InMemoryTracePilotRepository } from "../db";
import {
  sourceIngestionService,
  chunkCode,
  isSafeToIngest,
  generateEvidenceId
} from "./source-ingestion.service";

describe("P2-B01 - P2-B04: Source Ingestion, Vector Identity & Ingestion Regression", () => {
  let repo: InMemoryTracePilotRepository;
  const PROJECT_A = "proj_tenant_a_123";
  const PROJECT_B = "proj_tenant_b_456";
  const FIXTURE_DIR = path.resolve(__dirname, "../../../../fixtures/sample-repo");

  beforeEach(() => {
    repo = new InMemoryTracePilotRepository();
    setRepository(repo);
  });

  it("P2-B01: Chunking produces exact 1-based inclusive line ranges and respects boundaries", () => {
    const code = "line 1\nline 2\nline 3\nline 4\nline 5\nline 6\nline 7\nline 8\nline 9\nline 10";
    const chunks = chunkCode(code, 5, 2);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].startLine).toBe(1);
    expect(chunks[0].endLine).toBe(5);
    expect(chunks[0].content).toBe("line 1\nline 2\nline 3\nline 4\nline 5");

    // Second chunk starts with overlap
    expect(chunks[1].startLine).toBe(4);
    expect(chunks[1].endLine).toBe(8);
  });

  it("P2-B01: File exclusion excludes secrets, lockfiles, and binary assets", () => {
    expect(isSafeToIngest(".env")).toBe(false);
    expect(isSafeToIngest(".env.secret")).toBe(false);
    expect(isSafeToIngest("private.key")).toBe(false);
    expect(isSafeToIngest("package-lock.json")).toBe(false);
    expect(isSafeToIngest("logo.png")).toBe(false);
    expect(isSafeToIngest("archive.zip")).toBe(false);

    expect(isSafeToIngest("src/payment.ts")).toBe(true);
    expect(isSafeToIngest("src/auth.ts")).toBe(true);
  });

  it("P2-B02: Vector identity is strictly deterministic and tenant-scoped", () => {
    const id1 = generateEvidenceId(PROJECT_A, "commit_sha_1", "src/payment.ts", 0);
    const id2 = generateEvidenceId(PROJECT_A, "commit_sha_1", "src/payment.ts", 0);
    const idTenantB = generateEvidenceId(PROJECT_B, "commit_sha_1", "src/payment.ts", 0);
    const idChunk1 = generateEvidenceId(PROJECT_A, "commit_sha_1", "src/payment.ts", 1);

    expect(id1).toBe(id2); // Identical inputs yield identical ID
    expect(id1).not.toBe(idTenantB); // Different tenant yields different ID
    expect(id1).not.toBe(idChunk1); // Different chunk index yields different ID
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("P2-B03 & P2-B04: Initial ingestion ingests fixture safe files, records job state, and prunes safely", async () => {
    const result = await sourceIngestionService.ingestDirectory({
      projectId: PROJECT_A,
      repo: "tracepilot/sample-repo",
      commitSha: "sha_rev_1",
      dirPath: FIXTURE_DIR
    });

    expect(result.status).toBe("completed");
    expect(result.filesProcessed).toBeGreaterThanOrEqual(2); // payment.ts and auth.ts
    expect(result.chunksCreated).toBeGreaterThanOrEqual(2);

    const storedEvidence = await repo.listCodeEvidence(PROJECT_A);
    expect(storedEvidence.length).toBe(result.chunksCreated);
    expect(storedEvidence.some(e => e.filePath.includes("payment.ts"))).toBe(true);
    expect(storedEvidence.some(e => e.filePath.includes("auth.ts"))).toBe(true);
    expect(storedEvidence.some(e => e.filePath.includes(".env"))).toBe(false);
    expect(storedEvidence.some(e => e.filePath.includes("logo.png"))).toBe(false);

    // Repeated ingestion is idempotent
    const repeatResult = await sourceIngestionService.ingestDirectory({
      projectId: PROJECT_A,
      repo: "tracepilot/sample-repo",
      commitSha: "sha_rev_1",
      dirPath: FIXTURE_DIR
    });
    expect(repeatResult.chunksCreated).toBe(result.chunksCreated);
    const afterRepeat = await repo.listCodeEvidence(PROJECT_A);
    expect(afterRepeat.length).toBe(storedEvidence.length); // No duplicates
  });

  it("P2-B04: Historical revision preservation and tenant isolation", async () => {
    // Ingest revision 1 for Tenant A
    await sourceIngestionService.ingestDirectory({
      projectId: PROJECT_A,
      repo: "sample",
      commitSha: "commit_v1",
      dirPath: FIXTURE_DIR
    });

    // Ingest revision 2 for Tenant A
    await sourceIngestionService.ingestDirectory({
      projectId: PROJECT_A,
      repo: "sample",
      commitSha: "commit_v2",
      dirPath: FIXTURE_DIR
    });

    // Both revisions must coexist in database
    const rev1 = await repo.findCodeEvidenceByRevision(PROJECT_A, "commit_v1");
    const rev2 = await repo.findCodeEvidenceByRevision(PROJECT_A, "commit_v2");
    expect(rev1.length).toBeGreaterThan(0);
    expect(rev2.length).toBeGreaterThan(0);

    // Ingest for Tenant B
    await sourceIngestionService.ingestDirectory({
      projectId: PROJECT_B,
      repo: "sample-b",
      commitSha: "commit_v1",
      dirPath: FIXTURE_DIR
    });

    const tenantAEvidence = await repo.listCodeEvidence(PROJECT_A);
    const tenantBEvidence = await repo.listCodeEvidence(PROJECT_B);
    expect(tenantAEvidence.every(e => e.projectId === PROJECT_A)).toBe(true);
    expect(tenantBEvidence.every(e => e.projectId === PROJECT_B)).toBe(true);
  });
});
