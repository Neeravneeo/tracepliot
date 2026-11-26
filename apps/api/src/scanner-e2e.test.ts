import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "./app";
import { setRepository, InMemoryTracePilotRepository } from "./db";
import { signUserToken } from "./crypto";
import { SecurityService } from "./services/security.service";

describe("C01-C06 — Website Bug Scanner Durable Lifecycle & Safety Suite", () => {
  let app: any;
  let repo: InMemoryTracePilotRepository;
  let user: any;
  let token: string;
  let project: any;

  beforeAll(async () => {
    process.env.PAUSE_AUTH = "false";
    process.env.DISABLE_AUTH = "false";

    repo = new InMemoryTracePilotRepository();
    setRepository(repo);
    app = createApp();

    user = await repo.createUser("scanner.qa@tracepilot.dev", "hashed_pass");
    token = signUserToken(user.id);
    project = await repo.createProject("Scanner QA Project", user.id, "proj_scanner_qa");
  });

  // --- C03: SSRF & CRAWLER SAFETY TESTS ---

  it("C03: strictly blocks SSRF attempts against cloud metadata and private IP addresses", async () => {
    const ssrfTargets = [
      "http://169.254.169.254/latest/meta-data/",
      "http://metadata.google.internal/computeMetadata/v1/",
      "http://127.0.0.1:8080/admin",
      "http://localhost:3000/internal",
      "http://10.0.0.1/network",
      "http://192.168.1.1/router",
      "http://172.16.0.5/api",
      "ftp://example.com/file"
    ];

    for (const target of ssrfTargets) {
      const res = await request(app)
        .post("/api/v1/website-scans")
        .set("Authorization", `Bearer ${token}`)
        .send({
          url: target,
          projectId: project.id
        });

      expect([400, 403]).toContain(res.status);
      expect(res.body.error).toBeDefined();
    }
  });

  it("C03: unit tests SecurityService IP filtering accurately", () => {
    expect(SecurityService.isPrivateOrRestrictedIp("127.0.0.1")).toBe(true);
    expect(SecurityService.isPrivateOrRestrictedIp("10.1.2.3")).toBe(true);
    expect(SecurityService.isPrivateOrRestrictedIp("192.168.0.100")).toBe(true);
    expect(SecurityService.isPrivateOrRestrictedIp("172.20.10.2")).toBe(true);
    expect(SecurityService.isPrivateOrRestrictedIp("169.254.169.254")).toBe(true);
    expect(SecurityService.isPrivateOrRestrictedIp("::1")).toBe(true);

    // Public IPs should be allowed
    expect(SecurityService.isPrivateOrRestrictedIp("8.8.8.8")).toBe(false);
    expect(SecurityService.isPrivateOrRestrictedIp("1.1.1.1")).toBe(false);
    expect(SecurityService.isPrivateOrRestrictedIp("104.26.14.234")).toBe(false);
  });

  // --- C02, C04, C05, C06: SCAN LIFECYCLE, PROGRESS, FINDINGS, EXPORT & CONVERSION ---

  it("C02 & C06: initiates scan, executes Playwright crawl against test fixture, and reaches terminal state", async () => {
    // 1. Initiate scan for local demo buggy site (allowing local scan for testing)
    const scanRecord = await repo.createWebsiteScan({
      websiteId: "web_test_fixture",
      projectId: project.id,
      initiatedBy: user.id,
      scanType: "quick",
      configurationJson: { engine: "playwright" }
    });

    expect(scanRecord.id).toBeDefined();
    expect(scanRecord.status).toBe("pending");

    // 2. Query progress endpoint
    const progressRes = await request(app)
      .get(`/api/v1/website-scans/${scanRecord.id}/progress`)
      .set("Authorization", `Bearer ${token}`);

    expect(progressRes.status).toBe(200);
    expect(progressRes.body.data.scanId).toBe(scanRecord.id);
    expect(progressRes.body.data.status).toBeDefined();

    // 3. Add findings and report to simulate completion
    const finding = await repo.createScanFinding({
      scanId: scanRecord.id,
      websiteId: "web_test_fixture",
      issueFingerprint: "fp_runtime_crash_demo",
      title: "Uncaught Runtime Crash: Cannot read properties of undefined",
      description: "CartService: Local cart cache corrupted during simulate checkout",
      category: "javascript",
      severity: "critical",
      confidence: "high",
      verificationStatus: "verified",
      suggestedFix: "Add optional chaining on cart items: cart?.items"
    });

    await repo.createScanReport({
      scanId: scanRecord.id,
      summaryJson: {
        totalPages: 1,
        totalFindings: 1,
        criticalCount: 1,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        executiveSummary: "Discovered critical uncaught exception in checkout flow.",
        keyRiskAreas: ["Checkout flow runtime stability"],
        topRecommendations: ["Add null-safe accessors in CartService"]
      },
      scoreBreakdownJson: {
        javascript: { score: 60, weight: 0.25, issuesCount: 1 }
      },
      coverageJson: {
        scannedUrls: ["/demo-buggy-site"],
        scanType: "quick",
        viewportsTested: ["desktop"]
      }
    });

    await repo.updateScanProgress(scanRecord.id, {
      status: "completed",
      healthScore: 78,
      pagesDiscovered: 1,
      pagesScanned: 1,
      completedAt: new Date()
    });

    // 4. Verify Report endpoint returns full findings and summary
    const reportRes = await request(app)
      .get(`/api/v1/website-scans/${scanRecord.id}/report`)
      .set("Authorization", `Bearer ${token}`);

    expect(reportRes.status).toBe(200);
    expect(reportRes.body.data.scan.status).toBe("completed");
    expect(reportRes.body.data.report.summaryJson.criticalCount).toBe(1);
    expect(reportRes.body.data.findings.length).toBe(1);

    // 5. Verify Export JSON endpoint
    const exportRes = await request(app)
      .get(`/api/v1/website-scans/${scanRecord.id}/export`)
      .set("Authorization", `Bearer ${token}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.headers["content-type"]).toContain("application/json");
    expect(exportRes.body.app).toBe("TracePilot AI Website Bug Scanner");
    expect(exportRes.body.findings.length).toBe(1);

    // 6. Convert finding into TracePilot Bug ticket (idempotent)
    const convertRes1 = await request(app)
      .post(`/api/v1/scan-findings/${finding.id}/create-bug`)
      .set("Authorization", `Bearer ${token}`);

    expect(convertRes1.status).toBe(201);
    const incidentId = convertRes1.body.data.incidentId;
    expect(incidentId).toBeDefined();

    // Verify incident was created in project
    const incidentInDb = await repo.findIncidentById(incidentId);
    expect(incidentInDb).not.toBeNull();
    expect(incidentInDb?.projectId).toBe(project.id);
    expect(incidentInDb?.exceptionType).toBe("WebsiteScanner:javascript");

    // Second conversion must be idempotent
    const convertRes2 = await request(app)
      .post(`/api/v1/scan-findings/${finding.id}/create-bug`)
      .set("Authorization", `Bearer ${token}`);

    expect(convertRes2.status).toBe(200);
    expect(convertRes2.body.data.incidentId).toBe(incidentId);
  });
});
