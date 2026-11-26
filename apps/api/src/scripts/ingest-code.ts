import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

import { getQdrantClient, QDRANT_COLLECTION, checkQdrantConnectivity } from "../qdrant";
import { embedText } from "../embedding";

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  "out",
]);

const EXCLUDED_FILES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.test",
  ".env.production",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

// Determine if a file is safe to ingest
function isSafeToIngest(fileName: string): boolean {
  if (EXCLUDED_FILES.has(fileName)) return false;
  if (fileName.startsWith(".env")) return false;
  if (fileName.endsWith(".pem") || fileName.endsWith(".key") || fileName.endsWith(".crt")) return false;
  // Exclude common binary/asset formats to avoid giant garbage text
  if (/\.(png|jpe?g|gif|svg|ico|mp4|webm|wav|mp3|zip|tar|gz|pdf)$/i.test(fileName)) return false;
  return true;
}

// Generate a deterministic UUID-like string for Qdrant
function generatePointId(projectId: string, sourceId: string, chunkIndex: number): string {
  const raw = `${projectId}::${sourceId}::${chunkIndex}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  // Format as 8-4-4-4-12 UUID (using a fixed version digit 4 and variant digit a)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

interface Chunk {
  content: string;
  startLine: number;
  endLine: number;
}

// Deterministic line-based chunking
function chunkCode(content: string, maxLines = 60, overlap = 15): Chunk[] {
  const lines = content.split("\n");
  if (lines.length === 0) return [];

  const chunks: Chunk[] = [];
  let currentLine = 0;

  while (currentLine < lines.length) {
    const endLine = Math.min(currentLine + maxLines, lines.length);
    const chunkLines = lines.slice(currentLine, endLine);
    
    // Only create a chunk if it has actual content
    if (chunkLines.some(l => l.trim().length > 0)) {
      chunks.push({
        content: chunkLines.join("\n"),
        startLine: currentLine + 1, // 1-indexed
        endLine,
      });
    }

    if (endLine === lines.length) break;
    currentLine += (maxLines - overlap);
  }

  return chunks;
}

async function traverseDirectory(dir: string, baseDir: string, files: string[]) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        await traverseDirectory(fullPath, baseDir, files);
      }
    } else {
      if (isSafeToIngest(entry.name)) {
        files.push(fullPath);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const projectIdArg = args.find(a => a.startsWith("--projectId="));
  const dirArg = args.find(a => a.startsWith("--dir="));

  if (!projectIdArg || !dirArg) {
    console.error("Usage: tsx src/scripts/ingest-code.ts --projectId=<uuid> --dir=<path>");
    process.exit(1);
  }

  const projectId = projectIdArg.split("=")[1];
  const sourceDir = path.resolve(dirArg.split("=")[1]);

  console.log(`[Ingest] Starting code ingestion for project: ${projectId}`);
  console.log(`[Ingest] Source directory: ${sourceDir}`);

  const qdrantStatus = await checkQdrantConnectivity();
  if (qdrantStatus.status !== "ok") {
    console.error(`[Ingest] Cannot ingest: ${qdrantStatus.message}`);
    process.exit(1);
  }

  const qdrantClient = getQdrantClient();
  if (!qdrantClient) {
    console.error("[Ingest] Qdrant client is null.");
    process.exit(1);
  }

  const files: string[] = [];
  await traverseDirectory(sourceDir, sourceDir, files);
  console.log(`[Ingest] Found ${files.length} safe files to process.`);

  let totalChunks = 0;
  let totalUpserted = 0;
  let skippedEmpty = 0;
  let failedFiles = 0;

  for (const file of files) {
    try {
      const content = await fs.promises.readFile(file, "utf8");
      if (!content.trim()) {
        skippedEmpty++;
        continue;
      }

      // We want sourceId to be a relative path so it's portable
      const sourceId = path.relative(sourceDir, file).replace(/\\/g, "/");
      const chunks = chunkCode(content, 60, 15);

      if (chunks.length === 0) {
        skippedEmpty++;
        continue;
      }

      const points = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Contextual header for the LLM
        const textToEmbed = `File: ${sourceId}\nLines: ${chunk.startLine}-${chunk.endLine}\n\n${chunk.content}`;
        
        // Use RETRIEVAL_DOCUMENT for stored knowledge
        const vector = await embedText(textToEmbed, "RETRIEVAL_DOCUMENT");
        const pointId = generatePointId(projectId, sourceId, i);

        points.push({
          id: pointId,
          vector: vector,
          payload: {
            projectId,
            evidenceType: "code",
            sourceId,
            content: chunk.content, // we store just the raw chunk in payload
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            createdAt: new Date().toISOString()
          }
        });
      }

      // Upsert into Qdrant in one batch per file
      await qdrantClient.upsert(QDRANT_COLLECTION, {
        wait: true,
        points
      });

      totalChunks += chunks.length;
      totalUpserted += points.length;
      console.log(`[Ingest] Processed ${sourceId} (${chunks.length} chunks)`);

    } catch (err: any) {
      console.error(`[Ingest] Failed to process file ${file}:`, err.message);
      failedFiles++;
    }
  }

  console.log("\n--- Ingestion Summary ---");
  console.log(`Project ID: ${projectId}`);
  console.log(`Files found: ${files.length}`);
  console.log(`Files skipped (empty): ${skippedEmpty}`);
  console.log(`Files failed: ${failedFiles}`);
  console.log(`Total chunks created: ${totalChunks}`);
  console.log(`Total vectors upserted: ${totalUpserted}`);
}

main().catch(err => {
  console.error("[Ingest] Unhandled error during ingestion:", err);
  process.exit(1);
});
