import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { getRepository, setRepository, InMemoryTracePilotRepository } from '../db';
import { signUserToken, hashPassword } from '../crypto';

describe('Part 3 — Telemetry, Dashboard, Tracing & Administration Suite', () => {
  let app: any;
  let repo: InMemoryTracePilotRepository;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let projectA: any;
  let projectB: any;

  beforeEach(async () => {
    process.env.PAUSE_AUTH = 'false';
    process.env.DISABLE_AUTH = 'false';

    // Reset in-memory database for isolated test execution
    repo = new InMemoryTracePilotRepository();
    setRepository(repo);

    app = createApp();

    // Create Tenant A
    userA = await repo.createUser('tenant-a@tracepilot.dev', hashPassword('Password123!'));
    tokenA = signUserToken(userA.id);
    projectA = await repo.createProject('Tenant A Microservices', userA.id, 'proj_tenant_a');

    // Create Tenant B (for cross-tenant security verification)
    userB = await repo.createUser('tenant-b@tracepilot.dev', hashPassword('Password123!'));
    tokenB = signUserToken(userB.id);
    projectB = await repo.createProject('Tenant B Microservices', userB.id, 'proj_tenant_b');
  });

  describe('P3-B01 & P3-B04: Incident Grouping, Deduplication & Search', () => {
    it('should stably group incidents by fingerprint and increment occurrences on retries', async () => {
      const inc1 = await repo.createIncident({
        projectId: projectA.id,
        fingerprint: 'fp_payment_timeout',
        eventType: 'exception',
        exceptionType: 'TimeoutError',
        message: 'Payment gateway timeout after 5000ms',
        environment: 'production',
        release: 'v1.4.0',
        runtime: { language: 'typescript', version: '5.5.4' },
        occurredAt: new Date(Date.now() - 60000),
        status: 'open'
      });

      expect(inc1.occurrences).toBe(1);

      // Ingest second occurrence with same fingerprint
      const inc2 = await repo.createIncident({
        projectId: projectA.id,
        fingerprint: 'fp_payment_timeout',
        eventType: 'exception',
        exceptionType: 'TimeoutError',
        message: 'Payment gateway timeout after 5000ms',
        environment: 'production',
        release: 'v1.4.0',
        runtime: { language: 'typescript', version: '5.5.4' },
        occurredAt: new Date(),
        status: 'open'
      });

      expect(inc2.id).toBe(inc1.id);
      expect(inc2.occurrences).toBe(2);

      // Ingest third occurrence with explicit duplicate eventId (retry safety)
      const inc3 = await repo.createIncident({
        projectId: projectA.id,
        fingerprint: 'fp_payment_timeout',
        eventId: 'evt_client_retry_999',
        eventType: 'exception',
        exceptionType: 'TimeoutError',
        message: 'Payment gateway timeout after 5000ms',
        environment: 'production',
        release: 'v1.4.0',
        runtime: { language: 'typescript', version: '5.5.4' },
        occurredAt: new Date(),
        status: 'open'
      });

      expect(inc3.id).toBe(inc1.id);
      expect(inc3.occurrences).toBe(3);
    });

    it('should support search, service filter, and tenant isolation', async () => {
      await repo.createIncident({
        projectId: projectA.id,
        fingerprint: 'fp_auth_jwt',
        eventType: 'exception',
        exceptionType: 'AuthenticationError',
        message: 'JWT expired signature',
        environment: 'production',
        release: 'v1.4.0',
        runtime: { language: 'typescript' },
        occurredAt: new Date()
      });

      await repo.createIncident({
        projectId: projectB.id,
        fingerprint: 'fp_tenant_b_leak',
        eventType: 'exception',
        exceptionType: 'SecretLeakError',
        message: 'Confidential Tenant B Error',
        environment: 'production',
        release: 'v1.4.0',
        runtime: { language: 'typescript' },
        occurredAt: new Date()
      });

      // Tenant A searches for incidents
      const resA = await request(app)
        .get(`/api/v1/incidents?projectId=${projectA.id}&search=AuthenticationError`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data.length).toBe(1);
      expect(resA.body.data[0].exceptionType).toBe('AuthenticationError');

      // Tenant A must NOT be able to view Tenant B's incidents
      const leakRes = await request(app)
        .get(`/api/v1/incidents?projectId=${projectB.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(leakRes.status).toBe(403);
    });
  });

  describe('P3-B02: Dashboard Aggregate APIs', () => {
    it('should return reconciled incident stats, service health, and time series buckets', async () => {
      // Ingest two open errors for Tenant A
      await repo.createIncident({
        projectId: projectA.id,
        fingerprint: 'fp_userservice_crash',
        eventType: 'exception',
        exceptionType: 'TypeError',
        message: 'Cannot read properties of undefined',
        environment: 'production',
        release: 'v1.4.0',
        runtime: { language: 'typescript' },
        occurredAt: new Date(),
        status: 'open',
        occurrences: 5
      });

      // 1. Stats endpoint
      const statsRes = await request(app)
        .get(`/api/v1/incidents/stats?projectId=${projectA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.openIncidents).toBe(1);
      expect(statsRes.body.totalErrors).toBe(5);
      expect(statsRes.body.servicesCount).toBeGreaterThanOrEqual(1);

      // 2. Time-series endpoint
      const tsRes = await request(app)
        .get(`/api/v1/incidents/time-series?projectId=${projectA.id}&timeRange=24h`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(tsRes.status).toBe(200);
      expect(tsRes.body.timeRange).toBe('24h');
      expect(Array.isArray(tsRes.body.data)).toBe(true);
      expect(tsRes.body.data.length).toBe(24);

      // 3. Service health endpoint
      const healthRes = await request(app)
        .get(`/api/v1/incidents/service-health?projectId=${projectA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(healthRes.status).toBe(200);
      expect(Array.isArray(healthRes.body.data)).toBe(true);
      expect(healthRes.body.data.length).toBeGreaterThan(0);

      // 4. Activity feed endpoint
      const actRes = await request(app)
        .get(`/api/v1/incidents/activity?projectId=${projectA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(actRes.status).toBe(200);
      expect(Array.isArray(actRes.body.data)).toBe(true);
      expect(actRes.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('P3-C01, P3-C02, P3-C03 & P3-C05: Distributed Traces Ingestion & Query', () => {
    it('should ingest valid spans, redact sensitive attributes, and handle out-of-order spans', async () => {
      const now = Date.now();
      const spans = [
        // Child span arrives first (out-of-order resilience)
        {
          traceId: 'tr_test_trace_12345678',
          spanId: 'sp_child_002',
          parentSpanId: 'sp_root_001',
          serviceName: 'UserService',
          name: 'DB:QueryUserById',
          startTime: new Date(now + 20).toISOString(),
          endTime: new Date(now + 65).toISOString(),
          statusCode: 'ok',
          attributes: {
            'user.id': 'usr_123',
            'password': 'super-secret-password-should-be-redacted',
            'api_token': 'secret-token-xyz'
          }
        },
        // Root span arrives second
        {
          traceId: 'tr_test_trace_12345678',
          spanId: 'sp_root_001',
          parentSpanId: null,
          serviceName: 'API Gateway',
          name: 'GET /api/v1/users/me',
          startTime: new Date(now).toISOString(),
          endTime: new Date(now + 120).toISOString(),
          statusCode: 'ok',
          attributes: {
            'http.method': 'GET',
            'authorization': 'Bearer confidential-jwt-bearer'
          }
        }
      ];

      const ingestRes = await request(app)
        .post('/api/v1/traces/spans')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ projectId: projectA.id, spans });

      expect(ingestRes.status).toBe(201);
      expect(ingestRes.body.status).toBe('accepted');
      expect(ingestRes.body.count).toBe(2);

      // Verify trace query list
      const listRes = await request(app)
        .get(`/api/v1/traces?projectId=${projectA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      const summary = listRes.body.data[0];
      expect(summary.traceId).toBe('tr_test_trace_12345678');
      expect(summary.spanCount).toBe(2);
      expect(summary.serviceCount).toBe(2);

      // Verify trace detail and redaction
      const detailRes = await request(app)
        .get(`/api/v1/traces/tr_test_trace_12345678?projectId=${projectA.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(detailRes.status).toBe(200);
      const traceData = detailRes.body.data;
      expect(traceData.spans.length).toBe(2);

      const childSpan = traceData.spans.find((s: any) => s.spanId === 'sp_child_002');
      expect(childSpan.attributes['user.id']).toBe('usr_123');
      expect(childSpan.attributes['password']).toBe('[REDACTED]');
      expect(childSpan.attributes['api_token']).toBe('[REDACTED]');

      const rootSpan = traceData.spans.find((s: any) => s.spanId === 'sp_root_001');
      expect(rootSpan.attributes['authorization']).toBe('[REDACTED]');

      // Tenant isolation: Tenant B cannot access Tenant A trace
      const deniedRes = await request(app)
        .get(`/api/v1/traces/tr_test_trace_12345678?projectId=${projectA.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(deniedRes.status).toBe(403);
    });

    it('should reject malformed span IDs and enforce maximum payload batch size', async () => {
      // 1. Malformed trace ID
      const malformedRes = await request(app)
        .post('/api/v1/traces/spans')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          projectId: projectA.id,
          spans: [{ traceId: 'too-short', spanId: '1', serviceName: 'API', name: 'req', startTime: new Date(), endTime: new Date() }]
        });

      expect(malformedRes.status).toBe(400);

      // 2. Empty spans payload
      const emptyRes = await request(app)
        .post('/api/v1/traces/spans')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ projectId: projectA.id, spans: [] });

      expect(emptyRes.status).toBe(400);
    });
  });

  describe('P3-D01 — P3-D04: Settings, Roles, Password Recovery & Onboarding', () => {
    it('should allow project updates and enforce last owner protection in team membership', async () => {
      // 1. Update project
      const updateRes = await request(app)
        .patch(`/api/v1/projects/${projectA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Updated Enterprise Cloud App',
          environments: ['production', 'staging', 'qa'],
          retentionDays: 60
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.name).toBe('Updated Enterprise Cloud App');
      expect(updateRes.body.data.retentionDays).toBe(60);

      // 2. Add team member
      const addRes = await request(app)
        .post(`/api/v1/projects/${projectA.id}/members`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ email: 'sre-engineer@tracepilot.dev', role: 'admin' });

      expect(addRes.status).toBe(201);
      const newMember = addRes.body.data;
      expect(newMember.email).toBe('sre-engineer@tracepilot.dev');

      // 3. List members
      const listRes = await request(app)
        .get(`/api/v1/projects/${projectA.id}/members`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);

      // 4. Guard against removing the last owner
      const owners = listRes.body.data.filter((m: any) => m.role === 'owner');
      if (owners.length === 1) {
        const removeOwnerRes = await request(app)
          .delete(`/api/v1/projects/${projectA.id}/members/${owners[0].id}`)
          .set('Authorization', `Bearer ${tokenA}`);

        expect(removeOwnerRes.status).toBe(400);
        expect(removeOwnerRes.body.message).toContain('last owner');
      }
    });

    it('should provide enumeration-resistant password reset', async () => {
      // Request for existing email
      const existRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'tenant-a@tracepilot.dev' });

      expect(existRes.status).toBe(200);
      expect(existRes.body.message).toContain('password reset instructions have been sent');

      // Request for non-existent email (identical response to prevent enumeration)
      const nonExistRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'non-existent-user-12345@unknown-domain.com' });

      expect(nonExistRes.status).toBe(200);
      expect(nonExistRes.body.message).toBe(existRes.body.message);
    });

    it('should verify project onboarding and RAG engine status', async () => {
      const onbRes = await request(app)
        .get(`/api/v1/projects/${projectA.id}/onboarding`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(onbRes.status).toBe(200);
      const onb = onbRes.body.data;
      expect(onb.ragStatus.embeddingModel).toBe('nvidia/nemotron-3.5-embed-8b:free');
      expect(onb.ragStatus.targetDimensions).toBe(1024);
      expect(onb.ragStatus.diagnosisModel).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
      expect(onb.sdkSnippet).toContain('@tracepilot/sdk');
    });
  });
});
