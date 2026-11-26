import { Request, Response } from "express";
import { IngestEventInput } from "../schemas/ingest.schema";
import { generateFingerprint } from "../crypto";
import { getRepository } from "../db";
import { redactSensitiveData } from "../config";

export async function ingestEventHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as IngestEventInput;
  const project = req.project!; // Guaranteed by requireApiKey middleware

  try {
    const fingerprint = generateFingerprint(
      body.exception.type,
      body.exception.message,
      body.exception.stack
    );

    const repo = getRepository();
    const incident = await repo.createIncident({
      projectId: project.id,
      fingerprint,
      eventType: body.eventType,
      exceptionType: body.exception.type,
      message: body.exception.message,
      stackTrace: body.exception.stack,
      environment: body.environment,
      release: body.release,
      runtime: redactSensitiveData(body.runtime) as Record<string, unknown>,
      context: redactSensitiveData({
        ...(body.context || {}),
        tags: body.tags || {}
      }),
      occurredAt: new Date(body.timestamp)
    });

    res.status(202).json({
      incidentId: incident.id,
      status: "accepted"
    });
  } catch (err: unknown) {
    console.error("[Ingest] Failed to record incident:", err);
    res.status(500).json({
      error: "InternalServerError",
      message: "Failed to persist incident event."
    });
  }
}
