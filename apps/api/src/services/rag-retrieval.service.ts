// ponytail: hybrid RAG retrieval engine with BM25 lexical search, exact matching, RRF fusion, historical memory, and immutable context manifests
import crypto from "crypto";
import { CodeEvidenceRecord, IncidentRecord } from "../db";
import { StackFrame } from "./evidence-retrieval.service";
import { RankedEvidence } from "./evidence-ranking.service";

export interface ScoredCandidate extends CodeEvidenceRecord {
  retrievalMethod: "dense" | "lexical" | "exact";
  channelScore: number;
  channelRank: number;
}

export interface FusedCandidate extends CodeEvidenceRecord {
  rrfScore: number;
  channelRanks: {
    dense?: number;
    lexical?: number;
    exact?: number;
  };
  channelScores: {
    dense?: number;
    lexical?: number;
    exact?: number;
  };
  retrievalMethod: string;
}

export interface HistoricalIncidentSummary {
  incidentId: string;
  fingerprint: string;
  exceptionType: string;
  message: string;
  status: string;
  resolvedAt?: Date;
  linkedEvidenceIds: string[];
  resolvedFilePaths: string[];
}

export interface EvidenceManifestItem {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  contentExcerpt: string;
  score: number | null;
  revision: string;
}

export interface EvidenceManifest {
  manifestId: string;
  incidentId: string;
  projectId: string;
  modelVersion: string;
  promptVersion: string;
  allowedEvidenceIds: string[];
  sentEvidence: EvidenceManifestItem[];
  tokenBudget: {
    maxTokens: number;
    estimatedTokens: number;
    truncated: boolean;
  };
  createdAt: Date;
}

export class RagRetrievalService {
  /**
   * P2-RAG02: Lexical BM25-style retrieval over code chunks
   */
  lexicalSearch(chunks: CodeEvidenceRecord[], queryText: string, topK = 30): ScoredCandidate[] {
    const rawTerms = queryText.toLowerCase().split(/\W+/).filter(t => t.length > 2);
    if (rawTerms.length === 0 || chunks.length === 0) return [];

    // Document frequency (DF)
    const df: Record<string, number> = {};
    for (const term of rawTerms) {
      let count = 0;
      for (const chunk of chunks) {
        if (chunk.content.toLowerCase().includes(term)) {
          count++;
        }
      }
      df[term] = count;
    }

    const N = chunks.length;
    const scored: { chunk: CodeEvidenceRecord; score: number }[] = [];

    for (const chunk of chunks) {
      const contentLower = chunk.content.toLowerCase();
      let score = 0;

      for (const term of rawTerms) {
        // Count term occurrences (TF)
        const regex = new RegExp(`\\b${term}\\b`, "g");
        const matches = contentLower.match(regex);
        const tf = matches ? matches.length : 0;

        if (tf > 0) {
          const docFreq = df[term] || 1;
          const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
          score += (tf * (1.2 + 1)) / (tf + 1.2 * (1 - 0.75 + 0.75 * (chunk.content.length / 500))) * idf;
        }
      }

      if (score > 0) {
        scored.push({ chunk, score: Number(score.toFixed(4)) });
      }
    }

    // Sort by lexical score descending, tie break by ID
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chunk.id.localeCompare(b.chunk.id);
    });

    return scored.slice(0, topK).map((item, idx) => ({
      ...item.chunk,
      retrievalMethod: "lexical",
      channelScore: item.score,
      channelRank: idx + 1
    }));
  }

  /**
   * P2-RAG02: Exact symbol, stack frame, and path matching
   */
  exactMatch(chunks: CodeEvidenceRecord[], frames: StackFrame[]): ScoredCandidate[] {
    const matches: ScoredCandidate[] = [];

    for (const chunk of chunks) {
      for (const frame of frames) {
        const pathMatches = chunk.filePath.endsWith(frame.filePath) || frame.filePath.endsWith(chunk.filePath);
        if (pathMatches) {
          const inRange = chunk.startLine <= frame.lineNumber && frame.lineNumber <= chunk.endLine;
          if (inRange) {
            matches.push({
              ...chunk,
              retrievalMethod: "exact",
              channelScore: 1.0,
              channelRank: 1
            });
            break;
          }
        }
      }
    }

    return matches;
  }

  /**
   * P2-RAG03: Hybrid Candidate Fusion using Reciprocal Rank Fusion (RRF)
   */
  fuseCandidates(options: {
    denseCandidates: ScoredCandidate[];
    lexicalCandidates: ScoredCandidate[];
    exactCandidates: ScoredCandidate[];
    kRRF?: number;
    finalTopK?: number;
  }): FusedCandidate[] {
    const { denseCandidates, lexicalCandidates, exactCandidates, kRRF = 60, finalTopK = 5 } = options;
    const candidateMap = new Map<string, FusedCandidate>();

    const applyChannel = (
      candidates: ScoredCandidate[],
      channel: "dense" | "lexical" | "exact"
    ) => {
      candidates.forEach((cand, idx) => {
        const rank = idx + 1;
        const rrfContribution = 1.0 / (kRRF + rank);

        if (!candidateMap.has(cand.id)) {
          candidateMap.set(cand.id, {
            ...cand,
            rrfScore: 0,
            channelRanks: {},
            channelScores: {},
            retrievalMethod: "hybrid"
          });
        }

        const existing = candidateMap.get(cand.id)!;
        existing.rrfScore += rrfContribution;
        existing.channelRanks[channel] = rank;
        existing.channelScores[channel] = cand.channelScore;
      });
    };

    // Apply channels with bounded candidate pools
    applyChannel(exactCandidates, "exact");
    applyChannel(denseCandidates.slice(0, 30), "dense");
    applyChannel(lexicalCandidates.slice(0, 30), "lexical");

    const fused = Array.from(candidateMap.values());

    // Deterministic tie-breaking: RRF score descending, then stable ID ascending
    fused.sort((a, b) => {
      if (Math.abs(b.rrfScore - a.rrfScore) > 1e-6) {
        return b.rrfScore - a.rrfScore;
      }
      return a.id.localeCompare(b.id);
    });

    return fused.slice(0, finalTopK);
  }

  /**
   * P2-RAG04: Historical Incident Retrieval without temporal leakage
   */
  filterHistoricalIncidents(
    incidents: IncidentRecord[],
    currentIncident: IncidentRecord
  ): IncidentRecord[] {
    return incidents.filter(inc => {
      // Must belong to the same project
      if (inc.projectId !== currentIncident.projectId) return false;
      // Exclude current incident
      if (inc.id === currentIncident.id) return false;
      // Prevent temporal leakage: must have occurred prior to or at current incident time
      if (inc.occurredAt.getTime() > currentIncident.occurredAt.getTime()) return false;
      // Must be resolved
      return inc.status === "resolved";
    });
  }

  /**
   * P2-RAG05: Configurable Top-K Evidence Selection
   */
  selectTopK(ranked: RankedEvidence[], requestedK?: number): RankedEvidence[] {
    const k = requestedK !== undefined ? requestedK : 5;
    if (k <= 0 || !Number.isInteger(k)) {
      throw new Error(`[RAG] Invalid Top-K limit: ${requestedK}. Must be a positive integer.`);
    }

    // Stable tie-break and slice
    const sorted = [...ranked].sort((a, b) => {
      const scoreA = a.score ?? -1;
      const scoreB = b.score ?? -1;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return a.id.localeCompare(b.id);
    });

    // Return up to K items without synthetic padding
    return sorted.slice(0, k);
  }

  /**
   * P2-RAG06: Context Assembler with Token Budgeting and Immutable Manifest
   */
  assembleContextManifest(options: {
    incident: IncidentRecord;
    rankedEvidence: RankedEvidence[];
    maxContextTokens?: number;
    modelVersion?: string;
  }): EvidenceManifest {
    const {
      incident,
      rankedEvidence,
      maxContextTokens = 4000,
      modelVersion = "nvidia/nemotron-3-ultra-550b-a55b:free"
    } = options;

    const manifestId = `manifest_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const sentEvidence: EvidenceManifestItem[] = [];
    const allowedEvidenceIds: string[] = [];

    let estimatedTokens = 150; // base system prompt overhead
    let truncated = false;

    for (const ev of rankedEvidence) {
      // 1 token approx 4 characters
      const chunkTokens = Math.ceil(ev.content.length / 4);

      if (estimatedTokens + chunkTokens > maxContextTokens) {
        // Exceeded budget: truncate remaining or excerpt cleanly
        const remainingTokens = Math.max(0, maxContextTokens - estimatedTokens);
        if (remainingTokens > 50) {
          const charLimit = remainingTokens * 4;
          const excerpt = ev.content.slice(0, charLimit) + "\n/* ... [TRUNCATED DUE TO CONTEXT BUDGET] ... */";
          sentEvidence.push({
            id: ev.id,
            filePath: ev.filePath,
            startLine: ev.startLine,
            endLine: ev.endLine,
            contentExcerpt: excerpt,
            score: ev.score,
            revision: ev.commitSha
          });
          allowedEvidenceIds.push(ev.id);
          estimatedTokens += remainingTokens;
        }
        truncated = true;
        break;
      }

      sentEvidence.push({
        id: ev.id,
        filePath: ev.filePath,
        startLine: ev.startLine,
        endLine: ev.endLine,
        contentExcerpt: ev.content,
        score: ev.score,
        revision: ev.commitSha
      });
      allowedEvidenceIds.push(ev.id);
      estimatedTokens += chunkTokens;
    }

    return {
      manifestId,
      incidentId: incident.id,
      projectId: incident.projectId,
      modelVersion,
      promptVersion: "2.2.0",
      allowedEvidenceIds,
      sentEvidence,
      tokenBudget: {
        maxTokens: maxContextTokens,
        estimatedTokens,
        truncated
      },
      createdAt: new Date()
    };
  }

  /**
   * P2-RAG07: Versioned Prompt Construction
   */
  buildDiagnosisPrompt(incident: IncidentRecord, manifest: EvidenceManifest): string {
    const evidenceSnippets = manifest.sentEvidence.map(item => `
<code_evidence id="${item.id}" file="${item.filePath}" lines="${item.startLine}-${item.endLine}" revision="${item.revision}">
${item.contentExcerpt}
</code_evidence>`).join("\n");

    return `
TracePilot Versioned Incident Diagnosis Prompt (v2.2.0)
You are an expert site reliability engineer and automated root-cause diagnostician.

<incident_runtime_data>
Exception: ${incident.exceptionType}
Message: ${incident.message}
Environment: ${incident.environment}
Release: ${incident.release}
Stack Trace:
${incident.stackTrace || "No stack trace provided"}
</incident_runtime_data>

<verified_evidence_pool manifest_id="${manifest.manifestId}">
${evidenceSnippets}
</verified_evidence_pool>

CRITICAL CITATION RULES:
1. You may ONLY reference evidence IDs explicitly defined above in the verified_evidence_pool.
2. If no evidence directly explains the exception, set supportLevel to "insufficient" and explain uncertainty.
3. Distinguish established runtime facts from root cause hypotheses.
4. Output MUST be a valid JSON object matching the requested schema.

Return ONLY this JSON format:
{
  "summary": "Concise summary of the failure",
  "rootCause": "Specific technical root cause explanation",
  "supportLevel": "strong" | "moderate" | "weak" | "insufficient",
  "alternativeHypotheses": ["hypothesis 1", "hypothesis 2"],
  "suggestedFix": "Detailed code fix recommendation",
  "validationSteps": ["Step 1 to verify", "Step 2 to verify"],
  "patchDiff": "Unified git diff or null",
  "uncertainty": "Known gaps or assumptions",
  "evidenceRefs": ["id_from_verified_evidence_pool"]
}
`.trim();
  }
}

export const ragRetrievalService = new RagRetrievalService();
