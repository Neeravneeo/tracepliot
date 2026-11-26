import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./app";
import { hashApiKey, signUserToken } from "./crypto";
import { setRepository, InMemoryTracePilotRepository, getRepository } from "./db";
import { TracePilotClient } from "@tracepilot/sdk";

describe("TracePilot Ingestion API & Persistence", () => {
  let app: ReturnType<typeof createApp>;
  let memoryRepo: InMemoryTracePilotRepository;
  let testUserToken: string;
  let testUserId: string;
  const TEST_API_KEY = "tp_test_key_abc123456789";
  const TEST_PROJECT_ID = "proj_test_001";

  beforeEach(async () => {
    process.env.PAUSE_AUTH = "false";
    process.env.DISABLE_AUTH = "false";

    // Isolate repository for test execution
    memoryRepo = new InMemoryTracePilotRepository();
    setRepository(memoryRepo);

    // Seed test user and generate auth token
    const user = await memoryRepo.createUser("test@tracepilot.dev", "test_hash");
    testUserId = user.id;
    testUserToken = signUserToken(user.id);

    // Seed test project with user as owner
    await memoryRepo.createProject("Integration Test Project", testUserId, TEST_PROJECT_ID);

    // Seed API key for SDK ingestion
    await memoryRepo.createApiKey(TEST_PROJECT_ID, hashApiKey(TEST_API_KEY), "Test Key");

    app = createApp();
  });

  it("should return ok from health check", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
  });

  it("requirement 2: should reject requests with invalid API key (401)", async () => {
    const validPayload = {
      eventType: "exception",
      timestamp: new Date().toISOString(),
      environment: "test",
      release: "1.0.0",
      runtime: { language: "javascript", version: "v20.0.0" },
      exception: { type: "Error", message: "Boom" }
    };

    // Missing key
    const resNoKey = await request(app)
      .post("/api/v1/ingest/events")
      .send(validPayload);
    expect(resNoKey.status).toBe(401);
    expect(resNoKey.body.error).toBe("Unauthorized");

    // Invalid key
    const resBadKey = await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", "Bearer invalid_secret_key")
      .send(validPayload);
    expect(resBadKey.status).toBe(401);
    expect(resBadKey.body.error).toBe("Unauthorized");
  });

  it("requirement 3: should reject invalid payloads with Zod validation error (400)", async () => {
    // Missing required exception object and invalid eventType
    const malformedPayload = {
      eventType: "something_else",
      timestamp: "not-a-date",
      environment: "test"
    };

    const res = await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send(malformedPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("requirement 1 & 4: should accept valid event and persist incident in database", async () => {
    const payload = {
      eventType: "exception",
      timestamp: "2026-10-06T10:00:00.000Z",
      environment: "production",
      release: "1.2.3",
      runtime: {
        language: "javascript",
        version: "v20.14.0",
        platform: "win32"
      },
      exception: {
        type: "TypeError",
        message: "Cannot read properties of undefined (reading 'profile')",
        stack: "TypeError: Cannot read properties of undefined\n    at getUser (src/users.ts:42:18)"
      },
      tags: {
        feature: "profile"
      },
      context: {
        userId: "user-42"
      }
    };

    const res = await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send(payload);

    expect(res.status).toBe(202);
    expect(res.body.status).toBe("accepted");
    expect(res.body.incidentId).toBeDefined();

    const incidentId = res.body.incidentId;

    // Database verification: Verify all required fields stored in database
    const savedIncident = await getRepository().findIncidentById(incidentId);
    expect(savedIncident).not.toBeNull();
    expect(savedIncident!.id).toBe(incidentId);
    expect(savedIncident!.projectId).toBe(TEST_PROJECT_ID);
    expect(savedIncident!.fingerprint).toBeDefined();
    expect(savedIncident!.eventType).toBe("exception");
    expect(savedIncident!.exceptionType).toBe("TypeError");
    expect(savedIncident!.message).toBe("Cannot read properties of undefined (reading 'profile')");
    expect(savedIncident!.stackTrace).toContain("getUser");
    expect(savedIncident!.environment).toBe("production");
    expect(savedIncident!.release).toBe("1.2.3");
    expect(savedIncident!.runtime.language).toBe("javascript");
    expect(savedIncident!.context.tags.feature).toBe("profile");
    expect(savedIncident!.context.userId).toBe("user-42");
    expect(savedIncident!.status).toBe("unresolved");
    expect(savedIncident!.occurredAt).toBeInstanceOf(Date);
  });

  it("requirement 6: should list incidents for authenticated project (GET /api/v1/incidents)", async () => {
    // Ingest two incidents
    await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send({
        eventType: "exception",
        timestamp: new Date().toISOString(),
        environment: "staging",
        release: "2.0.0",
        runtime: { language: "javascript", version: "20.x" },
        exception: { type: "Error", message: "First error" }
      });

    await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send({
        eventType: "exception",
        timestamp: new Date().toISOString(),
        environment: "staging",
        release: "2.0.0",
        runtime: { language: "javascript", version: "20.x" },
        exception: { type: "ReferenceError", message: "Second error" }
      });

    const res = await request(app)
      .get("/api/v1/incidents?environment=staging")
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].exceptionType).toBeDefined();
  });

  it("requirement 7: should retrieve incident detail (GET /api/v1/incidents/:incidentId)", async () => {
    const ingestRes = await request(app)
      .post("/api/v1/ingest/events")
      .set("Authorization", `Bearer ${TEST_API_KEY}`)
      .send({
        eventType: "exception",
        timestamp: new Date().toISOString(),
        environment: "production",
        release: "1.0.0",
        runtime: { language: "javascript", version: "20.x" },
        exception: { type: "CustomError", message: "Detail test error" }
      });

    const incidentId = ingestRes.body.incidentId;

    const detailRes = await request(app)
      .get(`/api/v1/incidents/${incidentId}`)
      .set("Authorization", `Bearer ${testUserToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.id).toBe(incidentId);
    expect(detailRes.body.data.exceptionType).toBe("CustomError");
    expect(detailRes.body.data.message).toBe("Detail test error");

    // 404 for non-existent incident
    const notFoundRes = await request(app)
      .get("/api/v1/incidents/inc_nonexistent_999")
      .set("Authorization", `Bearer ${testUserToken}`);
    expect(notFoundRes.status).toBe(404);
  });

  it("requirement 5: host application remains running when SDK API is unreachable", async () => {
    const client = new TracePilotClient();
    // Point to non-existent port to simulate unavailable API
    client.init({
      apiKey: TEST_API_KEY,
      endpoint: "http://127.0.0.1:59999",
      timeoutMs: 100,
      debug: false
    });

    let appCrashed = false;
    let result = null;
    try {
      result = await client.captureException(new Error("Host application error"));
    } catch {
      appCrashed = true;
    }

    expect(appCrashed).toBe(false);
    expect(result).toBeNull();
  });

  describe("Phase C: Manual stack-trace upload & parsing", () => {
    it("should successfully upload, parse, and persist a Node.js stack trace", async () => {
      const rawText = `TypeError: Cannot read properties of undefined (reading 'name')
    at getUserProfileName (c:\\Users\\app\\demo\\index.ts:39:24)
    at triggerIntentionalBug (c:\\Users\\app\\demo\\index.ts:50:18)`;

      const res = await request(app)
        .post("/api/v1/incidents/upload")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          projectId: TEST_PROJECT_ID,
          rawText,
          environment: "production",
          release: "2.1.0"
        });

      expect(res.status).toBe(201);
      expect(res.body.incidentId).toBeDefined();
      expect(res.body.parsed.exceptionType).toBe("TypeError");
      expect(res.body.parsed.message).toBe("Cannot read properties of undefined (reading 'name')");
      expect(res.body.data.projectId).toBe(TEST_PROJECT_ID);
      expect(res.body.data.release).toBe("2.1.0");

      // Verify incident is retrievable via detail endpoint
      const detailRes = await request(app)
        .get(`/api/v1/incidents/${res.body.incidentId}`)
        .set("Authorization", `Bearer ${testUserToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.exceptionType).toBe("TypeError");
      expect(detailRes.body.data.stackTrace).toBe(rawText);
    });

    it("should successfully parse a Python traceback", async () => {
      const rawPython = `Traceback (most recent call last):
  File "server.py", line 42, in handle_request
    process_payment(order)
  File "payment.py", line 15, in process_payment
    amount = order['total']
KeyError: 'total'`;

      const res = await request(app)
        .post("/api/v1/incidents/upload")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          projectId: TEST_PROJECT_ID,
          rawText: rawPython
        });

      expect(res.status).toBe(201);
      expect(res.body.parsed.exceptionType).toBe("KeyError");
      expect(res.body.parsed.message).toBe("'total'");
      expect(res.body.parsed.language).toBe("python");
    });

    it("should reject upload without authentication (401)", async () => {
      const res = await request(app)
        .post("/api/v1/incidents/upload")
        .send({
          projectId: TEST_PROJECT_ID,
          rawText: "Error: Unauthenticated upload attempt"
        });

      expect(res.status).toBe(401);
    });

    it("should reject upload for unauthorized project (403)", async () => {
      const res = await request(app)
        .post("/api/v1/incidents/upload")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          projectId: "proj_other_user_999",
          rawText: "Error: Unauthorized project attempt"
        });

      expect(res.status).toBe(403);
    });

    it("should reject upload with invalid payload (400)", async () => {
      const res = await request(app)
        .post("/api/v1/incidents/upload")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({
          projectId: TEST_PROJECT_ID,
          rawText: "" // too short
        });

      expect(res.status).toBe(400);
    });
  });

  describe("Phase D: AI Incident Analysis (/analyze)", () => {
    it("should reject analysis without authorization (401)", async () => {
      const res = await request(app).post("/api/v1/incidents/inc_12345/analyze");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });

    it("should return 404 when analyzing non-existent incident", async () => {
      const res = await request(app)
        .post("/api/v1/incidents/inc_nonexistent_999/analyze")
        .set("Authorization", `Bearer ${testUserToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("NotFound");
    });

    it("should return 403 when analyzing incident belonging to another user project", async () => {
      // Create incident in a different project not owned by testUserId
      const otherProject = await memoryRepo.createProject("Other User Project", "other_user_id", "proj_other_999");
      const otherIncident = await memoryRepo.createIncident({
        projectId: otherProject.id,
        fingerprint: "other_fp_123",
        eventType: "exception",
        exceptionType: "TypeError",
        message: "Forbidden incident",
        stackTrace: "TypeError: Forbidden",
        environment: "production",
        release: "1.0.0",
        runtime: { language: "javascript" },
        context: {},
        occurredAt: new Date()
      });

      const res = await request(app)
        .post(`/api/v1/incidents/${otherIncident.id}/analyze`)
        .set("Authorization", `Bearer ${testUserToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Forbidden");
    });
  });

  describe("Testing Auth Bypass (PAUSE_AUTH=true)", () => {
    it("should allow querying endpoints without token when PAUSE_AUTH=true", async () => {
      process.env.PAUSE_AUTH = "true";
      const res = await request(app).get("/api/v1/projects");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);

      const incidentsRes = await request(app).get("/api/v1/incidents");
      expect(incidentsRes.status).toBe(200);
      expect(Array.isArray(incidentsRes.body.data)).toBe(true);
    });

    it("should allow SDK ingestion without API key when PAUSE_AUTH=true", async () => {
      process.env.PAUSE_AUTH = "true";
      const res = await request(app)
        .post("/api/v1/ingest/events")
        .send({
          eventType: "exception",
          timestamp: new Date().toISOString(),
          environment: "test",
          release: "1.0.0",
          runtime: { language: "javascript", version: "v20" },
          exception: { type: "Error", message: "Bypass test" }
        });

      expect(res.status).toBe(202);
      expect(res.body.incidentId).toBeDefined();
    });
  });
});


