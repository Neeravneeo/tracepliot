import { RawFinding, ScannedPageResult } from "./browser-scanner.service";
import { AIAnalysisSummary } from "./ai-analyzer.service";

export interface ScoreCategoryBreakdown {
  score: number;
  weight: number;
  issuesCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

export interface HealthScoreResult {
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: {
    functional: ScoreCategoryBreakdown;
    javascript: ScoreCategoryBreakdown;
    accessibility: ScoreCategoryBreakdown;
    performance: ScoreCategoryBreakdown;
    responsive: ScoreCategoryBreakdown;
    security: ScoreCategoryBreakdown;
  };
}

export interface ComprehensiveScanReport {
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  scoreBreakdown: HealthScoreResult["categories"];
  summary: {
    totalPages: number;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    executiveSummary: string;
    keyRiskAreas: string[];
    topRecommendations: string[];
    durationMs: number;
  };
  coverage: {
    scannedUrls: string[];
    scanType: string;
    viewportsTested: string[];
  };
}

export class ReportService {
  private static calculateCategoryScore(findings: RawFinding[], categoryFilter: (f: RawFinding) => boolean): ScoreCategoryBreakdown {
    const matched = findings.filter(categoryFilter);
    const critical = matched.filter((f) => f.severity === "critical").length;
    const high = matched.filter((f) => f.severity === "high").length;
    const medium = matched.filter((f) => f.severity === "medium").length;
    const low = matched.filter((f) => f.severity === "low" || f.severity === "info").length;

    const penalty = critical * 25 + high * 12 + medium * 6 + low * 2;
    const score = Math.max(0, 100 - penalty);

    return {
      score,
      weight: 0,
      issuesCount: {
        critical,
        high,
        medium,
        low,
        total: matched.length
      }
    };
  }

  public static calculateHealthScore(findings: RawFinding[]): HealthScoreResult {
    const functional = this.calculateCategoryScore(
      findings,
      (f) => f.category === "functional" || f.category === "network"
    );
    functional.weight = 0.30;

    const javascript = this.calculateCategoryScore(
      findings,
      (f) => f.category === "javascript"
    );
    javascript.weight = 0.20;

    const accessibility = this.calculateCategoryScore(
      findings,
      (f) => f.category === "accessibility"
    );
    accessibility.weight = 0.15;

    const performance = this.calculateCategoryScore(
      findings,
      (f) => f.category === "performance"
    );
    performance.weight = 0.15;

    const responsive = this.calculateCategoryScore(
      findings,
      (f) => f.category === "responsive"
    );
    responsive.weight = 0.10;

    const security = this.calculateCategoryScore(
      findings,
      (f) => f.category === "security"
    );
    security.weight = 0.10;

    const rawTotal =
      functional.score * functional.weight +
      javascript.score * javascript.weight +
      accessibility.score * accessibility.weight +
      performance.score * performance.weight +
      responsive.score * responsive.weight +
      security.score * security.weight;

    const overallScore = Math.min(100, Math.max(0, Math.round(rawTotal)));

    let grade: "A" | "B" | "C" | "D" | "F" = "F";
    if (overallScore >= 90) grade = "A";
    else if (overallScore >= 80) grade = "B";
    else if (overallScore >= 70) grade = "C";
    else if (overallScore >= 60) grade = "D";

    return {
      overallScore,
      grade,
      categories: {
        functional,
        javascript,
        accessibility,
        performance,
        responsive,
        security
      }
    };
  }

  public static generateComprehensiveReport(
    pages: ScannedPageResult[],
    findings: RawFinding[],
    aiSummary: AIAnalysisSummary,
    scanType: string,
    durationMs: number
  ): ComprehensiveScanReport {
    const health = this.calculateHealthScore(findings);

    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const highCount = findings.filter((f) => f.severity === "high").length;
    const mediumCount = findings.filter((f) => f.severity === "medium").length;
    const lowCount = findings.filter((f) => f.severity === "low" || f.severity === "info").length;

    return {
      overallScore: health.overallScore,
      grade: health.grade,
      scoreBreakdown: health.categories,
      summary: {
        totalPages: pages.length,
        totalFindings: findings.length,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        executiveSummary: aiSummary.executiveSummary,
        keyRiskAreas: aiSummary.keyRiskAreas,
        topRecommendations: aiSummary.topRecommendations,
        durationMs
      },
      coverage: {
        scannedUrls: pages.map((p) => p.url),
        scanType,
        viewportsTested: ["desktop (1440x900)", "tablet (768x1024)", "mobile (375x812)"]
      }
    };
  }
}
