import { z } from "zod";

export const RuntimeSchema = z.object({
  language: z.string().min(1, "runtime language is required"),
  version: z.string().min(1, "runtime version is required"),
  platform: z.string().optional()
});

export const ExceptionSchema = z.object({
  type: z.string().min(1, "exception type is required"),
  message: z.string().min(1, "exception message is required"),
  stack: z.string().optional()
});

export const IngestEventSchema = z.object({
  eventType: z.literal("exception", {
    errorMap: () => ({ message: "eventType must be 'exception'" })
  }),
  timestamp: z.string().datetime({ message: "timestamp must be a valid ISO 8601 string" }),
  environment: z.string().min(1, "environment is required"),
  release: z.string().min(1, "release is required"),
  runtime: RuntimeSchema,
  exception: ExceptionSchema,
  context: z.record(z.unknown()).optional(),
  tags: z.record(z.string()).optional()
});

export type IngestEventInput = z.infer<typeof IngestEventSchema>;
