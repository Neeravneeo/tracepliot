// ponytail: simple regex-based stack frame parser and tenant-scoped evidence retrieval
import { getRepository, CodeEvidenceRecord, IncidentRecord } from "../db";
import { redactSensitiveData } from "../config";

export interface StackFrame {
  functionName: string;
  filePath: string;
  lineNumber: number;
  columnNumber?: number;
}

export function parseStackFrames(stackTrace?: string | null): StackFrame[] {
  if (!stackTrace) return [];
  const frames: StackFrame[] = [];
  const lines = stackTrace.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "at functionName (path:line:col)" or "at path:line:col"
    const matchWithFn = trimmed.match(/^at\s+(?:async\s+)?([^\s(]+)\s+\((.+):(\d+):(\d+)\)$/);
    if (matchWithFn) {
      frames.push({
        functionName: matchWithFn[1],
        filePath: matchWithFn[2].replace(/\\/g, "/"),
        lineNumber: parseInt(matchWithFn[3], 10),
        columnNumber: parseInt(matchWithFn[4], 10)
      });
      continue;
    }

    const matchNoFn = trimmed.match(/^at\s+(?:async\s+)?(.+):(\d+):(\d+)$/);
    if (matchNoFn) {
      frames.push({
        functionName: "<anonymous>",
        filePath: matchNoFn[1].replace(/\\/g, "/"),
        lineNumber: parseInt(matchNoFn[2], 10),
        columnNumber: parseInt(matchNoFn[3], 10)
      });
    }
  }

  return frames;
}

export interface RetrievalCandidate extends CodeEvidenceRecord {
  stackFrameMatch?: {
    matched: boolean;
    functionName?: string;
    targetLine?: number;
    distance: number;
  };
  symbolMatch?: boolean;
}

export class EvidenceRetrievalService {
  async retrieveCandidates(options: {
    projectId: string;
    incident: IncidentRecord;
    commitSha?: string;
    limit?: number;
  }): Promise<RetrievalCandidate[]> {
    const repo = getRepository();
    const { projectId, incident, commitSha, limit = 10 } = options;
    const allEvidence = await repo.listCodeEvidence(projectId);

    // Filter by commit revision if specified, or use all tenant evidence
    const revisionEvidence = commitSha
      ? allEvidence.filter(e => e.commitSha === commitSha)
      : allEvidence;

    const frames = parseStackFrames(incident.stackTrace);
    const candidates: RetrievalCandidate[] = [];

    for (const chunk of revisionEvidence) {
      // Check stack frame match
      let frameMatch: RetrievalCandidate["stackFrameMatch"] = undefined;
      for (const frame of frames) {
        if (chunk.filePath.endsWith(frame.filePath) || frame.filePath.endsWith(chunk.filePath)) {
          const inRange = chunk.startLine <= frame.lineNumber && frame.lineNumber <= chunk.endLine;
          const distance = inRange ? 0 : Math.min(
            Math.abs(chunk.startLine - frame.lineNumber),
            Math.abs(chunk.endLine - frame.lineNumber)
          );
          frameMatch = {
            matched: true,
            functionName: frame.functionName,
            targetLine: frame.lineNumber,
            distance
          };
          break;
        }
      }

      // Check symbol / error token overlap
      const errTokens = incident.message.toLowerCase().split(/\W+/).filter(t => t.length > 3);
      const chunkLower = chunk.content.toLowerCase();
      const symbolMatch = errTokens.some(t => chunkLower.includes(t));

      // Sanitize/redact sensitive patterns in returned content
      const sanitizedContent = typeof chunk.content === "string"
        ? chunk.content.replace(/(password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']+["']/gi, "$1: \"[REDACTED]\"")
        : chunk.content;

      candidates.push({
        ...chunk,
        content: sanitizedContent,
        stackFrameMatch: frameMatch,
        symbolMatch
      });
    }

    // Sort by frame match proximity first, then limit
    candidates.sort((a, b) => {
      const aDist = a.stackFrameMatch?.distance ?? 9999;
      const bDist = b.stackFrameMatch?.distance ?? 9999;
      return aDist - bDist;
    });

    return candidates.slice(0, limit);
  }
}

export const evidenceRetrievalService = new EvidenceRetrievalService();
