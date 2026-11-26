import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TracePilotClient } from "./client";
import { Scope } from "./scope";

describe("TracePilotClient SDK", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should capture and send a valid exception event asynchronously", async () => {
    const mockResponse = {
      incidentId: "inc_test123",
      status: "accepted" as const
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_secret_key_123",
      endpoint: "http://localhost:4000",
      release: "1.0.0",
      environment: "test",
      debug: false,
      autoBreadcrumbs: { console: false }
    });

    const sampleError = new TypeError("Cannot read properties of undefined (reading 'profile')");
    const result = await client.captureException(sampleError, {
      tags: { feature: "profile" },
      context: { userId: "demo-user" }
    });

    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, requestInit] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/v1/ingest/events");
    expect(requestInit.headers["Authorization"]).toBe("Bearer tp_dev_secret_key_123");
    expect(requestInit.headers["Content-Type"]).toBe("application/json");

    const sentBody = JSON.parse(requestInit.body);
    expect(sentBody.eventType).toBe("exception");
    expect(sentBody.environment).toBe("test");
    expect(sentBody.release).toBe("1.0.0");
    expect(sentBody.exception.type).toBe("TypeError");
    expect(sentBody.exception.message).toBe("Cannot read properties of undefined (reading 'profile')");
    expect(sentBody.exception.stack).toContain("TypeError");
    expect(sentBody.runtime.language).toBe("javascript");
    expect(sentBody.runtime.version).toBeDefined();
    expect(sentBody.tags.feature).toBe("profile");
    expect(sentBody.context.userId).toBe("demo-user");
  });

  it("should never crash host application when API is unreachable or returns 500", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED connect localhost:4000"));

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_secret_key_123",
      endpoint: "http://localhost:4000",
      debug: false,
      autoBreadcrumbs: { console: false }
    });

    let errorThrown = false;
    let result = null;
    try {
      result = await client.captureException(new Error("Host app business error"));
    } catch {
      errorThrown = true;
    }

    expect(errorThrown).toBe(false);
    expect(result).toBeNull();
  });

  it("should safely handle timeout without crashing host application", async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const abortError = new Error("The operation was aborted");
          abortError.name = "AbortError";
          reject(abortError);
        }, 50);
      });
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_secret_key_123",
      endpoint: "http://localhost:4000",
      timeoutMs: 20,
      debug: false,
      autoBreadcrumbs: { console: false }
    });

    const result = await client.captureException(new Error("Timeout scenario"));
    expect(result).toBeNull();
  });

  it("should handle error objects that are not standard Error instances", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ incidentId: "inc_str_err", status: "accepted" })
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_secret_key_123",
      endpoint: "http://localhost:4000",
      debug: false,
      autoBreadcrumbs: { console: false }
    });

    const result = await client.captureException("Plain string failure");
    expect(result?.incidentId).toBe("inc_str_err");

    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.exception.message).toBe("Plain string failure");
  });

  it("should manage Breadcrumbs and enforce ring buffer limits", async () => {
    const scope = new Scope(3);
    scope.addBreadcrumb({ message: "step 1", category: "auth" });
    scope.addBreadcrumb({ message: "step 2", category: "auth" });
    scope.addBreadcrumb({ message: "step 3", category: "db" });
    scope.addBreadcrumb({ message: "step 4", category: "api" });

    const breadcrumbs = scope.getBreadcrumbs();
    expect(breadcrumbs).toHaveLength(3);
    expect(breadcrumbs[0].message).toBe("step 2");
    expect(breadcrumbs[1].message).toBe("step 3");
    expect(breadcrumbs[2].message).toBe("step 4");
    expect(breadcrumbs[2].category).toBe("api");
  });

  it("should attach Scope (user, tags, context, breadcrumbs) to captured exceptions", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ incidentId: "inc_scope_1", status: "accepted" })
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_key",
      endpoint: "http://localhost:4000",
      autoBreadcrumbs: { console: false }
    });

    client.setUser({ id: "usr_42", email: "user@example.com" });
    client.setTag("env", "staging");
    client.setTags({ region: "us-east-1", service: "billing" });
    client.setContext("invoice", { id: "inv_99", amount: 1500 });
    client.addBreadcrumb({ message: "Initiating payment", category: "payment" });

    await client.captureException(new Error("Payment gateway failure"));

    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.tags.region).toBe("us-east-1");
    expect(sentBody.tags.service).toBe("billing");
    expect(sentBody.context.user.id).toBe("usr_42");
    expect(sentBody.context.user.email).toBe("user@example.com");
    expect(sentBody.context.invoice.amount).toBe(1500);
    expect(sentBody.context.breadcrumbs).toHaveLength(1);
    expect(sentBody.context.breadcrumbs[0].message).toBe("Initiating payment");
  });

  it("should support withScope for isolated child context", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ incidentId: "inc_isolated", status: "accepted" })
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_key",
      endpoint: "http://localhost:4000",
      autoBreadcrumbs: { console: false }
    });

    client.setTag("global_tag", "yes");

    await client.withScope(async (childScope) => {
      childScope.setTag("child_tag", "special");
      childScope.addBreadcrumb({ message: "In child transaction" });
      await client.captureExceptionWithScope(new Error("Child error"), childScope);
    });

    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.tags.global_tag).toBe("yes");
    expect(sentBody.tags.child_tag).toBe("special");
    expect(sentBody.context.breadcrumbs[0].message).toBe("In child transaction");

    // Verify parent global scope remained clean
    expect(client.getTags().child_tag).toBeUndefined();
    expect(client.getBreadcrumbs()).toHaveLength(0);
  });

  it("should capture messages with severity levels using captureMessage", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ incidentId: "inc_msg_1", status: "accepted" })
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_key",
      endpoint: "http://localhost:4000",
      autoBreadcrumbs: { console: false }
    });

    const res = await client.captureMessage("High memory consumption detected", "warning");
    expect(res?.incidentId).toBe("inc_msg_1");

    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.exception.type).toBe("Message:WARNING");
    expect(sentBody.exception.message).toBe("High memory consumption detected");
    expect(sentBody.tags.level).toBe("warning");
  });

  it("should provide Express request and error middleware", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ incidentId: "inc_express_err", status: "accepted" })
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_key",
      endpoint: "http://localhost:4000",
      autoBreadcrumbs: { console: false }
    });

    const reqHandler = client.requestHandler();
    const errHandler = client.errorHandler();

    // 1. Simulate incoming Express Request
    const mockReq: any = {
      method: "POST",
      originalUrl: "/api/checkout",
      path: "/checkout",
      headers: {
        authorization: "Bearer secret-customer-token",
        "user-agent": "Chrome/120"
      },
      ip: "192.168.1.10"
    };
    const mockRes: any = {};
    const nextFn = vi.fn();

    reqHandler(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalled();
    expect(mockReq._tracepilot_scope).toBeDefined();

    // 2. Simulate error in route handler caught by Express error middleware
    const routeError = new Error("Database deadlock during checkout");
    const errNextFn = vi.fn();

    errHandler(routeError, mockReq, mockRes, errNextFn);
    expect(errNextFn).toHaveBeenCalledWith(routeError);

    // Give async send microtask time to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(sentBody.exception.message).toBe("Database deadlock during checkout");
    expect(sentBody.context.request.method).toBe("POST");
    expect(sentBody.context.request.url).toBe("/api/checkout");
    expect(sentBody.context.request.headers.authorization).toBe("[REDACTED]");
    expect(sentBody.context.request.headers["user-agent"]).toBe("Chrome/120");
    expect(sentBody.context.breadcrumbs[0].message).toBe("POST /api/checkout");
  });

  it("should flush pending requests cleanly", async () => {
    let resolveSend: any;
    global.fetch = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolveSend = resolve;
      });
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_key",
      endpoint: "http://localhost:4000",
      autoBreadcrumbs: { console: false }
    });

    // Start send
    const sendPromise = client.captureException(new Error("Async flush test"));

    // Call flush
    const flushPromise = client.flush(1000);

    // Resolve fetch
    resolveSend({
      ok: true,
      status: 200,
      json: async () => ({ incidentId: "inc_flushed", status: "accepted" })
    });

    const flushed = await flushPromise;
    expect(flushed).toBe(true);

    const result = await sendPromise;
    expect(result?.incidentId).toBe("inc_flushed");
  });

  it("should retry transient 5xx errors and succeed if later attempt returns 200", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: false,
          status: 503,
          text: async () => "Service Temporarily Overloaded"
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ incidentId: "inc_retry_success", status: "accepted" })
      };
    });

    const client = new TracePilotClient();
    client.init({
      apiKey: "tp_dev_key",
      endpoint: "http://localhost:4000",
      maxRetries: 2,
      autoBreadcrumbs: { console: false }
    });

    const result = await client.captureException(new Error("Retry scenario"));
    expect(result?.incidentId).toBe("inc_retry_success");
    expect(callCount).toBe(2);
  });
});
