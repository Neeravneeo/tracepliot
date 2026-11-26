import {
  Breadcrumb,
  CaptureOptions,
  IngestPayload,
  IngestResponse,
  SeverityLevel,
  TracePilotConfig,
  UserContext
} from "./types";
import { HttpTransport } from "./transport";
import { Scope } from "./scope";
import {
  createExpressErrorHandler,
  createExpressRequestHandler
} from "./integrations/express";

export class TracePilotClient {
  private config: Required<TracePilotConfig> | null = null;
  private transport: HttpTransport | null = null;
  private globalScope = new Scope(100);
  private isInitialized = false;
  private isConsoleHooked = false;

  /**
   * Initialize TracePilot client with configuration.
   */
  public init(config: TracePilotConfig): void {
    const resolvedApiKey = config.apiKey || process.env.TRACEPILOT_API_KEY || "";
    const resolvedEndpoint =
      config.endpoint || process.env.TRACEPILOT_ENDPOINT || "http://localhost:4000";
    const resolvedRelease = config.release || process.env.TRACEPILOT_RELEASE || "1.0.0";
    const resolvedEnv =
      config.environment || process.env.NODE_ENV || "development";
    const resolvedTimeout = config.timeoutMs ?? 3000;
    const resolvedDebug = config.debug ?? (resolvedEnv !== "production");
    const resolvedMaxBreadcrumbs = config.maxBreadcrumbs ?? 100;
    const resolvedMaxRetries = config.maxRetries ?? 2;
    const resolvedAutoBreadcrumbs = config.autoBreadcrumbs ?? { console: true };

    this.config = {
      apiKey: resolvedApiKey,
      endpoint: resolvedEndpoint,
      release: resolvedRelease,
      environment: resolvedEnv,
      timeoutMs: resolvedTimeout,
      debug: resolvedDebug,
      maxBreadcrumbs: resolvedMaxBreadcrumbs,
      maxRetries: resolvedMaxRetries,
      autoBreadcrumbs: resolvedAutoBreadcrumbs
    };

    this.globalScope = new Scope(this.config.maxBreadcrumbs);

    if (!resolvedApiKey) {
      if (this.config.debug) {
        console.warn("[TracePilot] Warning: Initialized without an API key. Events will not be transmitted.");
      }
    }

    this.transport = new HttpTransport({
      endpoint: this.config.endpoint,
      apiKey: this.config.apiKey,
      timeoutMs: this.config.timeoutMs,
      debug: this.config.debug,
      maxRetries: this.config.maxRetries
    });

    if (this.config.autoBreadcrumbs?.console) {
      this.enableConsoleBreadcrumbs();
    }

    this.isInitialized = true;
  }

  /**
   * Set user context on the global scope.
   */
  public setUser(user: UserContext | null): this {
    this.globalScope.setUser(user);
    return this;
  }

  /**
   * Retrieve current user context.
   */
  public getUser(): UserContext | null {
    return this.globalScope.getUser();
  }

  /**
   * Set a key-value tag on the global scope.
   */
  public setTag(key: string, value: string): this {
    this.globalScope.setTag(key, value);
    return this;
  }

  /**
   * Set multiple key-value tags on the global scope.
   */
  public setTags(tags: Record<string, string>): this {
    this.globalScope.setTags(tags);
    return this;
  }

  /**
   * Retrieve current tags from the global scope.
   */
  public getTags(): Record<string, string> {
    return this.globalScope.getTags();
  }

  /**
   * Attach arbitrary contextual data on the global scope.
   */
  public setContext(key: string, value: unknown): this {
    this.globalScope.setContext(key, value);
    return this;
  }

  /**
   * Alias for setContext.
   */
  public setExtra(key: string, value: unknown): this {
    return this.setContext(key, value);
  }

  /**
   * Retrieve current extra context.
   */
  public getContext(): Record<string, unknown> {
    return this.globalScope.getContext();
  }

  /**
   * Record a breadcrumb in the global scope.
   */
  public addBreadcrumb(breadcrumb: Breadcrumb): this {
    this.globalScope.addBreadcrumb(breadcrumb);
    return this;
  }

  /**
   * Retrieve all recorded breadcrumbs from the global scope.
   */
  public getBreadcrumbs(): Breadcrumb[] {
    return this.globalScope.getBreadcrumbs();
  }

  /**
   * Clear recorded breadcrumbs from the global scope.
   */
  public clearBreadcrumbs(): this {
    this.globalScope.clearBreadcrumbs();
    return this;
  }

  /**
   * Retrieve the global scope instance.
   */
  public getScope(): Scope {
    return this.globalScope;
  }

  /**
   * Mutate the current scope with a custom configuration callback.
   */
  public configureScope(callback: (scope: Scope) => void): this {
    try {
      callback(this.globalScope);
    } catch (err) {
      if (this.config?.debug) {
        console.warn("[TracePilot] Error in configureScope callback:", err);
      }
    }
    return this;
  }

  /**
   * Run an asynchronous or synchronous action inside an isolated child scope.
   */
  public async withScope<T>(callback: (scope: Scope) => Promise<T> | T): Promise<T> {
    const childScope = this.globalScope.clone();
    return await callback(childScope);
  }

  /**
   * Capture an exception and dispatch it asynchronously to TracePilot.
   * This method will NEVER throw or crash the host application.
   */
  public async captureException(
    error: unknown,
    options?: CaptureOptions
  ): Promise<IngestResponse | null> {
    return await this.captureExceptionWithScope(error, this.globalScope, options);
  }

  /**
   * Capture an exception with an explicitly provided scope (e.g. from an HTTP request).
   */
  public async captureExceptionWithScope(
    error: unknown,
    scope?: Scope,
    options?: CaptureOptions
  ): Promise<IngestResponse | null> {
    try {
      this.ensureInitialized();

      if (!this.config?.apiKey) {
        if (this.config?.debug) {
          console.warn("[TracePilot] captureException skipped: No API key configured.");
        }
        return null;
      }

      const activeScope = scope || this.globalScope;
      const payload = this.buildPayload(error, activeScope, options);

      return await this.transport!.send(payload);
    } catch (err: unknown) {
      if (this.config?.debug) {
        console.warn("[TracePilot] Safe fallback caught error inside captureException:", err);
      }
      return null;
    }
  }

  /**
   * Capture an informational, warning, or error message as an incident.
   */
  public async captureMessage(
    message: string,
    level: SeverityLevel = "info",
    options?: CaptureOptions
  ): Promise<IngestResponse | null> {
    const syntheticError = {
      name: `Message:${level.toUpperCase()}`,
      message,
      stack: new Error().stack
    };

    const mergedOptions: CaptureOptions = {
      ...(options || {}),
      level,
      tags: {
        ...(options?.tags || {}),
        level
      }
    };

    return await this.captureException(syntheticError, mergedOptions);
  }

  /**
   * Express request middleware for incoming HTTP requests.
   */
  public requestHandler() {
    return createExpressRequestHandler(this);
  }

  /**
   * Express error middleware for capturing unhandled route exceptions.
   */
  public errorHandler() {
    return createExpressErrorHandler(this);
  }

  /**
   * Flush pending requests within timeout.
   */
  public async flush(timeoutMs = 2500): Promise<boolean> {
    if (!this.transport) {
      return true;
    }
    return await this.transport.flush(timeoutMs);
  }

  /**
   * Close the client and flush all pending events.
   */
  public async close(timeoutMs = 2500): Promise<boolean> {
    if (!this.transport) {
      return true;
    }
    return await this.transport.close(timeoutMs);
  }

  /**
   * Install global unhandled rejection and uncaught exception handlers.
   */
  public installGlobalHandler(): void {
    if (typeof process !== "undefined" && process.on) {
      process.on("uncaughtException", (error: Error) => {
        if (this.config?.debug) {
          console.error("[TracePilot] Uncaught Exception caught by global handler:", error);
        }
        this.captureException(error, { level: "critical" });
      });

      process.on("unhandledRejection", (reason: unknown) => {
        if (this.config?.debug) {
          console.error("[TracePilot] Unhandled Rejection caught by global handler:", reason);
        }
        this.captureException(reason, { level: "error" });
      });
    }
  }

  /**
   * Safely instrument console.log, console.warn, and console.error to record breadcrumbs.
   */
  public enableConsoleBreadcrumbs(): void {
    if (this.isConsoleHooked || typeof console === "undefined") {
      return;
    }

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    let isCapturing = false;

    console.log = (...args: any[]) => {
      originalLog.apply(console, args);
      if (!isCapturing) {
        try {
          isCapturing = true;
          this.addBreadcrumb({
            category: "console",
            message: args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "),
            level: "info"
          });
        } catch {
          // Ignore formatting errors in console instrumentation
        } finally {
          isCapturing = false;
        }
      }
    };

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args);
      if (!isCapturing) {
        try {
          isCapturing = true;
          this.addBreadcrumb({
            category: "console",
            message: args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "),
            level: "warning"
          });
        } catch {
          // Ignore
        } finally {
          isCapturing = false;
        }
      }
    };

    console.error = (...args: any[]) => {
      originalError.apply(console, args);
      if (!isCapturing) {
        try {
          isCapturing = true;
          this.addBreadcrumb({
            category: "console",
            message: args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "),
            level: "error"
          });
        } catch {
          // Ignore
        } finally {
          isCapturing = false;
        }
      }
    };

    this.isConsoleHooked = true;
  }

  public isDebugEnabled(): boolean {
    return Boolean(this.config?.debug);
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.transport || !this.config) {
      this.init({});
    }
  }

  private buildPayload(
    error: unknown,
    scope: Scope,
    options?: CaptureOptions
  ): IngestPayload {
    let exceptionType = "Error";
    let message = "Unknown error";
    let stack: string | undefined;

    if (error instanceof Error) {
      exceptionType = error.name || error.constructor.name || "Error";
      message = error.message || String(error);
      stack = error.stack;
    } else if (typeof error === "string") {
      message = error;
    } else if (error && typeof error === "object") {
      const errObj = error as Record<string, unknown>;
      exceptionType = typeof errObj.name === "string" ? errObj.name : "CustomError";
      message = typeof errObj.message === "string" ? errObj.message : JSON.stringify(error);
      stack = typeof errObj.stack === "string" ? errObj.stack : undefined;
    }

    const runtimeVersion = typeof process !== "undefined" ? process.version : "unknown";
    const runtimePlatform = typeof process !== "undefined" ? process.platform : undefined;

    const payload: IngestPayload = {
      eventType: "exception",
      timestamp: new Date().toISOString(),
      environment: this.config?.environment || "development",
      release: this.config?.release || "1.0.0",
      runtime: {
        language: "javascript",
        version: runtimeVersion,
        platform: runtimePlatform
      },
      exception: {
        type: exceptionType,
        message,
        stack
      }
    };

    // Apply active scope and any ad-hoc capture options
    scope.applyToPayload(payload, options);

    return payload;
  }
}
