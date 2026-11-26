export type SeverityLevel = "debug" | "info" | "warning" | "error" | "critical";

export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  ipAddress?: string;
  [key: string]: unknown;
}

export interface Breadcrumb {
  category?: string;
  message: string;
  level?: SeverityLevel;
  timestamp?: string; // ISO 8601 string
  data?: Record<string, unknown>;
}

export interface TracePilotConfig {
  apiKey?: string;
  endpoint?: string;
  release?: string;
  environment?: string;
  timeoutMs?: number;
  debug?: boolean;
  maxBreadcrumbs?: number; // Maximum breadcrumbs in buffer (default: 100)
  maxRetries?: number; // Number of retries on transient network errors (default: 2)
  autoBreadcrumbs?: {
    console?: boolean;
  };
}

export interface CaptureOptions {
  tags?: Record<string, string>;
  context?: Record<string, unknown>;
  level?: SeverityLevel;
  user?: UserContext;
  breadcrumbs?: Breadcrumb[];
}

export interface RuntimeInfo {
  language: string;
  version: string;
  platform?: string;
}

export interface ExceptionInfo {
  type: string;
  message: string;
  stack?: string;
}

export interface IngestPayload {
  eventType: "exception";
  timestamp: string;
  environment: string;
  release: string;
  runtime: RuntimeInfo;
  exception: ExceptionInfo;
  context?: Record<string, unknown>;
  tags?: Record<string, string>;
}

export interface IngestResponse {
  incidentId: string;
  status: "accepted" | "rejected";
  message?: string;
}

export interface RequestInfo {
  method?: string;
  url?: string;
  path?: string;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  ip?: string;
}
