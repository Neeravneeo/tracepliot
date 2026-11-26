import { RequestInfo } from "../types";
import { Scope } from "../scope";
import type { TracePilotClient } from "../client";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "proxy-authorization"
]);

export function sanitizeHeaders(headers: Record<string, any> = {}): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = Array.isArray(value) ? value.join(", ") : String(value);
    }
  }
  return sanitized;
}

export function extractRequestInfo(req: any): RequestInfo {
  return {
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
    query: req.query ? { ...req.query } : undefined,
    headers: sanitizeHeaders(req.headers),
    ip: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress
  };
}

/**
 * Creates Express-compatible request handling middleware.
 * Attaches request metadata, creates an isolated request scope, and records an HTTP breadcrumb.
 */
export function createExpressRequestHandler(client: TracePilotClient) {
  return function tracepilotRequestHandler(req: any, _res: any, next: any): void {
    try {
      const requestInfo = extractRequestInfo(req);
      const requestScope = client.getScope().clone();

      requestScope.setContext("request", requestInfo);
      requestScope.addBreadcrumb({
        category: "http",
        message: `${requestInfo.method || "GET"} ${requestInfo.url || "/"}`,
        level: "info",
        data: {
          ip: requestInfo.ip,
          query: requestInfo.query
        }
      });

      req._tracepilot_scope = requestScope;
    } catch (middlewareErr) {
      if (client.isDebugEnabled()) {
        console.warn("[TracePilot] Error in expressRequestHandler:", middlewareErr);
      }
    }

    if (typeof next === "function") {
      next();
    }
  };
}

/**
 * Creates Express-compatible error handling middleware.
 * Automatically captures unhandled exceptions with full request and breadcrumb context.
 */
export function createExpressErrorHandler(client: TracePilotClient) {
  return function tracepilotErrorHandler(err: any, req: any, _res: any, next: any): void {
    try {
      const scope: Scope | undefined = req?._tracepilot_scope;
      client.captureExceptionWithScope(err, scope);
    } catch (middlewareErr) {
      if (client.isDebugEnabled()) {
        console.warn("[TracePilot] Error in expressErrorHandler:", middlewareErr);
      }
    }

    if (typeof next === "function") {
      next(err);
    }
  };
}
