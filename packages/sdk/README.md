# @tracepilot/sdk

Official Node.js and TypeScript client SDK for **TracePilot** — real-time error capture, distributed request tracing, and AI-assisted debugging.

## Features
- 🚀 **Zero-Crash Host Isolation**: SDK network timeouts and API errors are isolated and never crash the host process.
- 🔄 **Automatic Retries with Backoff**: Automatically handles transient 5xx server errors with jittered backoff.
- 📦 **Bounded Memory Buffering**: Capped in-memory breadcrumb and event buffer preventing memory leaks.
- 🛡️ **Express Integration**: Native `requestHandler()` and `errorHandler()` middlewares.
- ⚡ **Graceful Flush**: Supports `flush(timeoutMs)` for serverless environments and clean container shutdowns.

## Installation
```bash
npm install @tracepilot/sdk
# or
pnpm add @tracepilot/sdk
# or
yarn add @tracepilot/sdk
```

## Basic Usage
```typescript
import { init, captureException, captureMessage } from '@tracepilot/sdk';

init({
  apiKey: process.env.TRACEPILOT_API_KEY,
  serviceName: 'checkout-service',
  environment: 'production'
});

try {
  // Application code
} catch (err) {
  captureException(err, {
    tags: { tenantId: 'tenant-45' },
    level: 'error'
  });
}
```

## Express Middleware
```typescript
import express from 'express';
import { init, requestHandler, errorHandler } from '@tracepilot/sdk';

const app = express();
init({ serviceName: 'api-gateway' });

app.use(requestHandler());

// Routes...

app.use(errorHandler());
```
