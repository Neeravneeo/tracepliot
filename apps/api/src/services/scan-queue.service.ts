import { getRepository } from "../db";
import { BrowserScannerService, ScanConfig, ScanExecutionResult } from "./browser-scanner.service";
import { Crawl4AiService } from "./crawl4ai.service";
import { AIAnalyzerService } from "./ai-analyzer.service";
import { ReportService } from "./report.service";

interface ActiveScanContext {
  scanId: string;
  cancelled: boolean;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  pagesDiscovered: number;
  pagesScanned: number;
  currentUrl?: string;
  startedAt: Date;
}

export class ScanQueueService {
  private static activeJobs: Map<string, ActiveScanContext> = new Map();

  public static getLiveProgress(scanId: string): ActiveScanContext | null {
    return this.activeJobs.get(scanId) || null;
  }

  public static cancelScan(scanId: string): boolean {
    const job = this.activeJobs.get(scanId);
    if (job && job.status === "running") {
      job.cancelled = true;
      job.status = "cancelled";
      const repo = getRepository();
      repo.updateScanProgress(scanId, {
        status: "cancelled",
        completedAt: new Date()
      }).catch(() => {});
      return true;
    }
    return false;
  }

  public static async enqueueScan(
    scanId: string,
    targetUrl: string,
    config: ScanConfig = {}
  ): Promise<void> {
    const repo = getRepository();

    const jobContext: ActiveScanContext = {
      scanId,
      cancelled: false,
      status: "running",
      pagesDiscovered: 1,
      pagesScanned: 0,
      currentUrl: targetUrl,
      startedAt: new Date()
    };
    this.activeJobs.set(scanId, jobContext);

    await repo.updateScanProgress(scanId, {
      status: "running",
      startedAt: new Date(),
      pagesDiscovered: 1,
      pagesScanned: 0
    });

    // Run asynchronously in background worker pool
    setImmediate(async () => {
      try {
        const progressCallback = (progress: { discovered: number; scanned: number; currentUrl: string }) => {
          jobContext.pagesDiscovered = progress.discovered;
          jobContext.pagesScanned = progress.scanned;
          jobContext.currentUrl = progress.currentUrl;

          // Periodically persist progress
          repo.updateScanProgress(scanId, {
            pagesDiscovered: progress.discovered,
            pagesScanned: progress.scanned
          }).catch(() => {});
        };

        const isLocalUrl = targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1") || targetUrl.includes("::1");
        const useCrawl4Ai = !isLocalUrl && Crawl4AiService.isAvailable() && ((config as any).engine !== "playwright");

        let scanResult: ScanExecutionResult;

        if (useCrawl4Ai) {
          console.log(`[ScanQueueService] Using Crawl4AI Cloud Engine for ${targetUrl}`);
          try {
            scanResult = await Crawl4AiService.executeScan(targetUrl, config, progressCallback);
            // If Crawl4AI failed to scrape any pages or returned 0 valid pages, fall back to local Playwright
            if (!scanResult || scanResult.pages.length === 0 || scanResult.pages.every((p) => !!p.error)) {
              console.warn(`[ScanQueueService] Crawl4AI returned 0 valid pages, falling back to local Playwright engine...`);
              scanResult = await BrowserScannerService.executeScan(targetUrl, config, progressCallback);
            }
          } catch (crawlErr: any) {
            console.warn(`[ScanQueueService] Crawl4AI error, falling back to Playwright: ${crawlErr.message}`);
            scanResult = await BrowserScannerService.executeScan(targetUrl, config, progressCallback);
          }
        } else {
          console.log(`[ScanQueueService] Using Local Playwright Engine for ${targetUrl}`);
          scanResult = await BrowserScannerService.executeScan(targetUrl, config, progressCallback);
        }

        if (jobContext.cancelled) {
          jobContext.status = "cancelled";
          return;
        }

        // 1. Persist Scanned Pages
        const pageIdMap: Record<string, string> = {};
        for (const p of scanResult.pages) {
          const pageRecord = await repo.createScannedPage({
            scanId,
            normalizedUrl: p.url,
            httpStatus: p.httpStatus,
            pageTitle: p.title,
            loadMetricsJson: p.loadMetrics,
            screenshotRef: p.screenshotDataUrl,
            scanStatus: p.error ? "failed" : "completed",
            errorMessage: p.error
          });
          pageIdMap[p.url] = pageRecord.id;
        }

        // 2. Persist Findings & Enrich Critical/High Issues with AI
        const scan = await repo.findScanById(scanId);
        const websiteId = scan?.websiteId || "unknown";
        let enrichedCount = 0;

        for (const finding of scanResult.findings) {
          let aiAnalysis: any = null;
          let suggestedFix = finding.suggestedFix;

          if ((finding.severity === "critical" || finding.severity === "high") && enrichedCount < 3) {
            try {
              enrichedCount++;
              const enrichment = await AIAnalyzerService.enrichFindingWithAi(finding);
              if (enrichment.suggestedFix) suggestedFix = enrichment.suggestedFix;
              if (enrichment.rootCause) aiAnalysis = { rootCause: enrichment.rootCause };
            } catch {
              // Ignore failure in individual enrichment
            }
          }

          await repo.createScanFinding({
            scanId,
            websiteId,
            pageId: pageIdMap[finding.pageUrl] || undefined,
            issueFingerprint: finding.issueFingerprint,
            title: finding.title,
            description: finding.description,
            category: finding.category,
            severity: finding.severity,
            confidence: finding.confidence,
            verificationStatus: finding.verificationStatus,
            expectedBehavior: finding.expectedBehavior,
            actualBehavior: finding.actualBehavior,
            reproductionSteps: finding.reproductionSteps,
            evidenceJson: finding.evidenceJson,
            suggestedFix,
            aiAnalysisJson: aiAnalysis
          });
        }

        // 3. AI Analysis & Health Scoring
        const aiSummary = await AIAnalyzerService.analyzeScan(scanResult.pages, scanResult.findings);
        const comprehensiveReport = ReportService.generateComprehensiveReport(
          scanResult.pages,
          scanResult.findings,
          aiSummary,
          config.scanType || "quick",
          scanResult.durationMs
        );

        // 4. Persist Scan Report
        await repo.createScanReport({
          scanId,
          summaryJson: comprehensiveReport.summary,
          scoreBreakdownJson: comprehensiveReport.scoreBreakdown,
          coverageJson: comprehensiveReport.coverage
        });

        // 5. Update Scan as Completed
        await repo.updateScanProgress(scanId, {
          status: "completed",
          healthScore: comprehensiveReport.overallScore,
          pagesDiscovered: scanResult.pages.length,
          pagesScanned: scanResult.pages.length,
          completedAt: new Date(),
          coverageJson: comprehensiveReport.coverage
        });

        jobContext.status = "completed";
      } catch (err: any) {
        console.error(`[ScanQueueService] Error processing scan ${scanId}:`, err);
        jobContext.status = "failed";
        await repo.updateScanProgress(scanId, {
          status: "failed",
          errorSummary: err.message || "An unhandled exception occurred during scan execution.",
          completedAt: new Date()
        }).catch(() => {});
      } finally {
        setTimeout(() => {
          this.activeJobs.delete(scanId);
        }, 30000);
      }
    });
  }
}
