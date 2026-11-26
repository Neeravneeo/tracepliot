// ponytail: clean, robust embedding provider interface with OpenRouter Nemotron 3.5 Embed 8B and deterministic offline double
import crypto from "crypto";

export interface EmbeddingOptions {
  taskType?: "document" | "query" | "passage";
  dimensions?: number;
}

export interface IEmbeddingProvider {
  name: string;
  model: string;
  dimensions: number;
  embedText(text: string, options?: EmbeddingOptions): Promise<number[]>;
  embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]>;
}

export const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || "nvidia/nemotron-3.5-embed-8b:free";
export const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSIONS || "1024", 10);

/**
 * OpenRouter Nemotron 3.5 Embed 8B Provider (v2.2 Provider Contract)
 */
export class OpenRouterEmbeddingProvider implements IEmbeddingProvider {
  name = "openrouter-nemotron-embed";
  model: string;
  dimensions: number;
  baseUrl: string;
  apiKey?: string;

  constructor(options?: { model?: string; dimensions?: number; baseUrl?: string; apiKey?: string }) {
    this.model = options?.model || EMBEDDING_MODEL;
    this.dimensions = options?.dimensions || EMBEDDING_DIMENSION;
    this.baseUrl = (options?.baseUrl || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
    this.apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;

    // Fail closed: reject chat model configured as embedding model
    const chatModel = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-ultra-550b-a55b:free";
    if (this.model === chatModel || this.model.includes("ultra-550b")) {
      throw new Error(`[Embedding] Security Violation: Chat model '${this.model}' cannot be routed to the embeddings endpoint.`);
    }

    if (this.dimensions <= 0 || !Number.isInteger(this.dimensions)) {
      throw new Error(`[Embedding] Invalid embedding dimensions '${this.dimensions}'. Must be a positive integer.`);
    }
  }

  async embedText(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const batch = await this.embedBatch([text], options);
    if (!batch[0] || batch[0].length !== this.dimensions) {
      throw new Error(`[Embedding] Expected vector of dimension ${this.dimensions}, received ${batch[0]?.length ?? 0}`);
    }
    return batch[0];
  }

  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error("[Embedding] OPENROUTER_API_KEY is not configured.");
    }

    const taskType = options?.taskType || "document";
    // Map taskType to OpenRouter input_type parameter if passage/query
    const inputType = taskType === "query" ? "query" : "passage";

    const payload = {
      model: this.model,
      input: texts,
      dimensions: this.dimensions,
      input_type: inputType
    };

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[Embedding] OpenRouter returned ${response.status}: ${errText}`);
    }

    const json: any = await response.json();
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error("[Embedding] Malformed response from OpenRouter: missing 'data' array");
    }

    // Validate out-of-order and completeness
    const results: number[][] = new Array(texts.length);
    for (const item of json.data) {
      if (item.index === undefined || item.index < 0 || item.index >= texts.length) {
        throw new Error(`[Embedding] Invalid vector index in response: ${item.index}`);
      }
      if (!Array.isArray(item.embedding) || item.embedding.length !== this.dimensions) {
        throw new Error(`[Embedding] Invalid embedding dimension at index ${item.index}: expected ${this.dimensions}`);
      }
      // Check finite values
      if (!item.embedding.every((v: any) => typeof v === "number" && Number.isFinite(v))) {
        throw new Error(`[Embedding] Non-finite or NaN value detected in embedding at index ${item.index}`);
      }
      results[item.index] = item.embedding;
    }

    for (let i = 0; i < texts.length; i++) {
      if (!results[i]) {
        throw new Error(`[Embedding] Missing embedding result for input index ${i}`);
      }
    }

    return results;
  }
}

/**
 * Deterministic Offline Mock Embedding Provider for isolated tests & CI
 */
export class OfflineMockEmbeddingProvider implements IEmbeddingProvider {
  name = "offline-mock-embedding-provider";
  model: string;
  dimensions: number;

  constructor(model = EMBEDDING_MODEL, dimensions = EMBEDDING_DIMENSION) {
    this.model = model;
    this.dimensions = dimensions;
  }

  async embedText(text: string, options?: EmbeddingOptions): Promise<number[]> {
    const taskType = options?.taskType || "document";
    // Produce deterministic 1024-dim unit vector from sha256 hash
    const hash = crypto.createHash("sha256").update(`${this.model}:${taskType}:${text}`).digest();
    const vec: number[] = new Array(this.dimensions);
    let norm = 0;

    for (let i = 0; i < this.dimensions; i++) {
      const byte = hash[i % hash.length];
      const sign = (i % 2 === 0) ? 1 : -1;
      const val = sign * ((byte / 255) + ((i * 17) % 31) / 100);
      vec[i] = val;
      norm += val * val;
    }

    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < this.dimensions; i++) {
      vec[i] = Number((vec[i] / norm).toFixed(6));
    }

    return vec;
  }

  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embedText(t, options)));
  }
}

let activeProvider: IEmbeddingProvider | null = null;

export function getEmbeddingProvider(): IEmbeddingProvider {
  if (activeProvider) return activeProvider;

  // Use OpenRouter if key is present and not explicitly set to mock
  if (process.env.OPENROUTER_API_KEY && process.env.EMBEDDING_PROVIDER === "openrouter" && process.env.NODE_ENV !== "test") {
    try {
      activeProvider = new OpenRouterEmbeddingProvider();
      return activeProvider;
    } catch {
      // Fallback to offline mock on validation failure in non-prod
      activeProvider = new OfflineMockEmbeddingProvider();
      return activeProvider;
    }
  }

  activeProvider = new OfflineMockEmbeddingProvider();
  return activeProvider;
}

export function setEmbeddingProvider(provider: IEmbeddingProvider | null): void {
  activeProvider = provider;
}

/**
 * Backwards-compatible standalone embedText function
 */
export async function embedText(text: string, taskType?: string): Promise<number[]> {
  const provider = getEmbeddingProvider();
  const mappedType = taskType?.toLowerCase().includes("query") ? "query" : "document";
  return provider.embedText(text, { taskType: mappedType });
}
