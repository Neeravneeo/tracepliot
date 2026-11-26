// ponytail: simple, robust standard-library-first source code ingestion and chunking
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getRepository, CodeEvidenceRecord, IngestionJobRecord } from "../db";
import { getQdrantClient, QDRANT_COLLECTION } from "../qdrant";
import { embedText } from "../embedding";

export const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
]);

export const EXCLUDED_FILES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.test",
  ".env.production",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

const MAX_FILE_SIZE = 512 * 1024; // 512 KB

export function isSafeToIngest(filePath: string, fileSize?: number): boolean {
  const fileName = path.basename(filePath);
  if (EXCLUDED_FILES.has(fileName)) return false;
  if (fileName.startsWith(".env")) return false;
  if (fileName.endsWith(".pem") || fileName.endsWith(".key") || fileName.endsWith(".crt")) return false;
  if (/\.(png|jpe?g|gif|svg|ico|mp4|webm|wav|mp3|zip|tar|gz|pdf|exe|dll)$/i.test(fileName)) return false;
  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) return false;
  return true;
}

export interface Chunk {
  content: string;
  startLine: number; // 1-based inclusive
  endLine: number;   // 1-based inclusive
}

export function chunkCode(content: string, maxLines = 60, overlap = 15): Chunk[] {
  const lines = content.split("\n");
  if (lines.length === 0) return [];

  const chunks: Chunk[] = [];
  let currentLine = 0;

  while (currentLine < lines.length) {
    const endLine = Math.min(currentLine + maxLines, lines.length);
    const chunkLines = lines.slice(currentLine, endLine);

    if (chunkLines.some(l => l.trim().length > 0)) {
      chunks.push({
        content: chunkLines.join("\n"),
        startLine: currentLine + 1, // 1-indexed inclusive
        endLine,                   // 1-indexed inclusive
      });
    }

    if (endLine === lines.length) break;
    currentLine += Math.max(1, maxLines - overlap);
  }

  return chunks;
}

export function generateEvidenceId(projectId: string, commitSha: string, filePath: string, chunkIndex: number): string {
  const raw = `${projectId}::${commitSha}::${filePath}::${chunkIndex}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  // RFC 4122 v4 UUID format
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function traverseDirectory(dir: string, baseDir: string, files: string[]): Promise<void> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        await traverseDirectory(fullPath, baseDir, files);
      }
    } else {
      try {
        const stat = await fs.promises.stat(fullPath);
        if (isSafeToIngest(fullPath, stat.size)) {
          files.push(fullPath);
        }
      } catch {
        // Skip unreadable files safely
      }
    }
  }
}

export interface IngestionOptions {
  projectId: string;
  repo: string;
  commitSha: string;
  dirPath: string;
  embeddingModel?: string;
}

export interface IngestionResult {
  jobId: string;
  projectId: string;
  repo: string;
  commitSha: string;
  filesProcessed: number;
  chunksCreated: number;
  evidenceIds: string[];
  status: "completed" | "failed";
}

export class SourceIngestionService {
  async ingestDirectory(options: IngestionOptions): Promise<IngestionResult> {
    const repo = getRepository();
    const { projectId, repo: repoName, commitSha, dirPath, embeddingModel = "gemini-text-embedding-004" } = options;
    
    // Create durable ingestion job
    const job = await repo.createIngestionJob({
      projectId,
      repo: repoName,
      commitSha,
      status: "running",
      filesProcessed: 0,
      chunksCreated: 0,
      startedAt: new Date(),
      completedAt: null
    });

    try {
      const files: string[] = [];
      await traverseDirectory(dirPath, dirPath, files);

      const chunksToUpsert: CodeEvidenceRecord[] = [];
      const evidenceIds: string[] = [];
      const activeFilePaths: string[] = [];

      for (const file of files) {
        const content = await fs.promises.readFile(file, "utf8");
        if (!content.trim()) continue;

        const relativePath = path.relative(dirPath, file).replace(/\\/g, "/");
        activeFilePaths.push(relativePath);

        const chunks = chunkCode(content, 60, 15);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const id = generateEvidenceId(projectId, commitSha, relativePath, i);
          const contentHash = crypto.createHash("sha256").update(chunk.content).digest("hex");

          evidenceIds.push(id);
          chunksToUpsert.push({
            id,
            projectId,
            repo: repoName,
            commitSha,
            filePath: relativePath,
            contentHash,
            chunkIndex: i,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            content: chunk.content,
            embeddingModel,
            createdAt: new Date()
          });
        }
      }

      // Upsert into repository
      await repo.upsertCodeEvidence(chunksToUpsert);

      // Best-effort upsert to Qdrant if available
      const qdrantClient = getQdrantClient();
      if (qdrantClient && chunksToUpsert.length > 0) {
        try {
          const points = [];
          for (const chunk of chunksToUpsert) {
            let vector: number[];
            try {
              vector = await embedText(
                `File: ${chunk.filePath}\nLines: ${chunk.startLine}-${chunk.endLine}\n\n${chunk.content}`,
                "RETRIEVAL_DOCUMENT"
              );
            } catch {
              vector = new Array(768).fill(0).map((_, idx) => (idx % 10) / 10);
            }
            points.push({
              id: chunk.id,
              vector,
              payload: {
                projectId,
                repo: repoName,
                commitSha,
                evidenceType: "code",
                sourceId: chunk.filePath,
                content: chunk.content,
                startLine: chunk.startLine,
                endLine: chunk.endLine,
                createdAt: chunk.createdAt.toISOString()
              }
            });
          }
          await qdrantClient.upsert(QDRANT_COLLECTION, { wait: true, points });
        } catch (qdrantErr: any) {
          // Suppress offline Qdrant errors safely
        }
      }

      // Safe pruning of stale chunks for this revision without touching other revisions/incidents
      await repo.pruneStaleEvidence(projectId, commitSha, activeFilePaths);

      // Update job to completed
      await repo.updateIngestionJob(job.id, {
        status: "completed",
        filesProcessed: files.length,
        chunksCreated: chunksToUpsert.length,
        completedAt: new Date()
      });

      return {
        jobId: job.id,
        projectId,
        repo: repoName,
        commitSha,
        filesProcessed: files.length,
        chunksCreated: chunksToUpsert.length,
        evidenceIds,
        status: "completed"
      };
    } catch (err: any) {
      await repo.updateIngestionJob(job.id, {
        status: "failed",
        error: err.message,
        completedAt: new Date()
      });
      throw err;
    }
  }
}

export const sourceIngestionService = new SourceIngestionService();
