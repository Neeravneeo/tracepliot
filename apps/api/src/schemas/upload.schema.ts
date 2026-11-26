import { z } from "zod";

export const UploadTraceSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  rawText: z.string().min(5, "rawText must contain at least 5 characters"),
  environment: z.string().default("production"),
  release: z.string().default("1.0.0"),
  service: z.string().optional()
});

export type UploadTraceInput = z.infer<typeof UploadTraceSchema>;
