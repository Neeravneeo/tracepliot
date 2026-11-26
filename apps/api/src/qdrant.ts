import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "tracepilot_evidence";

// Create a single instance
let qdrantClient: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient | null {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url) {
    return null;
  }
  
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url,
      apiKey,
    });
  }
  
  return qdrantClient;
}

export async function checkQdrantConnectivity(): Promise<{ status: 'ok' | 'error' | 'disabled', message: string }> {
  const client = getQdrantClient();
  if (!client) {
    return { status: 'disabled', message: 'Qdrant is not configured (QDRANT_URL is missing).' };
  }

  try {
    // Attempt to list collections to verify connectivity and credentials
    await client.getCollections();
    return { status: 'ok', message: 'Successfully connected to Qdrant.' };
  } catch (error: any) {
    console.error('[Qdrant] Connectivity check failed:', error);
    return { status: 'error', message: error.message || 'Failed to connect to Qdrant.' };
  }
}

export async function initializeQdrantCollection(dimension: number): Promise<void> {
  const client = getQdrantClient();
  if (!client) return;

  try {
    const res = await client.getCollections();
    const exists = res.collections.some(c => c.name === QDRANT_COLLECTION);
    
    if (!exists) {
      console.log(`[Qdrant] Creating collection: ${QDRANT_COLLECTION} with dimension: ${dimension}`);
      await client.createCollection(QDRANT_COLLECTION, {
        vectors: {
          size: dimension,
          distance: 'Cosine' // Typically used for text embeddings
        }
      });
      console.log(`[Qdrant] Collection ${QDRANT_COLLECTION} created successfully.`);
    } else {
      console.log(`[Qdrant] Collection ${QDRANT_COLLECTION} already exists.`);
    }

    // Ensure filtering indices exist for fast & strict tenant isolation queries
    try {
      await client.createPayloadIndex(QDRANT_COLLECTION, {
        field_name: "projectId",
        field_schema: "keyword",
      });
    } catch (_) {}

    try {
      await client.createPayloadIndex(QDRANT_COLLECTION, {
        field_name: "evidenceType",
        field_schema: "keyword",
      });
    } catch (_) {}
  } catch (error: any) {
    console.error('[Qdrant] Failed to initialize collection:', error);
    // Suppress error so it doesn't crash the server
  }
}
