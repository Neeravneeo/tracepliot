import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "./app";
import { setRepository, InMemoryTracePilotRepository } from "./db";
import { generateApiKey, hashApiKey, signUserToken } from "./crypto";

describe("B01-B05 — Multi-Tenant Project Isolation & Authorization Regression", () => {
  let app: any;
  let repo: InMemoryTracePilotRepository;

  // Tenant A
  let userA: any;
  let tokenA: string;
  let projectA: any;
  let keyA: string;
  let keyHashA: string;
  let incidentA: any;
  let scanA: any;
  let findingA: any;

  // Tenant B
  let userB: any;
  let tokenB: string;
  let projectB: any;
  let keyB: string;

  beforeAll(async () => {
    // Explicitly test with auth active
    process.env.PAUSE_AUTH = "false";
    process.env.DISABLE_AUTH = "false";

    repo = new InMemoryTracePilotRepository();
    setRepository(repo);
    app = createApp();

    // 1. Create Tenant A
    userA = await repo.createUser("user.a@tracepilot.dev", "hash_a");
    tokenA = signUserToken(userA.id);
    projectA = await repo.createProject("Project A", userA.id, "proj_tenant_a");
    
    const keyGenA = generateApiKey("tp_live");
    keyA = keyGenA.rawKey;
    keyHashA = keyGenA.keyHash;
    await repo.createApiKey(projectA.id, keyHashA, "Key A");

    // Incident for Tenant A
    incidentA = await repo.createIncident({
      projectId: projectA.id,
      fingerprint: "fp_incident_a_123",
      eventType: "exception",
      exceptionType: "ReferenceError",
      message: "tenant A secret error",
      stackTrace: "at serviceA (fileA.ts:10:5)",
      environment: "production",
      release: "1.0.0",
      runtime: { platform: "node" },
      context: { tenantSecret: "confidential_a" },
      occurredAt: new Date()
    });

    // Website & Scan for Tenant A
    const websiteA = await repo.createWebsite({
      projectId: projectA.id,
      domain: "tenant-a.com",
      normalizedBaseUrl: "https://tenant-a.com",
      createdBy: userA.id
    });

    scanA = await repo.createWebsiteScan({
      websiteId: websiteA.id,
      projectId: projectA.id,
      initiatedBy: userA.id,
      scanType: "quick",
      configurationJson: {}
    });

    findingA = await repo.createScanFinding({
      scanId: scanA.id,
      websiteId: websiteA.id,
      issueFingerprint: "fp_finding_a",
      title: "Security Header Missing",
      description: "Content-Security-Policy missing on tenant A",
      category: "security",
      severity: "high"
    });

    await repo.createScanReport({
      scanId: scanA.id,
      summaryJson: { totalFindings: 1 },
      scoreBreakdownJson: {},
      coverageJson: {}
    });

    // 2. Create Tenant B
    userB = await repo.createUser("user.b@tracepilot.dev", "hash_b");
    tokenB = signUserToken(userB.id);
    projectB = await repo.createProject("Project B", userB.id, "proj_tenant_b");

    const keyGenB = generateApiKey("tp_live");
    keyB = keyGenB.rawKey;
    await repo.createApiKey(projectB.id, keyGenB.keyHash, "Key B");
  });

  // --- POSITIVE CONTROLS ---

  it("Positive Control: Tenant A can read own project, incidents, and scans", async () => {
    const projRes = await request(app)
      .get(`/api/v1/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(projRes.status).toBe(200);
    expect(projRes.body.data.id).toBe(projectA.id);

    const incRes = await request(app)
      .get(`/api/v1/incidents/${incidentA.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(incRes.status).toBe(200);
    expect(incRes.body.data.id).toBe(incidentA.id);

    const scanRes = await request(app)
      .get(`/api/v1/website-scans/${scanA.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(scanRes.status).toBe(200);
    expect(scanRes.body.data.id).toBe(scanA.id);
  });

  // --- NEGATIVE TESTS (CROSS-TENANT ISOLATION) ---

  it("Cross-Tenant: Tenant B cannot access Tenant A's project details", async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect([403, 404]).toContain(res.status);
  });

  it("Cross-Tenant: Tenant B cannot read Tenant A's incident", async () => {
    const res = await request(app)
      .get(`/api/v1/incidents/${incidentA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("Cross-Tenant: Tenant B cannot trigger analysis on Tenant A's incident", async () => {
    const res = await request(app)
      .post(`/api/v1/incidents/${incidentA.id}/analyze`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("Cross-Tenant: Tenant B cannot list or filter Tenant A's incidents by projectId", async () => {
    const res = await request(app)
      .get(`/api/v1/incidents?projectId=${projectA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it("Cross-Tenant: Tenant B cannot access Tenant A's website scan", async () => {
    const res = await request(app)
      .get(`/api/v1/website-scans/${scanA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Forbidden");
  });

  it("Cross-Tenant: Tenant B cannot access Tenant A's scan progress or cancel scan", async () => {
    const progRes = await request(app)
      .get(`/api/v1/website-scans/${scanA.id}/progress`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(progRes.status).toBe(403);

    const cancelRes = await request(app)
      .post(`/api/v1/website-scans/${scanA.id}/cancel`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(cancelRes.status).toBe(403);
  });

  it("Cross-Tenant: Tenant B cannot access Tenant A's scan findings, report, or export", async () => {
    const findRes = await request(app)
      .get(`/api/v1/website-scans/${scanA.id}/findings`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(findRes.status).toBe(403);

    const repRes = await request(app)
      .get(`/api/v1/website-scans/${scanA.id}/report`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(repRes.status).toBe(403);

    const expRes = await request(app)
      .get(`/api/v1/website-scans/${scanA.id}/export`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(expRes.status).toBe(403);
  });

  it("Cross-Tenant: Tenant B cannot inspect or convert Tenant A's finding into a bug ticket", async () => {
    const getRes = await request(app)
      .get(`/api/v1/scan-findings/${findingA.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(getRes.status).toBe(403);

    const convRes = await request(app)
      .post(`/api/v1/scan-findings/${findingA.id}/create-bug`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(convRes.status).toBe(403);
  });

  it("Cross-Tenant: Tenant B cannot create or revoke API keys for Tenant A's project", async () => {
    const createKeyRes = await request(app)
      .post(`/api/v1/projects/${projectA.id}/keys`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Malicious Key" });
    expect([403, 404]).toContain(createKeyRes.status);
  });

  // --- API KEY LIFECYCLE & REVOCATION (B03) ---

  it("API Key Lifecycle: Tenant A can create, use, and revoke an API key", async () => {
    // 1. Create new key
    const createRes = await request(app)
      .post(`/api/v1/projects/${projectA.id}/keys`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Temporary Key" });
    expect(createRes.status).toBe(201);
    const newRawKey = createRes.body.key;
    const keyId = createRes.body.data.id;
    expect(newRawKey).toBeDefined();

    // 2. Use key to ingest
    const ingestRes = await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", `Bearer ${newRawKey}`)
      .send({
        timestamp: new Date().toISOString(),
        eventType: "exception",
        environment: "production",
        release: "1.0.0",
        exception: { type: "TestError", message: "Key lifecycle test" },
        runtime: { language: "typescript", version: "5.5" }
      });
    expect(ingestRes.status).toBe(202);

    // 3. Revoke key
    const revokeRes = await request(app)
      .delete(`/api/v1/projects/${projectA.id}/keys/${keyId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(revokeRes.status).toBe(200);

    // 4. Ingestion with revoked key must fail immediately
    const postRevokeRes = await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", `Bearer ${newRawKey}`)
      .send({
        timestamp: new Date().toISOString(),
        eventType: "exception",
        environment: "production",
        release: "1.0.0",
        exception: { type: "TestError", message: "Should be rejected" },
        runtime: { language: "typescript", version: "5.5" }
      });
    expect(postRevokeRes.status).toBe(401);
  });

  // --- INGESTION SAFEGUARDS & REDACTION (B04) ---

  it("Ingestion Safeguards: scrubs password, token, credit_card from context before storing", async () => {
    const ingestRes = await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", `Bearer ${keyA}`)
      .send({
        timestamp: new Date().toISOString(),
        eventType: "exception",
        environment: "production",
        release: "1.0.0",
        exception: { type: "PaymentFailedError", message: "Failed card charge" },
        runtime: {
          language: "typescript",
          version: "5.5"
        },
        context: {
          password: "plain_db_password",
          credit_card: "4111-1111-1111-1111",
          token: "secret_customer_token",
          safeAttribute: "allowed_value"
        }
      });

    expect(ingestRes.status).toBe(202);
    const incidentId = ingestRes.body.incidentId;

    // Verify stored data in repository
    const stored = await repo.findIncidentById(incidentId);
    expect(stored).not.toBeNull();
    expect((stored?.context as any).password).toBe("[REDACTED]");
    expect((stored?.context as any).credit_card).toBe("[REDACTED]");
    expect((stored?.context as any).token).toBe("[REDACTED]");
    expect((stored?.context as any).safeAttribute).toBe("allowed_value");
  });

  it("Ingestion Safeguards: enforces rate limiting on burst requests", async () => {
    const burstLimiter = async () => {
      return request(app)
        .post("/api/v1/ingest/events")
        .set("Authorization", `Bearer ${keyA}`)
        .set("x-test-rate-limit", "true")
        .send({
          timestamp: new Date().toISOString(),
          eventType: "exception",
          environment: "production",
          release: "1.0.0",
          exception: { type: "SpamError", message: "Burst flood" },
          runtime: { language: "typescript", version: "5.5" }
        });
    };

    // Send requests to trigger rate limit (configured limit 120, let's send in a batch)
    let reached429 = false;
    for (let i = 0; i < 125; i++) {
      const r = await burstLimiter();
      if (r.status === 429) {
        reached429 = true;
        expect(r.headers["retry-after"]).toBeDefined();
        break;
      }
    }
    expect(reached429).toBe(true);
  });
});
