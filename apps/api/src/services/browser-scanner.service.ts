import { chromium, Browser, Page } from "playwright-core";
import axe from "axe-core";
import crypto from "crypto";

export interface ScanConfig {
  scanType?: "quick" | "standard" | "deep";
  maxPages?: number;
  maxDepth?: number;
  viewports?: Array<{ width: number; height: number; name: string }>;
  enableScreenshots?: boolean;
  enableAccessibility?: boolean;
  enablePerformance?: boolean;
  enableFunctional?: boolean;
  enableResponsive?: boolean;
  enableSecurity?: boolean;
  enableSeo?: boolean;
  timeoutMs?: number;
}

export interface RawFinding {
  issueFingerprint: string;
  title: string;
  description: string;
  category: "functional" | "javascript" | "network" | "accessibility" | "responsive" | "performance" | "security" | "seo";
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: "high" | "medium" | "low";
  verificationStatus: "verified" | "potential";
  pageUrl: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  reproductionSteps?: string[];
  evidenceJson?: Record<string, any>;
  suggestedFix?: string;
}

export interface ScannedPageResult {
  url: string;
  title: string;
  httpStatus: number;
  loadMetrics: {
    ttfbMs: number;
    domContentLoadedMs: number;
    loadTimeMs: number;
    resourceCount: number;
  };
  screenshotDataUrl?: string;
  error?: string;
}

export interface ScanExecutionResult {
  pages: ScannedPageResult[];
  findings: RawFinding[];
  durationMs: number;
}

export class BrowserScannerService {
  private static async launchBrowser(): Promise<Browser> {
    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--ignore-certificate-errors"
    ];

    try {
      return await chromium.launch({
        channel: "chrome",
        headless: true,
        args: launchArgs
      });
    } catch {
      // Fallback to Edge if Google Chrome channel is not found
      return await chromium.launch({
        channel: "msedge",
        headless: true,
        args: launchArgs
      });
    }
  }

  public static async executeScan(
    startUrl: string,
    options: ScanConfig = {},
    onProgress?: (progress: { discovered: number; scanned: number; currentUrl: string }) => void
  ): Promise<ScanExecutionResult> {
    const startTime = Date.now();
    const scanType = options.scanType || "quick";
    const maxPages = options.maxPages || (scanType === "deep" ? 50 : scanType === "standard" ? 15 : 5);
    const maxDepth = options.maxDepth || (scanType === "deep" ? 3 : scanType === "standard" ? 2 : 1);
    const enableScreenshots = options.enableScreenshots !== false;
    const timeoutMs = options.timeoutMs || 25000;

    const parsedStart = new URL(startUrl);
    const baseOrigin = parsedStart.origin;

    const browser = await this.launchBrowser();
    const findings: RawFinding[] = [];
    const scannedPages: ScannedPageResult[] = [];
    const visitedUrls = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];

    const viewports = options.viewports || [
      { width: 1440, height: 900, name: "desktop" },
      { width: 768, height: 1024, name: "tablet" },
      { width: 375, height: 812, name: "mobile" }
    ];

    try {
      while (queue.length > 0 && scannedPages.length < maxPages) {
        const item = queue.shift();
        if (!item) break;

        const currentUrl = item.url;
        if (visitedUrls.has(currentUrl)) continue;
        visitedUrls.add(currentUrl);

        if (onProgress) {
          onProgress({
            discovered: visitedUrls.size + queue.length,
            scanned: scannedPages.length + 1,
            currentUrl
          });
        }

        const pageFindings: RawFinding[] = [];
        const context = await browser.newContext({
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 TracePilot-Scanner/1.0",
          ignoreHTTPSErrors: true
        });
        const page = await context.newPage();

        // 1. Module A: JS & Console Errors Listener
        page.on("pageerror", (err: Error) => {
          const fingerprint = crypto.createHash("sha256").update(`js:${err.name}:${err.message}`).digest("hex").substring(0, 16);
          pageFindings.push({
            issueFingerprint: fingerprint,
            title: `Uncaught Exception: ${err.name || "JavaScript Error"}`,
            description: `A runtime error occurred during client-side script execution: ${err.message}`,
            category: "javascript",
            severity: "critical",
            confidence: "high",
            verificationStatus: "verified",
            pageUrl: currentUrl,
            expectedBehavior: "Page scripts should execute smoothly without crashing window context.",
            actualBehavior: `Script threw: ${err.message}`,
            reproductionSteps: [`Open ${currentUrl}`, "Inspect browser developer console"],
            evidenceJson: {
              stackTrace: err.stack,
              message: err.message,
              exceptionType: err.name
            },
            suggestedFix: "Wrap volatile window access in guard statements, check null/undefined properties before access, and review the stack trace."
          });
        });

        page.on("console", (msg) => {
          if (msg.type() === "error") {
            const text = msg.text();
            if (!text.includes("favicon.ico") && !text.includes("Failed to load resource: net::ERR_")) {
              const fingerprint = crypto.createHash("sha256").update(`console:${text}`).digest("hex").substring(0, 16);
              pageFindings.push({
                issueFingerprint: fingerprint,
                title: "Console Error Detected",
                description: `The browser console recorded an explicit error: ${text.substring(0, 150)}`,
                category: "javascript",
                severity: "high",
                confidence: "high",
                verificationStatus: "verified",
                pageUrl: currentUrl,
                expectedBehavior: "No error messages should be emitted to console in production.",
                actualBehavior: text,
                reproductionSteps: [`Open ${currentUrl}`, "Open Console tab in DevTools"],
                evidenceJson: { consoleMessage: text, location: msg.location() },
                suggestedFix: "Resolve the error condition logged by console.error."
              });
            }
          }
        });

        // 2. Module B & C: Network & Asset Failures Listener
        page.on("requestfailed", (req) => {
          const failure = req.failure();
          const reqUrl = req.url();
          // Filter out aborted requests
          if (failure && failure.errorText !== "net::ERR_ABORTED") {
            const isAsset = /\.(png|jpe?g|gif|svg|webp|css|js|woff2?|ttf)(\?.*)?$/i.test(reqUrl);
            const category = isAsset ? "network" : "functional";
            const fingerprint = crypto.createHash("sha256").update(`netfail:${reqUrl}:${failure.errorText}`).digest("hex").substring(0, 16);
            pageFindings.push({
              issueFingerprint: fingerprint,
              title: isAsset ? `Asset Failed to Load (${req.resourceType()})` : "Network Request Failed",
              description: `Request to ${reqUrl} failed with reason: ${failure.errorText}`,
              category: category,
              severity: isAsset ? "medium" : "high",
              confidence: "high",
              verificationStatus: "verified",
              pageUrl: currentUrl,
              expectedBehavior: "All referenced page assets and network calls should resolve successfully.",
              actualBehavior: `Failed with ${failure.errorText}`,
              reproductionSteps: [`Navigate to ${currentUrl}`, `Observe network traffic for ${reqUrl}`],
              evidenceJson: {
                resourceType: req.resourceType(),
                failedUrl: reqUrl,
                errorText: failure.errorText
              },
              suggestedFix: "Verify that the asset exists at the target URL, CORS headers allow the origin, and CDN paths are configured correctly."
            });
          }
        });

        let httpStatus = 200;
        let responseHeaders: Record<string, string> = {};

        try {
          const response = await page.goto(currentUrl, {
            waitUntil: "domcontentloaded",
            timeout: timeoutMs
          });

          if (response) {
            httpStatus = response.status();
            responseHeaders = response.headers();

            // Module B: HTTP Errors on Main Document
            if (httpStatus >= 400) {
              const fingerprint = crypto.createHash("sha256").update(`http:${httpStatus}:${currentUrl}`).digest("hex").substring(0, 16);
              pageFindings.push({
                issueFingerprint: fingerprint,
                title: `HTTP ${httpStatus} Error`,
                description: `Page returned HTTP status code ${httpStatus}`,
                category: "network",
                severity: httpStatus >= 500 ? "critical" : "high",
                confidence: "high",
                verificationStatus: "verified",
                pageUrl: currentUrl,
                expectedBehavior: "Page should return HTTP 200 OK.",
                actualBehavior: `Returned status code ${httpStatus}`,
                reproductionSteps: [`Open ${currentUrl}`, "Observe response code"],
                evidenceJson: { httpStatus, headers: responseHeaders },
                suggestedFix: "Check server routing, page existence, or reverse proxy configuration."
              });
            }
          }
        } catch (navErr: any) {
          httpStatus = 0;
          scannedPages.push({
            url: currentUrl,
            title: "Navigation Failed",
            httpStatus: 0,
            loadMetrics: { ttfbMs: 0, domContentLoadedMs: 0, loadTimeMs: 0, resourceCount: 0 },
            error: navErr.message
          });
          await context.close();
          continue;
        }

        // Wait an extra moment for hydration and background requests
        await page.waitForTimeout(1000);

        const pageTitle = await page.title().catch(() => "");

        // Collect Performance Navigation Timing (Module G)
        const timingMetrics = await page.evaluate(() => {
          const perfNav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
          if (perfNav) {
            return {
              ttfbMs: Math.round(perfNav.responseStart - perfNav.requestStart),
              domContentLoadedMs: Math.round(perfNav.domContentLoadedEventEnd - perfNav.startTime),
              loadTimeMs: Math.round(perfNav.loadEventEnd - perfNav.startTime),
              resourceCount: performance.getEntriesByType("resource").length
            };
          }
          return { ttfbMs: 0, domContentLoadedMs: 0, loadTimeMs: 0, resourceCount: 0 };
        }).catch(() => ({ ttfbMs: 0, domContentLoadedMs: 0, loadTimeMs: 0, resourceCount: 0 }));

        if (timingMetrics.loadTimeMs > 4500) {
          pageFindings.push({
            issueFingerprint: crypto.createHash("sha256").update(`perf:slowload:${currentUrl}`).digest("hex").substring(0, 16),
            title: "Slow Page Load (> 4.5s)",
            description: `The page took ${timingMetrics.loadTimeMs}ms to reach full load event.`,
            category: "performance",
            severity: "medium",
            confidence: "high",
            verificationStatus: "verified",
            pageUrl: currentUrl,
            expectedBehavior: "Web pages should load in under 2.5 seconds for good user experience.",
            actualBehavior: `Load time was ${timingMetrics.loadTimeMs}ms`,
            reproductionSteps: [`Load ${currentUrl} on a standard broadband connection`, "Measure window.load event timing"],
            evidenceJson: { metrics: timingMetrics },
            suggestedFix: "Optimize bundle sizes, defer non-critical JavaScript, enable server compression (gzip/brotli), and lazy-load below-the-fold assets."
          });
        }

        // Module H: Security Headers Check
        if (options.enableSecurity !== false && responseHeaders) {
          const missingHeaders: string[] = [];
          if (!responseHeaders["content-security-policy"]) missingHeaders.push("Content-Security-Policy");
          if (!responseHeaders["x-content-type-options"]) missingHeaders.push("X-Content-Type-Options: nosniff");
          if (!responseHeaders["x-frame-options"]) missingHeaders.push("X-Frame-Options");
          if (currentUrl.startsWith("https://") && !responseHeaders["strict-transport-security"]) {
            missingHeaders.push("Strict-Transport-Security");
          }

          if (missingHeaders.length > 0) {
            pageFindings.push({
              issueFingerprint: crypto.createHash("sha256").update(`sec:missing_headers:${missingHeaders.sort().join(",")}`).digest("hex").substring(0, 16),
              title: "Missing Recommended Security Headers",
              description: `The following standard security headers are missing from the response: ${missingHeaders.join(", ")}`,
              category: "security",
              severity: "low",
              confidence: "high",
              verificationStatus: "verified",
              pageUrl: currentUrl,
              expectedBehavior: "Web servers should send defensive HTTP headers to guard against XSS, clickjacking, and MIME sniffing.",
              actualBehavior: `Missing headers: ${missingHeaders.join(", ")}`,
              reproductionSteps: [`Make a GET request to ${currentUrl}`, "Inspect response headers"],
              evidenceJson: { missingHeaders, presentHeaders: Object.keys(responseHeaders) },
              suggestedFix: "Configure your web server or edge CDN to send standard security headers: Content-Security-Policy, X-Content-Type-Options: nosniff, and X-Frame-Options: SAMEORIGIN."
            });
          }
        }

        // Module I: SEO Basics
        if (options.enableSeo !== false) {
          const seoData = await page.evaluate(() => {
            const title = document.title || "";
            const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
            const h1Count = document.querySelectorAll("h1").length;
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
            return { title, metaDesc, h1Count, canonical };
          }).catch(() => null);

          if (seoData) {
            if (!seoData.title.trim()) {
              pageFindings.push({
                issueFingerprint: crypto.createHash("sha256").update(`seo:missing_title:${currentUrl}`).digest("hex").substring(0, 16),
                title: "Missing Document <title>",
                description: "The page has an empty or missing <title> tag, degrading search engine indexing and browser tab clarity.",
                category: "seo",
                severity: "medium",
                confidence: "high",
                verificationStatus: "verified",
                pageUrl: currentUrl,
                expectedBehavior: "Every page should have a concise, descriptive title tag (30-60 characters).",
                actualBehavior: "No document title found.",
                reproductionSteps: [`Inspect the <head> element of ${currentUrl}`],
                evidenceJson: { title: seoData.title },
                suggestedFix: "Add a meaningful <title> element inside the HTML <head> section."
              });
            }

            if (!seoData.metaDesc.trim()) {
              pageFindings.push({
                issueFingerprint: crypto.createHash("sha256").update(`seo:missing_meta_desc:${currentUrl}`).digest("hex").substring(0, 16),
                title: "Missing Meta Description",
                description: "The page does not provide a meta description for search engine snippets.",
                category: "seo",
                severity: "low",
                confidence: "high",
                verificationStatus: "verified",
                pageUrl: currentUrl,
                expectedBehavior: "A meta description tag (<meta name='description' content='...'>) should be present.",
                actualBehavior: "Meta description tag not found.",
                reproductionSteps: [`Inspect the <head> section of ${currentUrl}`],
                evidenceJson: {},
                suggestedFix: "Include a <meta name='description' content='...'> tag between 120 and 160 characters."
              });
            }

            if (seoData.h1Count === 0) {
              pageFindings.push({
                issueFingerprint: crypto.createHash("sha256").update(`seo:missing_h1:${currentUrl}`).digest("hex").substring(0, 16),
                title: "Missing Main Heading (<h1>)",
                description: "The page contains no <h1> tag, which is important for hierarchical structure and SEO ranking.",
                category: "seo",
                severity: "low",
                confidence: "high",
                verificationStatus: "verified",
                pageUrl: currentUrl,
                expectedBehavior: "Each page should feature exactly one primary <h1> heading summarizing its topic.",
                actualBehavior: "0 <h1> elements found in DOM.",
                reproductionSteps: [`Search DOM of ${currentUrl} for <h1> tags`],
                evidenceJson: { h1Count: 0 },
                suggestedFix: "Designate the main page headline with an <h1> tag."
              });
            }
          }
        }

        // Module C: Broken Image Detection (naturalWidth === 0)
        const brokenImages = await page.evaluate(() => {
          const imgs = Array.from(document.querySelectorAll("img"));
          return imgs
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => ({
              src: img.src || img.getAttribute("src") || "",
              alt: img.alt || "",
              outerHTML: img.outerHTML.substring(0, 200)
            }))
            .slice(0, 10);
        }).catch(() => []);

        for (const brokenImg of brokenImages) {
          if (brokenImg.src) {
            pageFindings.push({
              issueFingerprint: crypto.createHash("sha256").update(`broken_img:${brokenImg.src}`).digest("hex").substring(0, 16),
              title: "Broken Image Display",
              description: `Image element failed to render (naturalWidth is 0): ${brokenImg.src}`,
              category: "functional",
              severity: "medium",
              confidence: "high",
              verificationStatus: "verified",
              pageUrl: currentUrl,
              expectedBehavior: "All images should decode and display with non-zero dimensions.",
              actualBehavior: "Image naturalWidth is 0 (broken asset or invalid format).",
              reproductionSteps: [`Inspect image element with src='${brokenImg.src}' on ${currentUrl}`],
              evidenceJson: { snippet: brokenImg.outerHTML, src: brokenImg.src },
              suggestedFix: "Verify the image file path exists, returns image/* mime type, and is not 404/corrupted."
            });
          }
        }

        // Module D: Functional UI Assertions (Broken Anchor Links)
        const deadLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll("a"));
          return links
            .filter((a) => {
              const href = a.getAttribute("href");
              return href === "#" || href === "javascript:void(0)" || href === "javascript:;";
            })
            .map((a) => ({
              text: (a.textContent || "").trim().substring(0, 50),
              outerHTML: a.outerHTML.substring(0, 200)
            }))
            .slice(0, 5);
        }).catch(() => []);

        if (deadLinks.length > 0) {
          pageFindings.push({
            issueFingerprint: crypto.createHash("sha256").update(`dead_link:${currentUrl}:${deadLinks[0].text}`).digest("hex").substring(0, 16),
            title: "Dead Anchor Placeholder Links (href='#')",
            description: `Found ${deadLinks.length} clickable link(s) with placeholder href="#" or javascript:void(0), which can disorient users or reload to top of page.`,
            category: "functional",
            severity: "low",
            confidence: "high",
            verificationStatus: "verified",
            pageUrl: currentUrl,
            expectedBehavior: "Interactive controls should either be valid <button> elements or link to active target URLs.",
            actualBehavior: `Links found with empty or placeholder href: "${deadLinks.map((d) => d.text).join(", ")}"`,
            reproductionSteps: [`Locate placeholder link '${deadLinks[0].text}' on ${currentUrl}`],
            evidenceJson: { deadLinks },
            suggestedFix: "Replace anchor placeholders with <button type='button'> elements or provide the intended destination URLs."
          });
        }

        // Module E: Responsive Layout Testing across Viewports
        let screenshotDataUrl: string | undefined;

        if (options.enableResponsive !== false) {
          for (const vp of viewports) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(300);

            // Check horizontal overflow
            const overflow = await page.evaluate(() => {
              const docWidth = document.documentElement.scrollWidth;
              const winWidth = window.innerWidth;
              const hasOverflow = docWidth > winWidth + 2;
              let offendingElementSnippet = "";
              if (hasOverflow) {
                // Locate element causing overflow
                const all = Array.from(document.body.querySelectorAll("*"));
                for (const el of all) {
                  const rect = el.getBoundingClientRect();
                  if (rect.right > winWidth + 5) {
                    offendingElementSnippet = el.outerHTML.substring(0, 200);
                    break;
                  }
                }
              }
              return { hasOverflow, docWidth, winWidth, offendingElementSnippet };
            }).catch(() => ({ hasOverflow: false, docWidth: 0, winWidth: 0, offendingElementSnippet: "" }));

            if (overflow.hasOverflow) {
              pageFindings.push({
                issueFingerprint: crypto.createHash("sha256").update(`overflow:${vp.name}:${currentUrl}`).digest("hex").substring(0, 16),
                title: `Horizontal Overflow on ${vp.name.toUpperCase()} Viewport (${vp.width}px)`,
                description: `Page content exceeds viewport width on ${vp.name} (${overflow.docWidth}px wide vs ${overflow.winWidth}px viewport), causing unintended horizontal scrolling.`,
                category: "responsive",
                severity: "high",
                confidence: "high",
                verificationStatus: "verified",
                pageUrl: currentUrl,
                expectedBehavior: "Web pages must conform within the viewport width without forced horizontal scrolling.",
                actualBehavior: `Document width is ${overflow.docWidth}px on a ${overflow.winWidth}px viewport.`,
                reproductionSteps: [`Resize browser window to ${vp.width}x${vp.height}`, `Scroll horizontally on ${currentUrl}`],
                evidenceJson: { viewport: vp, overflowWidth: overflow.docWidth, snippet: overflow.offendingElementSnippet },
                suggestedFix: "Apply 'max-width: 100%' and 'box-sizing: border-box' to container elements, and check for fixed pixel widths in CSS."
              });
            }

            // Capture screenshot for desktop (or primary)
            if (vp.name === "desktop" && enableScreenshots && !screenshotDataUrl) {
              const buffer = await page.screenshot({ type: "jpeg", quality: 65, fullPage: false }).catch(() => null);
              if (buffer) {
                screenshotDataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
              }
            }
          }
        }

        // Module F: Accessibility violations via axe-core
        if (options.enableAccessibility !== false) {
          try {
            await page.setViewportSize({ width: 1280, height: 800 });
            const axeResults: any = await page.evaluate((axeSource: string) => {
              // Inject axe if not already present
              if (!(window as any).axe) {
                eval(axeSource);
              }
              return (window as any).axe.run(document, {
                runOnly: {
                  type: "tag",
                  values: ["wcag2a", "wcag2aa", "best-practice"]
                }
              });
            }, axe.source);

            if (axeResults && Array.isArray(axeResults.violations)) {
              for (const v of axeResults.violations.slice(0, 8)) {
                const node = v.nodes && v.nodes[0];
                const selector = node?.target ? node.target.join(" > ") : undefined;
                const htmlSnippet = node?.html || "";

                let severity: "critical" | "high" | "medium" | "low" = "medium";
                if (v.impact === "critical") severity = "critical";
                else if (v.impact === "serious") severity = "high";
                else if (v.impact === "moderate") severity = "medium";
                else severity = "low";

                pageFindings.push({
                  issueFingerprint: crypto.createHash("sha256").update(`a11y:${v.id}:${selector || v.description}`).digest("hex").substring(0, 16),
                  title: `Accessibility: ${v.help || v.id}`,
                  description: `${v.description} (${v.helpUrl || "WCAG 2.1"})`,
                  category: "accessibility",
                  severity,
                  confidence: "high",
                  verificationStatus: "verified",
                  pageUrl: currentUrl,
                  expectedBehavior: "Page elements must satisfy WCAG 2.1 accessibility criteria.",
                  actualBehavior: `Violation of '${v.id}': ${node?.failureSummary || v.description}`,
                  reproductionSteps: [`Inspect element '${selector || "target"}' on ${currentUrl}`],
                  evidenceJson: {
                    ruleId: v.id,
                    impact: v.impact,
                    selector,
                    htmlSnippet: htmlSnippet.substring(0, 200),
                    helpUrl: v.helpUrl
                  },
                  suggestedFix: node?.failureSummary || "Review WCAG accessibility guidelines for this element."
                });
              }
            }
          } catch {
            // axe injection or evaluation may fail on restricted pages
          }
        }

        // Extract Internal Links for Crawling Queue
        if (item.depth < maxDepth && scannedPages.length + queue.length < maxPages) {
          const links = await page.evaluate((origin) => {
            const anchors = Array.from(document.querySelectorAll("a[href]"));
            return anchors
              .map((a) => (a as HTMLAnchorElement).href)
              .filter((href) => href && href.startsWith(origin) && !href.includes("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"));
          }, baseOrigin).catch(() => []);

          for (const link of links) {
            try {
              const normalized = new URL(link).origin + new URL(link).pathname;
              if (!visitedUrls.has(normalized) && !queue.some((q) => q.url === normalized)) {
                queue.push({ url: normalized, depth: item.depth + 1 });
              }
            } catch {
              // Ignore invalid link format
            }
          }
        }

        scannedPages.push({
          url: currentUrl,
          title: pageTitle || currentUrl,
          httpStatus,
          loadMetrics: timingMetrics,
          screenshotDataUrl
        });

        findings.push(...pageFindings);
        await context.close();
      }
    } finally {
      await browser.close().catch(() => {});
    }

    return {
      pages: scannedPages,
      findings,
      durationMs: Date.now() - startTime
    };
  }
}
