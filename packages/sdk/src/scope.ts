import { Breadcrumb, CaptureOptions, IngestPayload, UserContext } from "./types";

export class Scope {
  private user: UserContext | null = null;
  private tags: Record<string, string> = {};
  private context: Record<string, unknown> = {};
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs: number;

  constructor(maxBreadcrumbs = 100) {
    this.maxBreadcrumbs = maxBreadcrumbs;
  }

  /**
   * Set user information associated with future incidents.
   */
  public setUser(user: UserContext | null): this {
    this.user = user ? { ...user } : null;
    return this;
  }

  /**
   * Retrieve current user context.
   */
  public getUser(): UserContext | null {
    return this.user ? { ...this.user } : null;
  }

  /**
   * Set a key-value tag.
   */
  public setTag(key: string, value: string): this {
    this.tags[key] = String(value);
    return this;
  }

  /**
   * Set multiple key-value tags.
   */
  public setTags(tags: Record<string, string>): this {
    for (const [k, v] of Object.entries(tags)) {
      this.tags[k] = String(v);
    }
    return this;
  }

  /**
   * Retrieve currently configured tags.
   */
  public getTags(): Record<string, string> {
    return { ...this.tags };
  }

  /**
   * Attach arbitrary structured context data under a key.
   */
  public setContext(key: string, value: unknown): this {
    this.context[key] = value;
    return this;
  }

  /**
   * Alias for setContext, matching popular APM patterns.
   */
  public setExtra(key: string, value: unknown): this {
    return this.setContext(key, value);
  }

  /**
   * Retrieve current contextual data.
   */
  public getContext(): Record<string, unknown> {
    return { ...this.context };
  }

  /**
   * Add a breadcrumb to the ring buffer.
   */
  public addBreadcrumb(breadcrumb: Breadcrumb): this {
    const entry: Breadcrumb = {
      timestamp: breadcrumb.timestamp || new Date().toISOString(),
      message: breadcrumb.message,
      category: breadcrumb.category || "custom",
      level: breadcrumb.level || "info",
      data: breadcrumb.data ? { ...breadcrumb.data } : undefined
    };

    this.breadcrumbs.push(entry);

    // Keep within ring buffer limits
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.splice(0, this.breadcrumbs.length - this.maxBreadcrumbs);
    }

    return this;
  }

  /**
   * Retrieve all recorded breadcrumbs in chronological order.
   */
  public getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Clear all recorded breadcrumbs.
   */
  public clearBreadcrumbs(): this {
    this.breadcrumbs = [];
    return this;
  }

  /**
   * Reset all scope data (user, tags, context, breadcrumbs).
   */
  public clear(): this {
    this.user = null;
    this.tags = {};
    this.context = {};
    this.breadcrumbs = [];
    return this;
  }

  /**
   * Clone this scope into an independent child scope.
   */
  public clone(): Scope {
    const copy = new Scope(this.maxBreadcrumbs);
    if (this.user) {
      copy.user = { ...this.user };
    }
    copy.tags = { ...this.tags };
    copy.context = { ...this.context };
    copy.breadcrumbs = [...this.breadcrumbs];
    return copy;
  }

  /**
   * Merge current scope data into the given IngestPayload.
   */
  public applyToPayload(payload: IngestPayload, options?: CaptureOptions): void {
    // 1. Tags: merge scope tags + option tags
    const mergedTags: Record<string, string> = {
      ...this.tags,
      ...(options?.tags || {})
    };
    if (Object.keys(mergedTags).length > 0) {
      payload.tags = mergedTags;
    }

    // 2. Context: merge scope context + options context + user + breadcrumbs
    const mergedContext: Record<string, unknown> = {
      ...this.context,
      ...(options?.context || {})
    };

    // User context
    const resolvedUser = options?.user || this.user;
    if (resolvedUser) {
      mergedContext.user = resolvedUser;
    }

    // Breadcrumbs
    const combinedBreadcrumbs = [
      ...this.breadcrumbs,
      ...(options?.breadcrumbs || [])
    ];
    if (combinedBreadcrumbs.length > 0) {
      mergedContext.breadcrumbs = combinedBreadcrumbs;
    }

    // Severity level
    if (options?.level) {
      mergedContext.level = options.level;
    }

    if (Object.keys(mergedContext).length > 0) {
      payload.context = mergedContext;
    }
  }
}
