# TracePilot — Enterprise AI Reliability & Observability Platform

TracePilot unifies real-time incident diagnosis, distributed tracing, AI-driven root-cause investigation (RAG), and synthetic website auditing into a high-performance observability platform.

---

## 🏛️ System Architecture

```text
                                  ┌─────────────────────────────┐
                                  │   TracePilot Web Dashboard  │
                                  │   (Vite + React + Dark UI)  │
                                  └──────────────┬──────────────┘
                                                 │ HTTP / REST
                                                 ▼
┌──────────────────────┐         ┌───────────────────────────────┐         ┌──────────────────────┐
│  Host Applications   │  HTTP   │      TracePilot API Server    │  Vector │   Qdrant Vector DB   │
│  (@tracepilot/sdk)   ├────────►│     (Express + TypeScript)    ├────────►│  (1024-dim Embeddings│
└──────────────────────┘         └───────┬───────────────┬───────┘         └──────────────────────┘
                                         │               │
                                         │ SQL           │ LLM / Embed
                                         ▼               ▼
                                  ┌──────────────┐┌──────────────────────┐
                                  │  PostgreSQL  ││ OpenRouter / Nemotron│
                                  │ (Prisma ORM) ││ 3.5 Embed 8B / 550B  │
                                  └──────────────┘└──────────────────────┘
```

---

## 🚀 Quick Start (Docker Compose)

Start the entire TracePilot stack (PostgreSQL, Qdrant, Backend API, and Web Dashboard) with a single command:

```bash
# 1. Clone & copy environment template
cp .env.example .env

# 2. Start all services
docker compose up -d

# 3. Access applications
# Web Dashboard: http://localhost:5173
# Backend API:   http://localhost:4000
# Health Check:  http://localhost:4000/health
# Qdrant Vector: http://localhost:6333/dashboard
```

---

## 💻 Local Development Setup

### Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v15+ (or uses in-memory / Docker)
- **Qdrant**: v1.11+ (or uses in-memory mock fallback)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env` and verify key configurations:
```bash
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tracepilot?schema=public"
OPENROUTER_MODEL="nvidia/nemotron-3-ultra-550b-a55b:free"
OPENROUTER_EMBEDDING_MODEL="nvidia/nemotron-3.5-embed-8b:free"
EMBEDDING_DIMENSIONS=1024
```

### Step 3: Generate Prisma Client & Migrate Database
```bash
npm --prefix apps/api run build
```

### Step 4: Run Services
```bash
# In Terminal 1: Backend API
npm --prefix apps/api run dev

# In Terminal 2: Web Dashboard
npm --prefix apps/web run dev

# In Terminal 3: Run Demo App scenario
npm --prefix demo start
```

---

## 🧪 Testing & Verification

Run tests across all workspaces:
```bash
# Core API Suite (78 tests)
npm --prefix apps/api test

# SDK Client Suite (11 tests)
npm --prefix packages/sdk test

# Demo App End-to-End Suite (4 tests)
npm --prefix demo test
```

---

## 📦 SDK Installation & Usage

Install the `@tracepilot/sdk` into your Node.js or Express service:

```bash
npm install @tracepilot/sdk
```

Initialize TracePilot at your application entrypoint:

```typescript
import { init, captureException, requestHandler, errorHandler } from '@tracepilot/sdk';
import express from 'express';

const app = express();

init({
  apiKey: process.env.TRACEPILOT_API_KEY,
  serviceName: 'order-service',
  environment: 'production'
});

// Capture incoming request context
app.use(requestHandler());

app.get('/api/orders', (req, res) => {
  try {
    // Application business logic
  } catch (err) {
    captureException(err, { tags: { endpoint: '/api/orders' } });
    res.status(500).json({ error: 'Internal Error' });
  }
});

// Automatic uncaught exception handler
app.use(errorHandler());
```

---

## 🛡️ Security & Tenant Isolation
- **Multi-Tenant Scoping**: All incident, trace, and setting records are strictly bound to `projectId` and `ownerId`. Cross-tenant queries return `403 Forbidden`.
- **Credential Redaction**: Incoming trace span attributes matching `password`, `token`, `secret`, `authorization`, or `cookie` are automatically redacted to `[REDACTED]`.
- **Enumeration Resistance**: Auth endpoints (`/api/v1/auth/forgot-password`) return identical responses regardless of email existence to prevent user enumeration.

---

## 🔧 Troubleshooting

| Issue | Resolution |
|---|---|
| `Qdrant connection refused` | Verify Qdrant is running on port 6333 (`curl http://localhost:6333/healthz`). System falls back gracefully to in-memory cosine search if offline. |
| `Prisma Client not generated` | Run `npm --prefix apps/api run build` to regenerate the Prisma client for your local OS. |
| `OpenRouter rate limit / 429` | TracePilot automatically applies exponential backoff with jitter and degrades gracefully to cached local RAG evidence. |
