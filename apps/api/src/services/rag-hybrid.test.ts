import { describe, it, expect, beforeEach } from "vitest";
import {
  OpenRouterEmbeddingProvider,
  OfflineMockEmbeddingProvider,
  getEmbeddingProvider,
  embedText,
  EMBEDDING_DIMENSION
} from "../embedding";
import {
  ragRetrievalService,
  ScoredCandidate
} from "./rag-retrieval.service";
import { CodeEvidenceRecord, IncidentRecord } from "../db";
import { RankedEvidence } from "./evidence-ranking.service";
import { analysisService } from "./analysis.service";

describe("Part 2 v2.2 RAG Nodes: P2-RAG01 - P2-RAG08", () => {
  const PROJECT_A = "proj_rag_tenant_a";
  const PROJECT_B = "proj_rag_tenant_b";

  const sampleChunks: CodeEvidenceRecord[] = [
    {
      id: "ev_chunk_1",
      projectId: PROJECT_A,
      repo: "tracepilot/sample",
      commitSha: "sha_rag_v1",
      filePath: "src/payment.ts",
      startLine: 1,
      endLine: 25,
      content: "export function validatePaymentRequest(req: any) {\n  if (!req || req.amount <= 0) {\n    throw new Error('Invalid payment amount');\n  }\n}",
      contentHash: "hash1",
      chunkIndex: 0,
      embeddingModel: "nvidia/nemotron-3.5-embed-8b:free",
      createdAt: new Date()
    },
    {
      id: "ev_chunk_2",
      projectId: PROJECT_A,
      repo: "tracepilot/sample",
      commitSha: "sha_rag_v1",
      filePath: "src/auth.ts",
      startLine: 1,
      endLine: 30,
      content: "export function verifyToken(token: string) {\n  if (!token) throw new Error('Missing token');\n}",
      contentHash: "hash2",
      chunkIndex: 0,
      embeddingModel: "nvidia/nemotron-3.5-embed-8b:free",
      createdAt: new Date()
    },
    {
      id: "ev_chunk_3",
      projectId: PROJECT_A,
      repo: "tracepilot/sample",
      commitSha: "sha_rag_v1",
      filePath: "src/server.ts",
      startLine: 1,
      endLine: 40,
      content: "import { validatePaymentRequest } from './payment';\napp.post('/pay', (req, res) => validatePaymentRequest(req.body));",
      contentHash: "hash3",
      chunkIndex: 0,
      embeddingModel: "nvidia/nemotron-3.5-embed-8b:free",
      createdAt: new Date()
    }
  ];

  const currentIncident: IncidentRecord = {
    id: "inc_cur_100",
    projectId: PROJECT_A,
    fingerprint: "fp_payment_err",
    eventType: "exception",
    exceptionType: "Error",
    message: "Invalid payment amount in validatePaymentRequest",
    stackTrace: "Error: Invalid payment amount\n    at validatePaymentRequest (src/payment.ts:10:5)",
    environment: "production",
    release: "1.0.0",
    runtime: {},
    occurredAt: new Date("2026-11-24T12:00:00Z"),
    status: "unresolved",
    createdAt: new Date("2026-11-24T12:00:00Z")
  };

  describe("P2-RAG01: Independent Document and Query Embeddings", () => {
    it("should produce valid 1024-dimensional normalized vectors via OfflineMockEmbeddingProvider", async () => {
      const mockProvider = new OfflineMockEmbeddingProvider("nvidia/nemotron-3.5-embed-8b:free", 1024);
      expect(mockProvider.dimensions).toBe(1024);

      const docVec = await mockProvider.embedText("function test() {}", { taskType: "document" });
      expect(docVec.length).toBe(1024);
      expect(docVec.every(v => Number.isFinite(v))).toBe(true);

      const queryVec = await mockProvider.embedText("function test() {}", { taskType: "query" });
      expect(queryVec.length).toBe(1024);
      expect(queryVec.every(v => Number.isFinite(v))).toBe(true);

      // Document and Query mode produce distinct embeddings
      expect(docVec).not.toEqual(queryVec);
    });

    it("should reject chat model ID configured as embedding model in OpenRouter provider", () => {
      expect(() => {
        new OpenRouterEmbeddingProvider({
          model: "nvidia/nemotron-3-ultra-550b-a55b:free"
        });
      }).toThrow("Chat model 'nvidia/nemotron-3-ultra-550b-a55b:free' cannot be routed to the embeddings endpoint.");
    });

    it("should validate and enforce positive integer dimensions", () => {
      expect(() => {
        new OpenRouterEmbeddingProvider({
          model: "nvidia/nemotron-3.5-embed-8b:free",
          dimensions: -5
        });
      }).toThrow("Invalid embedding dimensions '-5'. Must be a positive integer.");
    });
  });

  describe("P2-RAG02: Lexical and Exact-Match Retrieval", () => {
    it("should retrieve lexical candidates using BM25 token matching with ranking", () => {
      const lexicalMatches = ragRetrievalService.lexicalSearch(
        sampleChunks,
        "validatePaymentRequest amount payment error"
      );

      expect(lexicalMatches.length).toBeGreaterThanOrEqual(1);
      const topMatch = lexicalMatches[0];
      expect(topMatch.filePath).toBe("src/payment.ts");
      expect(topMatch.retrievalMethod).toBe("lexical");
      expect(topMatch.channelScore).toBeGreaterThan(0);
      expect(topMatch.channelRank).toBe(1);
    });

    it("should extract exact match candidates from stack frames", () => {
      const frames = [
        { functionName: "validatePaymentRequest", filePath: "src/payment.ts", lineNumber: 10 }
      ];

      const exactMatches = ragRetrievalService.exactMatch(sampleChunks, frames);
      expect(exactMatches.length).toBe(1);
      expect(exactMatches[0].id).toBe("ev_chunk_1");
      expect(exactMatches[0].retrievalMethod).toBe("exact");
    });
  });

  describe("P2-RAG03: Hybrid Candidate Fusion (RRF)", () => {
    it("should fuse dense, lexical, and exact candidates with deterministic tie-breaking and rank tracking", () => {
      const denseCandidates: ScoredCandidate[] = [
        { ...sampleChunks[0], retrievalMethod: "dense", channelScore: 0.95, channelRank: 1 },
        { ...sampleChunks[2], retrievalMethod: "dense", channelScore: 0.80, channelRank: 2 }
      ];

      const lexicalCandidates: ScoredCandidate[] = [
        { ...sampleChunks[0], retrievalMethod: "lexical", channelScore: 12.5, channelRank: 1 },
        { ...sampleChunks[1], retrievalMethod: "lexical", channelScore: 4.2, channelRank: 2 }
      ];

      const exactCandidates: ScoredCandidate[] = [
        { ...sampleChunks[0], retrievalMethod: "exact", channelScore: 1.0, channelRank: 1 }
      ];

      const fused = ragRetrievalService.fuseCandidates({
        denseCandidates,
        lexicalCandidates,
        exactCandidates,
        kRRF: 60,
        finalTopK: 5
      });

      expect(fused.length).toBe(3);
      // Chunk 1 appeared in all 3 channels -> must rank #1
      expect(fused[0].id).toBe("ev_chunk_1");
      expect(fused[0].rrfScore).toBeGreaterThan(fused[1].rrfScore);
      expect(fused[0].channelRanks.exact).toBe(1);
      expect(fused[0].channelRanks.dense).toBe(1);
      expect(fused[0].channelRanks.lexical).toBe(1);
    });
  });

  describe("P2-RAG04: Historical Incident Indexing and Retrieval", () => {
    it("should retrieve historical incidents without temporal leakage and exclude current incident", () => {
      const pastResolved: IncidentRecord = {
        id: "inc_past_1",
        projectId: PROJECT_A,
        fingerprint: "fp_old",
        eventType: "exception",
        exceptionType: "Error",
        message: "Old payment failure",
        environment: "production",
        release: "0.9.0",
        runtime: {},
        occurredAt: new Date("2026-11-20T10:00:00Z"), // Prior to current incident
        status: "resolved",
        createdAt: new Date("2026-11-20T10:00:00Z")
      };

      const futureIncident: IncidentRecord = {
        id: "inc_future_1",
        projectId: PROJECT_A,
        fingerprint: "fp_future",
        eventType: "exception",
        exceptionType: "Error",
        message: "Future incident",
        environment: "production",
        release: "1.1.0",
        runtime: {},
        occurredAt: new Date("2026-11-25T10:00:00Z"), // AFTER current incident -> temporal leakage risk!
        status: "resolved",
        createdAt: new Date("2026-11-25T10:00:00Z")
      };

      const crossTenantIncident: IncidentRecord = {
        id: "inc_tenant_b_1",
        projectId: PROJECT_B,
        fingerprint: "fp_other",
        eventType: "exception",
        exceptionType: "Error",
        message: "Tenant B incident",
        environment: "production",
        release: "1.0.0",
        runtime: {},
        occurredAt: new Date("2026-11-20T10:00:00Z"),
        status: "resolved",
        createdAt: new Date("2026-11-20T10:00:00Z")
      };

      const pool = [pastResolved, futureIncident, crossTenantIncident, currentIncident];
      const eligible = ragRetrievalService.filterHistoricalIncidents(pool, currentIncident);

      expect(eligible.length).toBe(1);
      expect(eligible[0].id).toBe("inc_past_1");
      expect(eligible.some(i => i.id === currentIncident.id)).toBe(false); // Excludes current
      expect(eligible.some(i => i.id === "inc_future_1")).toBe(false); // Excludes future
      expect(eligible.some(i => i.projectId === PROJECT_B)).toBe(false); // Excludes other tenant
    });
  });

  describe("P2-RAG05: Configurable Top-K Evidence Selection", () => {
    it("should select exact Top-K without synthetic padding", () => {
      const rankedItems: RankedEvidence[] = sampleChunks.map((chunk, idx) => ({
        id: chunk.id,
        projectId: chunk.projectId,
        repo: chunk.repo,
        commitSha: chunk.commitSha,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        score: 0.9 - idx * 0.2,
        coverage: 0.8,
        lowCoverageGate: false,
        signals: { line: 1.0, temporal: 0.8, diff: 0.5, deploy: 1.0, history: null },
        reasons: ["Stack frame match"],
        rankingVersion: "1.0.0"
      }));

      // Top 2
      const top2 = ragRetrievalService.selectTopK(rankedItems, 2);
      expect(top2.length).toBe(2);
      expect(top2[0].id).toBe("ev_chunk_1");

      // Default K = 5 (returns 3 because only 3 exist, no synthetic padding!)
      const topDefault = ragRetrievalService.selectTopK(rankedItems);
      expect(topDefault.length).toBe(3);

      // Rejects invalid K
      expect(() => ragRetrievalService.selectTopK(rankedItems, -1)).toThrow("Invalid Top-K limit");
    });
  });

  describe("P2-RAG06: Context Assembler and Token Budgeting", () => {
    it("should assemble an immutable context manifest and enforce token budget", () => {
      const rankedItems: RankedEvidence[] = sampleChunks.map((chunk, idx) => ({
        id: chunk.id,
        projectId: chunk.projectId,
        repo: chunk.repo,
        commitSha: chunk.commitSha,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        content: chunk.content,
        score: 0.85,
        coverage: 0.8,
        lowCoverageGate: false,
        signals: { line: 1.0, temporal: 0.8, diff: null, deploy: null, history: null },
        reasons: ["Test reason"],
        rankingVersion: "1.0.0"
      }));

      const manifest = ragRetrievalService.assembleContextManifest({
        incident: currentIncident,
        rankedEvidence: rankedItems,
        maxContextTokens: 4000
      });

      expect(manifest.manifestId).toMatch(/^manifest_\d+_[0-9a-f]+$/);
      expect(manifest.incidentId).toBe(currentIncident.id);
      expect(manifest.allowedEvidenceIds).toEqual(["ev_chunk_1", "ev_chunk_2", "ev_chunk_3"]);
      expect(manifest.tokenBudget.maxTokens).toBe(4000);
      expect(manifest.tokenBudget.estimatedTokens).toBeGreaterThan(0);
      expect(manifest.tokenBudget.truncated).toBe(false);
    });

    it("should cleanly truncate when token budget is constrained", () => {
      const giantContent = "A".repeat(5000); // ~1250 tokens
      const giantRanked: RankedEvidence[] = [
        {
          id: "ev_giant_1",
          projectId: PROJECT_A,
          repo: "repo",
          commitSha: "sha",
          filePath: "giant.ts",
          startLine: 1,
          endLine: 200,
          content: giantContent,
          score: 0.9,
          coverage: 0.9,
          lowCoverageGate: false,
          signals: { line: 1.0, temporal: null, diff: null, deploy: null, history: null },
          reasons: [],
          rankingVersion: "1.0.0"
        }
      ];

      const manifest = ragRetrievalService.assembleContextManifest({
        incident: currentIncident,
        rankedEvidence: giantRanked,
        maxContextTokens: 300 // Constrained token budget
      });

      expect(manifest.tokenBudget.truncated).toBe(true);
      expect(manifest.sentEvidence[0].contentExcerpt).toContain("[TRUNCATED DUE TO CONTEXT BUDGET]");
    });
  });

  describe("P2-RAG07: Versioned Prompt Construction", () => {
    it("should build diagnosis prompt embedding manifest ID and strict citation rules", () => {
      const manifest = ragRetrievalService.assembleContextManifest({
        incident: currentIncident,
        rankedEvidence: [
          {
            id: "ev_chunk_1",
            projectId: PROJECT_A,
            repo: "tracepilot/sample",
            commitSha: "sha_rag_v1",
            filePath: "src/payment.ts",
            startLine: 1,
            endLine: 25,
            content: sampleChunks[0].content,
            score: 0.95,
            coverage: 0.8,
            lowCoverageGate: false,
            signals: { line: 1.0, temporal: null, diff: null, deploy: null, history: null },
            reasons: ["Line match"],
            rankingVersion: "1.0.0"
          }
        ]
      });

      const prompt = ragRetrievalService.buildDiagnosisPrompt(currentIncident, manifest);
      expect(prompt).toContain("TracePilot Versioned Incident Diagnosis Prompt (v2.2.0)");
      expect(prompt).toContain(manifest.manifestId);
      expect(prompt).toContain("ev_chunk_1");
      expect(prompt).toContain("CRITICAL CITATION RULES");
      expect(prompt).toContain("You may ONLY reference evidence IDs explicitly defined above");
    });
  });

  describe("P2-RAG08: Citation Validation and Patch Validation Semantics", () => {
    it("should default patchValidationStatus to 'Not run' and reject hallucinated citations", async () => {
      const rankedItems: RankedEvidence[] = [
        {
          id: "ev_chunk_1",
          projectId: PROJECT_A,
          repo: "tracepilot/sample",
          commitSha: "sha_rag_v1",
          filePath: "src/payment.ts",
          startLine: 1,
          endLine: 25,
          content: sampleChunks[0].content,
          score: 0.95,
          coverage: 0.8,
          lowCoverageGate: false,
          signals: { line: 1.0, temporal: null, diff: null, deploy: null, history: null },
          reasons: ["Line match"],
          rankingVersion: "1.0.0"
        }
      ];

      // Custom provider attempting to cite an unlisted ID
      const fakeProvider = {
        name: "test-eval-provider",
        async analyze() {
          return JSON.stringify({
            summary: "Valid summary for diagnosis",
            rootCause: "Null dereference in payment request",
            supportLevel: "strong",
            alternativeHypotheses: [],
            suggestedFix: "Check if req is defined",
            validationSteps: ["Run payment unit test"],
            patchDiff: "--- a/src/payment.ts\n+++ b/src/payment.ts",
            uncertainty: "Minimal uncertainty",
            evidenceRefs: ["hallucinated_fake_id_999"]
          });
        }
      };

      analysisService.setProvider(fakeProvider);
      const analysisJob = await analysisService.runAnalysis({
        incident: currentIncident,
        rankedEvidence: rankedItems
      });

      expect(analysisJob.status).toBe("completed");
      expect(analysisJob.patchValidationStatus).toBe("Not run");
      expect(analysisJob.isRootCauseConfirmed).toBe(false);
      // The hallucinated ID was rejected and replaced with the valid authorized ID
      expect(analysisJob.evidenceRefs).toEqual(["ev_chunk_1"]);
      expect(analysisJob.manifestId).toBeDefined();
    });
  });
});
