import { RawFinding, ScannedPageResult } from "./browser-scanner.service";
import { LlmService } from "./llm.service";

export interface AIAnalysisSummary {
  executiveSummary: string;
  criticalIssuesCount: number;
  topRecommendations: string[];
  keyRiskAreas: string[];
}

export class AIAnalyzerService {
  /**
   * Generates intelligent root-cause analysis, executive summaries, and remediation recommendations.
   * Invokes the real LLM API cascade (Google GenAI / OpenRouter / HuggingFace) with deterministic fallback.
   */
  public static async analyzeScan(
    pages: ScannedPageResult[],
    findings: RawFinding[]
  ): Promise<AIAnalysisSummary> {
    const criticalFindings = findings.filter((f) => f.severity === "critical");
    const highFindings = findings.filter((f) => f.severity === "high");
    const mediumFindings = findings.filter((f) => f.severity === "medium");

    // Attempt real LLM analysis first
    try {
      console.log(`[AIAnalyzerService] Invoking LLM to analyze scan with ${pages.length} pages and ${findings.length} findings...`);

      const findingsSample = findings.slice(0, 10).map((f) => ({
        title: f.title,
        category: f.category,
        severity: f.severity,
        actualBehavior: f.actualBehavior,
        evidence: f.evidenceJson
      }));

      const prompt = `Analyze the following automated website scan results:
Target Pages Tested: ${pages.length} (${pages.map((p) => p.url).slice(0, 5).join(", ")})
Total Defects Discovered: ${findings.length}
- Critical Severity: ${criticalFindings.length}
- High Severity: ${highFindings.length}
- Medium Severity: ${mediumFindings.length}

Sample Findings:
${JSON.stringify(findingsSample, null, 2)}

Provide an executive summary, identify the top key risk areas, and give prioritized recommendations.`;

      const schema = `{
  "executiveSummary": "Concise 2-3 sentence overview of website stability, defects found, and user impact",
  "keyRiskAreas": ["Risk area 1 with brief reason", "Risk area 2 with brief reason"],
  "topRecommendations": ["Actionable technical fix 1", "Actionable technical fix 2", "Actionable technical fix 3"]
}`;

      const aiResponse = await LlmService.generateJson<{
        executiveSummary: string;
        keyRiskAreas: string[];
        topRecommendations: string[];
      }>(prompt, schema);

      if (aiResponse && aiResponse.executiveSummary && Array.isArray(aiResponse.topRecommendations)) {
        console.log("[AIAnalyzerService] Real LLM analysis generated successfully!");
        return {
          executiveSummary: aiResponse.executiveSummary,
          criticalIssuesCount: criticalFindings.length,
          topRecommendations: aiResponse.topRecommendations,
          keyRiskAreas: aiResponse.keyRiskAreas || []
        };
      }
    } catch (llmErr: any) {
      console.warn("[AIAnalyzerService] LLM API call encountered an error, using deterministic analyzer:", llmErr.message);
    }

    // Deterministic fallback if LLM is unavailable
    const categoryCounts: Record<string, number> = {};
    for (const f of findings) {
      categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1;
    }

    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([cat]) => cat);

    const keyRiskAreas = sortedCategories.slice(0, 3).map((cat) => {
      switch (cat) {
        case "javascript":
          return "Client-side Script Stability (Uncaught runtime errors)";
        case "functional":
          return "Interactive UI Integrity (Broken links or missing elements)";
        case "network":
          return "Network Connectivity & Assets (Failed requests or HTTP errors)";
        case "responsive":
          return "Mobile & Viewport Responsiveness (Horizontal layout overflows)";
        case "accessibility":
          return "WCAG Compliance (Color contrast, labels, or screen-reader usability)";
        case "performance":
          return "Page Load Latency (Excessive rendering or transfer times)";
        case "security":
          return "Security Posture (Missing defensive HTTP response headers)";
        case "seo":
          return "Search Discoverability (Metadata, headings, or indexing directives)";
        default:
          return `${cat.toUpperCase()} Issues`;
      }
    });

    const recommendations: string[] = [];
    if (criticalFindings.length > 0) {
      recommendations.push(
        `Immediate priority: Address ${criticalFindings.length} critical issue(s) causing runtime crashes or HTTP failures.`
      );
    }
    if (categoryCounts["responsive"]) {
      recommendations.push(
        "Audit mobile stylesheets to eliminate horizontal layout overflows and prevent unintended horizontal scrolling."
      );
    }
    if (categoryCounts["accessibility"]) {
      recommendations.push(
        "Remediate WCAG accessibility findings to ensure digital inclusion and screen reader compatibility."
      );
    }
    if (categoryCounts["security"]) {
      recommendations.push(
        "Add missing defensive headers (Content-Security-Policy, X-Frame-Options, X-Content-Type-Options) in web server config."
      );
    }
    if (recommendations.length === 0) {
      recommendations.push("Maintain automated regression tests and monitor web vitals continuously.");
    }

    let executiveSummary: string;
    if (criticalFindings.length === 0 && highFindings.length === 0) {
      executiveSummary = `The automated audit inspected ${pages.length} page(s) and discovered no critical or high severity defects. The site demonstrates strong foundational stability with ${findings.length} minor optimization opportunity(ies) identified.`;
    } else {
      executiveSummary = `The audit evaluated ${pages.length} page(s) and identified ${findings.length} total issue(s), including ${criticalFindings.length} critical and ${highFindings.length} high severity bug(s). Key problem areas involve ${sortedCategories.slice(0, 2).join(" and ")}. Addressing the critical items is strongly recommended before production releases.`;
    }

    return {
      executiveSummary,
      criticalIssuesCount: criticalFindings.length,
      topRecommendations: recommendations.slice(0, 4),
      keyRiskAreas
    };
  }

  /**
   * Enriches an individual finding with AI-generated root cause analysis and code fix recommendation.
   */
  public static async enrichFindingWithAi(finding: RawFinding): Promise<{ suggestedFix?: string; rootCause?: string }> {
    try {
      const prompt = `Analyze this verified web defect:
Category: ${finding.category}
Title: ${finding.title}
Description: ${finding.description}
Actual Behavior: ${finding.actualBehavior || "Not specified"}
Evidence: ${JSON.stringify(finding.evidenceJson || {})}

Provide a concise technical root cause explanation and code-level remediation.`;

      const schema = `{
  "rootCause": "Direct technical explanation of why this bug occurred",
  "suggestedFix": "Concrete code or configuration fix to resolve the problem"
}`;

      const res = await LlmService.generateJson<{ rootCause: string; suggestedFix: string }>(prompt, schema);
      if (res?.suggestedFix) {
        return res;
      }
    } catch {
      // Graceful fallback
    }
    return { suggestedFix: finding.suggestedFix };
  }
}
