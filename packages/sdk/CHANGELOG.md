# Changelog — @tracepilot/sdk

All notable changes to `@tracepilot/sdk` will be documented in this file.

## [0.1.0] - 2026-11-24
### Added
- Core `TracePilotClient` with automatic initialization and singleton lifecycle.
- Asynchronous `HttpTransport` featuring bounded request tracking and exponential retry backoff.
- Context isolation with `withScope`, `setUser`, `setTag`, `setContext`, and `addBreadcrumb`.
- Express middlewares: `requestHandler` for HTTP context capture and `errorHandler` for uncaught runtime crashes.
- Host failure isolation guarantee preventing application crashes on network outages or ingestion degradation.
- Graceful shutdown flush utility: `flush(timeoutMs)`.
