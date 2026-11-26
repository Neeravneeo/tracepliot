import { Request, Response } from "express";
import { getRepository, IngestSpanInput } from "../db";
import { isAuthPaused } from "../middleware/auth";

const SENSITIVE_KEY_REGEX = /(password|secret|token|api_key|authorization|bearer|credential|cookie)/i;

function redactAttributes(attrs?: Record<string, unknown>): Record<string, unknown> {
  if (!attrs || typeof attrs !== "object") return {};
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      redacted[key] = redactAttributes(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export async function ingestSpansHandler(req: Request, res: Response): Promise<void> {
  try {
    let projectId: string | undefined;

    const apiKey = (req as any).apiKey;
    if (apiKey) {
      projectId = apiKey.projectId;
    } else if (req.user) {
      projectId = (req.body?.projectId as string) || (req.query?.projectId as string);
      if (!projectId) {
        const repo = getRepository();
        const projects = await repo.listProjectsByOwner(req.user.id);
        if (projects.length > 0) {
          projectId = projects[0].id;
        }
      }
    } else if (isAuthPaused()) {
      projectId = (req.body?.projectId as string) || "proj_dev_testing";
    }

    if (!projectId) {
      res.status(401).json({ error: "Unauthorized", message: "API key or user authentication required to ingest spans." });
      return;
    }

    const rawSpans = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.spans)
      ? req.body.spans
      : null;

    if (!rawSpans || rawSpans.length === 0) {
      res.status(400).json({ error: "BadRequest", message: "Payload must contain a non-empty array of spans." });
      return;
    }

    if (rawSpans.length > 500) {
      res.status(400).json({ error: "BadRequest", message: "Span batch exceeds maximum size of 500." });
      return;
    }

    const validSpans: IngestSpanInput[] = [];

    for (let i = 0; i < rawSpans.length; i++) {
      const s = rawSpans[i];
      if (!s.traceId || typeof s.traceId !== "string" || s.traceId.length < 8) {
        res.status(400).json({ error: "BadRequest", message: `Invalid traceId on span index ${i}.` });
        return;
      }
      if (!s.spanId || typeof s.spanId !== "string" || s.spanId.length < 4) {
        res.status(400).json({ error: "BadRequest", message: `Invalid spanId on span index ${i}.` });
        return;
      }
      if (!s.serviceName || typeof s.serviceName !== "string") {
        res.status(400).json({ error: "BadRequest", message: `Invalid serviceName on span index ${i}.` });
        return;
      }
      if (!s.name || typeof s.name !== "string") {
        res.status(400).json({ error: "BadRequest", message: `Invalid span name on span index ${i}.` });
        return;
      }

      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ error: "BadRequest", message: `Invalid timestamps on span index ${i}.` });
        return;
      }

      const durationMs = Math.max(0, end.getTime() - start.getTime());
      const statusCode = (s.statusCode === "error" || s.statusCode === "ok") ? s.statusCode : "unset";

      validSpans.push({
        traceId: s.traceId,
        spanId: s.spanId,
        parentSpanId: s.parentSpanId || null,
        projectId,
        serviceName: s.serviceName,
        name: s.name,
        startTime: start,
        endTime: end,
        durationMs,
        statusCode,
        statusMessage: s.statusMessage || null,
        attributes: redactAttributes(s.attributes),
        events: Array.isArray(s.events)
          ? s.events.map((e: any) => ({
              name: String(e.name || "event"),
              timestamp: new Date(e.timestamp || Date.now()),
              attributes: redactAttributes(e.attributes)
            }))
          : undefined
      });
    }

    const repo = getRepository();
    const inserted = await repo.ingestSpans(validSpans);

    res.status(201).json({
      status: "accepted",
      count: inserted.length
    });
  } catch (err: unknown) {
    console.error("[Traces] Ingestion error:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to ingest spans." });
  }
}

export async function listTracesHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  try {
    const repo = getRepository();
    let projectId = req.query.projectId as string | undefined;

    if (projectId) {
      const project = await repo.findProjectByIdAndOwner(projectId, user.id);
      if (!project && !isAuthPaused()) {
        res.status(403).json({ error: "Forbidden", message: "Not authorized for this project." });
        return;
      }
    } else {
      const projects = await repo.listProjectsByOwner(user.id);
      if (projects.length === 0) {
        res.json({ data: [], total: 0 });
        return;
      }
      projectId = projects[0].id;
    }

    const service = req.query.service as string | undefined;
    const status = req.query.status as "ok" | "error" | undefined;
    const minDuration = req.query.minDuration ? Number(req.query.minDuration) : undefined;
    const limit = req.query.limit ? Math.min(100, Math.max(1, Number(req.query.limit))) : 50;

    const traces = await repo.listTraces({
      projectId,
      serviceName: service,
      status,
      minDurationMs: minDuration,
      limit
    });

    res.json({ data: traces, total: traces.length });
  } catch (err: unknown) {
    console.error("[Traces] Failed to list traces:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to list traces." });
  }
}

export async function getTraceByIdHandler(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { traceId } = req.params;

  try {
    const repo = getRepository();
    let projectId = req.query.projectId as string | undefined;

    if (!projectId) {
      const projects = await repo.listProjectsByOwner(user.id);
      if (projects.length === 0 && !isAuthPaused()) {
        res.status(404).json({ error: "NotFound", message: "Trace not found." });
        return;
      }
      for (const p of projects) {
        const spans = await repo.findTraceSpans(p.id, traceId);
        if (spans.length > 0) {
          projectId = p.id;
          break;
        }
      }
      if (!projectId && isAuthPaused()) {
        projectId = "proj_dev_testing";
      }
    }

    if (!projectId) {
      res.status(404).json({ error: "NotFound", message: "Trace not found." });
      return;
    }

    const project = await repo.findProjectByIdAndOwner(projectId, user.id);
    if (!project && !isAuthPaused()) {
      res.status(403).json({ error: "Forbidden", message: "Not authorized to access trace for this project." });
      return;
    }

    const spans = await repo.findTraceSpans(projectId, traceId);
    if (spans.length === 0) {
      res.status(404).json({ error: "NotFound", message: `Trace ${traceId} not found.` });
      return;
    }

    const rootSpan = spans.find(s => !s.parentSpanId) || spans[0];
    const serviceSet = new Set(spans.map(s => s.serviceName));
    const startTimes = spans.map(s => s.startTime.getTime());
    const endTimes = spans.map(s => s.endTime.getTime());
    const earliest = Math.min(...startTimes);
    const latest = Math.max(...endTimes);
    const durationMs = Math.max(0, latest - earliest);
    const hasError = spans.some(s => s.statusCode === "error");

    res.json({
      data: {
        traceId,
        projectId,
        rootSpanName: rootSpan.name,
        serviceName: rootSpan.serviceName,
        durationMs,
        serviceCount: serviceSet.size,
        spanCount: spans.length,
        hasError,
        startTime: new Date(earliest),
        spans
      }
    });
  } catch (err: unknown) {
    console.error("[Traces] Failed to get trace detail:", err);
    res.status(500).json({ error: "InternalServerError", message: "Failed to retrieve trace detail." });
  }
}
