import { IngestPayload, IngestResponse } from "./types";

export interface TransportOptions {
  endpoint: string;
  apiKey: string;
  timeoutMs: number;
  debug: boolean;
  maxRetries?: number;
}

export class HttpTransport {
  private endpoint: string;
  private apiKey: string;
  private timeoutMs: number;
  private debug: boolean;
  private maxRetries: number;
  private pendingRequests = new Set<Promise<IngestResponse | null>>();
  private isClosed = false;

  constructor(options: TransportOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs;
    this.debug = options.debug;
    this.maxRetries = options.maxRetries ?? 2;
  }

  /**
   * Send an incident payload to the TracePilot ingestion endpoint.
   * Performs automatic retries on transient network errors.
   * Guaranteed never to throw or crash the host process.
   */
  public async send(payload: IngestPayload): Promise<IngestResponse | null> {
    if (this.isClosed) {
      if (this.debug) {
        console.warn("[TracePilot] Transport is closed. Event discarded.");
      }
      return null;
    }

    const sendPromise = this.performSendWithRetries(payload);
    this.pendingRequests.add(sendPromise);

    try {
      return await sendPromise;
    } finally {
      this.pendingRequests.delete(sendPromise);
    }
  }

  /**
   * Flush all active / pending HTTP requests within the specified timeout.
   * Useful for graceful server shutdown and serverless / Lambda execution ends.
   */
  public async flush(timeoutMs = 2500): Promise<boolean> {
    if (this.pendingRequests.size === 0) {
      return true;
    }

    const allPending = Promise.all(Array.from(this.pendingRequests));
    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => {
        if (this.debug) {
          console.warn(`[TracePilot] Flush timed out after ${timeoutMs}ms with ${this.pendingRequests.size} pending requests.`);
        }
        resolve(false);
      }, timeoutMs);
    });

    try {
      const completed = await Promise.race([
        allPending.then(() => true),
        timeoutPromise
      ]);
      return completed;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Close the transport, flush pending requests, and disable further transmissions.
   */
  public async close(timeoutMs = 2500): Promise<boolean> {
    this.isClosed = true;
    return await this.flush(timeoutMs);
  }

  private async performSendWithRetries(payload: IngestPayload): Promise<IngestResponse | null> {
    const url = `${this.endpoint}/api/v1/ingest/events`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timer);

        if (response.ok) {
          const data = (await response.json()) as IngestResponse;
          if (this.debug) {
            console.log(`[TracePilot] Incident accepted with ID: ${data.incidentId}`);
          }
          return data;
        }

        // 4xx client errors (e.g. 400 Bad Request, 401 Unauthorized) should NOT be retried
        if (response.status >= 400 && response.status < 500) {
          const errorText = await response.text().catch(() => "");
          if (this.debug) {
            console.warn(`[TracePilot] Ingestion rejected (status ${response.status}):`, errorText);
          }
          return null;
        }

        // 5xx server errors: retry if attempts remain
        if (attempt < this.maxRetries) {
          const backoffMs = Math.min(200 * Math.pow(2, attempt), 1000);
          if (this.debug) {
            console.warn(`[TracePilot] Server returned ${response.status}. Retrying in ${backoffMs}ms...`);
          }
          await this.delay(backoffMs);
          continue;
        }

        return null;
      } catch (err: unknown) {
        clearTimeout(timer);

        // Network or Abort errors: retry if attempts remain
        if (attempt < this.maxRetries) {
          const backoffMs = Math.min(200 * Math.pow(2, attempt), 1000);
          if (this.debug) {
            const msg = err instanceof Error ? err.message : String(err);
            console.warn(`[TracePilot] Network error (${msg}). Retrying in ${backoffMs}ms...`);
          }
          await this.delay(backoffMs);
          continue;
        }

        if (this.debug) {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[TracePilot] Failed to send exception event after ${attempt} retries: ${message}`);
        }
        return null;
      }
    }

    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
