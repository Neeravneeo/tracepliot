import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { createApp } from "../../apps/api/src/app";
import { setRepository, InMemoryTracePilotRepository } from "../../apps/api/src/db";
import { hashApiKey, signUserToken } from "../../apps/api/src/crypto";
import { triggerIntentionalBug } from "./index";
import { tracepilot } from "@tracepilot/sdk";

describe("TracePilot Full End-to-End Workflow", () => {
  let server: http.Server;
  let repo: InMemoryTracePilotRepository;
  let userToken: string;
  let capturedIncidentId: string;
  const PORT = 4099;
  const DEMO_API_KEY = "tp_live_e2e_key_unique_12345";
  const DEMO_PROJECT_ID = "proj_demo_e2e_123";

  beforeAll(async () => {
    // Set up test repository
    repo = new InMemoryTracePilotRepository();
    setRepository(repo);

    // Create user, project, and API key in the database
    const user = await repo.createUser("demo@tracepilot.dev", "demo_hash");
    userToken = signUserToken(user.id);

    await repo.createProject("E2E Demo Project", user.id, DEMO_PROJECT_ID);
    await repo.createApiKey(DEMO_PROJECT_ID, hashApiKey(DEMO_API_KEY), "Demo Key");

    // Boot express server on test port
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(PORT, () => resolve());
    });

    // Reconfigure SDK to point to this active server
    tracepilot.init({
      apiKey: DEMO_API_KEY,
      endpoint: `http://localhost:${PORT}`,
      release: "1.0.0",
      environment: "development",
      debug: false
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("1. SDK Capture: triggers intentional bug, sends via SDK, and persists incident", async () => {
    const result = await triggerIntentionalBug("user-2");

    expect(result.success).toBe(false); // Bug was triggered
    expect(result.hostStillAlive).toBe(true); // Host application remained operational
    expect(result.incidentId).toBeDefined();
    capturedIncidentId = result.incidentId!;

    // Verify database record exists
    const incidentInDb = await repo.findIncidentById(capturedIncidentId);
    expect(incidentInDb).not.toBeNull();
    expect(incidentInDb?.projectId).toBe(DEMO_PROJECT_ID);
    expect(incidentInDb?.exceptionType).toBe("TypeError");
    expect(incidentInDb?.message).toContain("Cannot read properties of undefined");
    expect(incidentInDb?.environment).toBe("development");
    expect(incidentInDb?.release).toBe("1.0.0");
    expect(incidentInDb?.status).toBe("unresolved");
  });

  it("2. Dashboard API: fetches incident detail with authorized user token", async () => {
    const res = await fetch(`http://localhost:${PORT}/api/v1/incidents/${capturedIncidentId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data.id).toBe(capturedIncidentId);
    expect(body.data.exceptionType).toBe("TypeError");
  });

  it("3. AI Diagnosis: runs root-cause analysis via OpenRouter and returns structured diagnosis", async () => {
    const res = await fetch(`http://localhost:${PORT}/api/v1/incidents/${capturedIncidentId}/analyze`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` }
    });

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.summary).toBeDefined();
    expect(body.data.rootCause).toBeDefined();
    expect(typeof body.data.confidence).toBe("number");
    expect(body.data.suggestedFix).toBeDefined();
    expect(body.data.uncertainty).toBeDefined();
    expect(Array.isArray(body.data.evidence)).toBe(true);
    expect(Array.isArray(body.data.relevantFiles)).toBe(true);
  }, 120000);

  it("4. Auth Control: supports paused auth for testing, and enforces 401/403 when auth is active", async () => {
    // A. With auth paused for testing: unauthenticated request succeeds with 200 OK
    process.env.PAUSE_AUTH = "true";
    process.env.DISABLE_AUTH = "true";
    const pausedRes = await fetch(`http://localhost:${PORT}/api/v1/incidents/${capturedIncidentId}`);
    expect(pausedRes.status).toBe(200);

    // B. With auth enforced: missing token returns 401, cross-project returns 403
    process.env.PAUSE_AUTH = "false";
    process.env.DISABLE_AUTH = "false";
    const unauthRes = await fetch(`http://localhost:${PORT}/api/v1/incidents/${capturedIncidentId}`);
    expect(unauthRes.status).toBe(401);

    const secondUser = await repo.createUser("attacker@othercompany.dev", "hash_sec");
    const secondUserToken = signUserToken(secondUser.id);

    const getRes = await fetch(`http://localhost:${PORT}/api/v1/incidents/${capturedIncidentId}`, {
      headers: { Authorization: `Bearer ${secondUserToken}` }
    });
    expect(getRes.status).toBe(403);

    // Restore paused auth for testing
    process.env.PAUSE_AUTH = "true";
    process.env.DISABLE_AUTH = "true";
  });
});
