// ponytail: deterministic versioned evidence ranking engine with strict null semantics and low-coverage gate
import { RetrievalCandidate } from "./evidence-retrieval.service";
import { GitMetadataResult } from "./git-metadata.service";
import { IncidentRecord } from "../db";

export interface RankingSignals {
  line: number | null;     // 0.30 stack proximity [0, 1]
  temporal: number | null; // 0.25 time freshness [0, 1]
  diff: number | null;     // 0.20 diff changed [0, 1]
  deploy: number | null;   // 0.15 service/env alignment [0, 1]
  history: number | null;  // 0.10 past incident recurrence [0, 1]
}

export interface RankedEvidence {
  id: string;
  projectId: string;
  repo: string;
  commitSha: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number | null;
  coverage: number;
  lowCoverageGate: boolean;
  signals: RankingSignals;
  reasons: string[];
  rankingVersion: string;
}

export const RANKING_WEIGHTS = {
  line: 0.30,
  temporal: 0.25,
  diff: 0.20,
  deploy: 0.15,
  history: 0.10
};

export const RANKING_VERSION = "1.0.0";
export const MIN_COVERAGE_THRESHOLD = 0.40;

export class EvidenceRankingService {
  rankCandidates(options: {
    candidates: RetrievalCandidate[];
    incident: IncidentRecord;
    gitMetadata?: GitMetadataResult;
    incidentHistoryFilePaths?: string[];
  }): RankedEvidence[] {
    const { candidates, incident, gitMetadata, incidentHistoryFilePaths = [] } = options;
    const historySet = new Set(incidentHistoryFilePaths);

    const ranked: RankedEvidence[] = candidates.map((cand) => {
      const reasons: string[] = [];
      const signals: RankingSignals = {
        line: null,
        temporal: null,
        diff: null,
        deploy: null,
        history: null
      };

      // 1. Line Signal (weight: 0.30)
      if (incident.stackTrace) {
        if (cand.stackFrameMatch?.matched) {
          if (cand.stackFrameMatch.distance === 0) {
            signals.line = 1.0;
            reasons.push(`Contains active stack frame line ${cand.stackFrameMatch.targetLine}`);
          } else if (cand.stackFrameMatch.distance <= 50) {
            signals.line = Math.max(0, 1.0 - (cand.stackFrameMatch.distance / 50));
            reasons.push(`Within ${cand.stackFrameMatch.distance} lines of stack frame`);
          } else {
            signals.line = 0.0;
          }
        } else {
          signals.line = 0.0; // Observed negative: stack trace present but file not in frame
        }
      }

      // 2. Temporal Signal (weight: 0.25)
      if (gitMetadata?.commitTime) {
        const diffMs = Math.abs(incident.occurredAt.getTime() - gitMetadata.commitTime.getTime());
        const hours = diffMs / (1000 * 60 * 60);
        if (hours <= 2) signals.temporal = 1.0;
        else if (hours <= 24) signals.temporal = 0.8;
        else if (hours <= 168) signals.temporal = 0.5;
        else signals.temporal = 0.2;
        reasons.push(`Committed ${Math.round(hours)}h before incident`);
      }

      // 3. Diff Signal (weight: 0.20)
      if (gitMetadata?.signalsAvailable.gitDiff) {
        const inDiff = gitMetadata.changedFiles.some(f => cand.filePath.endsWith(f) || f.endsWith(cand.filePath));
        signals.diff = inDiff ? 1.0 : 0.0;
        if (inDiff) reasons.push("File was modified in recent commit");
      }

      // 4. Deploy Signal (weight: 0.15)
      if (gitMetadata?.environment && incident.environment) {
        signals.deploy = gitMetadata.environment.toLowerCase() === incident.environment.toLowerCase() ? 1.0 : 0.0;
        if (signals.deploy === 1.0) reasons.push(`Environment matched: ${incident.environment}`);
      }

      // 5. History Signal (weight: 0.10)
      if (historySet.size > 0) {
        signals.history = historySet.has(cand.filePath) ? 1.0 : 0.0;
        if (signals.history === 1.0) reasons.push("File has prior incident history");
      }

      // Compute weighted aggregation over available signals only
      let availableWeight = 0;
      let weightedSum = 0;

      for (const [key, weight] of Object.entries(RANKING_WEIGHTS)) {
        const sigValue = signals[key as keyof RankingSignals];
        if (sigValue !== null && sigValue !== undefined) {
          availableWeight += weight;
          weightedSum += weight * sigValue;
        }
      }

      const totalApplicableWeight = 1.0;
      const coverage = Number((availableWeight / totalApplicableWeight).toFixed(2));
      const lowCoverageGate = coverage < MIN_COVERAGE_THRESHOLD;

      const score = availableWeight > 0
        ? Number((weightedSum / availableWeight).toFixed(3))
        : null;

      if (lowCoverageGate && score !== null) {
        reasons.push(`Low signal coverage (${coverage}) - confidence gated`);
      }

      return {
        id: cand.id,
        projectId: cand.projectId,
        repo: cand.repo,
        commitSha: cand.commitSha,
        filePath: cand.filePath,
        startLine: cand.startLine,
        endLine: cand.endLine,
        content: cand.content,
        score,
        coverage,
        lowCoverageGate,
        signals,
        reasons,
        rankingVersion: RANKING_VERSION
      };
    });

    // Sort by score desc (null scores last), with stable tie-break on ID
    ranked.sort((a, b) => {
      if (a.score === null && b.score === null) return a.id.localeCompare(b.id);
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      if (b.score !== a.score) return b.score - a.score;
      return a.id.localeCompare(b.id); // stable tie-breaker
    });

    return ranked;
  }
}

export const evidenceRankingService = new EvidenceRankingService();
