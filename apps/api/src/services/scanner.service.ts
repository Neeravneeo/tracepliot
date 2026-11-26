import puppeteer from "puppeteer-core";
import fs from "fs";
import { getRepository } from "../db";
import { generateFingerprint } from "../crypto";

export interface ScanOptions {
  url: string;
  projectId?: string;
  simulateClicks?: boolean;
  timeoutMs?: number;
}

export interface DiscoveredBug {
  category: "pageerror" | "console" | "network" | "render";
  exceptionType: string;
  message: string;
  stackTrace?: string;
  url: string;
  statusCode?: number;
  timestamp: Date;
  details?: Record<string, any>;
}

export interface ScanResult {
  url: string;
  durationMs: number;
  bugsFound: DiscoveredBug[];
  incidentsCreated: any[];
  summary: {
    total: number;
    javascriptErrors: number;
    networkFailures: number;
    consoleErrors: number;
  };
}

export function findBrowserExecutable(): string {
  const possiblePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : "",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error("No compatible Chrome or Edge browser executable found on system.");
}

export async function scanWebsiteForBugs(options: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  let targetUrl = options.url.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://") && !targetUrl.startsWith("data:") && !targetUrl.startsWith("file:")) {
    targetUrl = `https://${targetUrl}`;
  }

  const timeoutMs = options.timeoutMs ?? 15000;
  const executablePath = findBrowserExecutable();
  const bugs: DiscoveredBug[] = [];
  const seenSignatures = new Set<string>();

  const addBug = (bug: DiscoveredBug) => {
    const sig = `${bug.category}::${bug.exceptionType}::${bug.message}`;
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      bugs.push(bug);
    }
  };

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--ignore-certificate-errors"
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Listen for Uncaught Page Errors (window.onerror)
    page.on("pageerror", (err: any) => {
      addBug({
        category: "pageerror",
        exceptionType: err?.name || "UncaughtBrowserException",
        message: err?.message || String(err),
        stackTrace: err?.stack,
        url: page.url() || targetUrl,
        timestamp: new Date()
      });
    });

    // 2. Listen for console.error and console.warn calls
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore noise like favicon 404 console logs if caught by response handler
        if (!text.includes("favicon.ico")) {
          addBug({
            category: "console",
            exceptionType: "ConsoleError",
            message: text,
            url: page.url() || targetUrl,
            timestamp: new Date(),
            details: {
              location: msg.location()
            }
          });
        }
      }
    });

    // 3. Listen for Network Request Failures (CORS, DNS drops, connection refused)
    page.on("requestfailed", (req) => {
      const failure = req.failure();
      const reqUrl = req.url();
      if (!reqUrl.includes("favicon.ico")) {
        addBug({
          category: "network",
          exceptionType: "NetworkRequestFailed",
          message: `Failed to load ${req.method()} ${reqUrl}: ${failure ? failure.errorText : "Unknown error"}`,
          url: reqUrl,
          timestamp: new Date(),
          details: {
            resourceType: req.resourceType(),
            method: req.method()
          }
        });
      }
    });

    // 4. Listen for HTTP Error Responses (4xx, 5xx)
    page.on("response", (res) => {
      const status = res.status();
      const resUrl = res.url();
      if (status >= 400 && !resUrl.includes("favicon.ico")) {
        addBug({
          category: "network",
          exceptionType: `HttpError_${status}`,
          message: `HTTP ${status} on ${res.request().method()} ${resUrl}`,
          url: resUrl,
          statusCode: status,
          timestamp: new Date(),
          details: {
            status,
            statusText: res.statusText(),
            headers: res.headers()
          }
        });
      }
    });

    // Navigate to page
    try {
      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs
      });
      // Wait for dynamic React/Vue scripts to settle
      await page.waitForNetworkIdle({ timeout: 4000 }).catch(() => {});
    } catch (navErr: any) {
      addBug({
        category: "pageerror",
        exceptionType: "NavigationError",
        message: navErr.message || "Failed to load URL",
        stackTrace: navErr.stack,
        url: targetUrl,
        timestamp: new Date()
      });
    }

    // 5. Optional interactive exploration: Simulate clicks on buttons
    if (options.simulateClicks) {
      try {
        // Scroll to trigger lazy elements
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight);
        });
        await new Promise((r) => setTimeout(r, 600));

        // Find clickable elements (buttons, links with href)
        const buttons = await page.$$("button, [role='button'], input[type='submit']");
        const maxClicks = Math.min(buttons.length, 6);
        for (let i = 0; i < maxClicks; i++) {
          try {
            const btn = buttons[i];
            const isVisible = await btn.isIntersectingViewport().catch(() => false);
            if (isVisible) {
              await btn.click({ delay: 50 }).catch(() => {});
              await new Promise((r) => setTimeout(r, 300));
            }
          } catch {
            // Safe to ignore individual click failures
          }
        }
      } catch (clickErr: any) {
        // Ignore interaction pass issues
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  // 6. Ingest into TracePilot incidents repository
  const repo = getRepository();
  const targetProjectId = options.projectId || "proj_dev_testing";
  const createdIncidents: any[] = [];

  for (const bug of bugs) {
    try {
      const fingerprint = generateFingerprint(
        bug.exceptionType,
        bug.message,
        bug.stackTrace || bug.url
      );

      const incident = await repo.createIncident({
        projectId: targetProjectId,
        fingerprint,
        eventType: bug.category === "network" ? "network_error" : "exception",
        exceptionType: bug.exceptionType,
        message: bug.message,
        stackTrace: bug.stackTrace || `Detected by Synthetic Scanner at ${bug.url}`,
        environment: "synthetic-scan",
        release: "live-scanner-v1",
        runtime: {
          language: "javascript",
          platform: "browser",
          browser: "HeadlessChrome"
        },
        context: {
          scannedUrl: targetUrl,
          bugUrl: bug.url,
          statusCode: bug.statusCode,
          category: bug.category,
          details: bug.details || {}
        },
        occurredAt: bug.timestamp
      });

      createdIncidents.push(incident);
    } catch (ingestErr) {
      console.error("[Scanner] Failed to record incident for bug:", ingestErr);
    }
  }

  const durationMs = Date.now() - startTime;
  const jsErrors = bugs.filter((b) => b.category === "pageerror").length;
  const netErrors = bugs.filter((b) => b.category === "network").length;
  const conErrors = bugs.filter((b) => b.category === "console").length;

  return {
    url: targetUrl,
    durationMs,
    bugsFound: bugs,
    incidentsCreated: createdIncidents,
    summary: {
      total: bugs.length,
      javascriptErrors: jsErrors,
      networkFailures: netErrors,
      consoleErrors: conErrors
    }
  };
}
