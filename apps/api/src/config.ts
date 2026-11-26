import { z } from "zod";

/**
 * Zod schema for environment configuration and runtime safety.
 * Validates ports, environments, and enforces strict production safety rules.
 */
export const ConfigSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  TRACEPILOT_API_KEY: z.string().optional(),
  TRACEPILOT_ENDPOINT: z.string().url().default("http://localhost:4000"),
  PAUSE_AUTH: z.string().optional(),
  DISABLE_AUTH: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_FALLBACK_MODEL: z.string().default("gemini-3.5-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  QDRANT_URL: z.string().optional(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION: z.string().default("tracepilot_evidence"),
  CRAWL4AI_API_KEY: z.string().optional(),
  CRAWL4AI_BASE_URL: z.string().default("https://api.crawl4ai.com"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("nvidia/nemotron-3-ultra-550b-a55b:free"),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  EMBEDDING_PROVIDER: z.enum(["openrouter", "gemini", "mock"]).default("openrouter"),
  OPENROUTER_EMBEDDING_MODEL: z.string().default("nvidia/nemotron-3.5-embed-8b:free"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1024),
  QDRANT_DISTANCE: z.enum(["Cosine", "Euclid", "Dot"]).default("Cosine"),
  QDRANT_CODE_COLLECTION: z.string().default("tracepilot_code_v2"),
  QDRANT_INCIDENT_COLLECTION: z.string().default("tracepilot_incidents_v2"),
  RAG_SEMANTIC_TOP_K: z.coerce.number().default(30),
  RAG_LEXICAL_TOP_K: z.coerce.number().default(30),
  RAG_FINAL_TOP_K: z.coerce.number().default(5),
  RAG_HYBRID_SEARCH_ENABLED: z.coerce.boolean().default(true),
  RAG_HISTORICAL_RETRIEVAL_ENABLED: z.coerce.boolean().default(true),
  HUGGINGFACE_API_KEY: z.string().optional(),
  HF_TOKEN: z.string().optional(),
  HF_MODEL: z.string().optional(),
  HF_ROUTER_URL: z.string().optional()
}).superRefine((data, ctx) => {
  // Prevent auth bypass in production
  if (data.NODE_ENV === "production") {
    if (data.PAUSE_AUTH === "true" || data.DISABLE_AUTH === "true") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Authentication bypass (PAUSE_AUTH or DISABLE_AUTH) is strictly prohibited in production.",
        path: ["PAUSE_AUTH"]
      });
    }
  }

  // Reject chat model in embedding configuration
  if (data.OPENROUTER_EMBEDDING_MODEL === data.OPENROUTER_MODEL || data.OPENROUTER_EMBEDDING_MODEL.includes("ultra-550b")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Chat model ID cannot be used as an embedding model.",
      path: ["OPENROUTER_EMBEDDING_MODEL"]
    });
  }

  // Validate approved dimensions
  if (data.EMBEDDING_DIMENSIONS <= 0 || !Number.isInteger(data.EMBEDDING_DIMENSIONS)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "EMBEDDING_DIMENSIONS must be a positive integer.",
      path: ["EMBEDDING_DIMENSIONS"]
    });
  }
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Validate configuration. Throws detailed error if configuration fails schema.
 */
export function validateConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`[Config] Invalid environment configuration: ${errorDetails}`);
  }
  return result.data;
}

// Redaction utility: scrubs sensitive keys like password, token, secret, authorization, credit_card
const SENSITIVE_KEY_REGEX = /^(password|token|secret|authorization|credit_?card|api_?key|key_?hash)$/i;

export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) return data.map((item) => redactSensitiveData(item));
  
  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}
