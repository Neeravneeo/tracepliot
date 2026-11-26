import { describe, it, expect } from "vitest";
import { validateConfig, redactSensitiveData } from "./config";
import fs from "fs";
import path from "path";

describe("A03 — Configuration & Secret Containment", () => {
  it("should validate default configuration safely", () => {
    const config = validateConfig({
      NODE_ENV: "development",
      PORT: "4000"
    });
    expect(config.PORT).toBe(4000);
    expect(config.NODE_ENV).toBe("development");
  });

  it("should strictly reject auth bypass (PAUSE_AUTH=true) in production", () => {
    expect(() => {
      validateConfig({
        NODE_ENV: "production",
        PAUSE_AUTH: "true"
      });
    }).toThrow("Authentication bypass (PAUSE_AUTH or DISABLE_AUTH) is strictly prohibited in production.");
  });

  it("should strictly reject auth bypass (DISABLE_AUTH=true) in production", () => {
    expect(() => {
      validateConfig({
        NODE_ENV: "production",
        DISABLE_AUTH: "true"
      });
    }).toThrow("Authentication bypass (PAUSE_AUTH or DISABLE_AUTH) is strictly prohibited in production.");
  });

  it("should validate OpenRouter Nemotron 3.5 Embed 8B defaults in v2.2", () => {
    const config = validateConfig({
      NODE_ENV: "development",
      OPENROUTER_API_KEY: "sk-or-test"
    });
    expect(config.EMBEDDING_PROVIDER).toBe("openrouter");
    expect(config.OPENROUTER_EMBEDDING_MODEL).toBe("nvidia/nemotron-3.5-embed-8b:free");
    expect(config.EMBEDDING_DIMENSIONS).toBe(1024);
    expect(config.QDRANT_DISTANCE).toBe("Cosine");
    expect(config.QDRANT_CODE_COLLECTION).toBe("tracepilot_code_v2");
    expect(config.QDRANT_INCIDENT_COLLECTION).toBe("tracepilot_incidents_v2");
    expect(config.RAG_SEMANTIC_TOP_K).toBe(30);
    expect(config.RAG_LEXICAL_TOP_K).toBe(30);
    expect(config.RAG_FINAL_TOP_K).toBe(5);
  });

  it("should reject chat model ID in embedding configuration", () => {
    expect(() => {
      validateConfig({
        OPENROUTER_EMBEDDING_MODEL: "nvidia/nemotron-3-ultra-550b-a55b:free"
      });
    }).toThrow("Chat model ID cannot be used as an embedding model.");
  });

  it("should reject invalid embedding dimensions", () => {
    expect(() => {
      validateConfig({
        EMBEDDING_DIMENSIONS: "-1"
      });
    }).toThrow("EMBEDDING_DIMENSIONS must be a positive integer.");
  });

  it("should redact sensitive fields in objects and nested structures", () => {
    const sensitivePayload = {
      user: "alice",
      password: "super_secret_password",
      token: "secret_jwt_token",
      nested: {
        authorization: "Bearer secret_bearer",
        credit_card: "4111-2222-3333-4444",
        apiKey: "raw_api_key_123",
        safeData: "non-sensitive-data"
      },
      list: [
        { secret: "api_secret_val" },
        { regularField: 123 }
      ]
    };

    const sanitized = redactSensitiveData(sensitivePayload);
    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.nested.authorization).toBe("[REDACTED]");
    expect(sanitized.nested.credit_card).toBe("[REDACTED]");
    expect(sanitized.nested.apiKey).toBe("[REDACTED]");
    expect(sanitized.nested.safeData).toBe("non-sensitive-data");
    expect(sanitized.list[0].secret).toBe("[REDACTED]");
    expect(sanitized.list[1].regularField).toBe(123);
  });

  it("should verify no active hardcoded secret patterns exist in source files", () => {
    const forbiddenPatterns = [
      /sk_live_[a-zA-Z0-9]{20,}/,
      /sk-or-v1-[a-zA-Z0-9]{30,}/,
      /eyJhbGciOi[a-zA-Z0-9_-]{30,}/
    ];

    const sourceRoots = [
      path.resolve(__dirname, "../../apps/api/src"),
      path.resolve(__dirname, "../../packages/sdk/src")
    ];

    function scanDir(dir: string): string[] {
      const violations: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", "dist", ".vite"].includes(entry.name)) {
            violations.push(...scanDir(fullPath));
          }
        } else if (/\.(ts|tsx|js|json)$/.test(entry.name) && !entry.name.endsWith(".test.ts")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          for (const pattern of forbiddenPatterns) {
            if (pattern.test(content)) {
              violations.push(`${fullPath} matches ${pattern.toString()}`);
            }
          }
        }
      }
      return violations;
    }

    const allViolations: string[] = [];
    for (const root of sourceRoots) {
      if (fs.existsSync(root)) {
        allViolations.push(...scanDir(root));
      }
    }

    expect(allViolations).toEqual([]);
  });
});
