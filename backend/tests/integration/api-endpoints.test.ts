import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Mock Redis and BullMQ to run isolated integration tests without requiring live external services
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue('OK'),
      status: 'ready',
    })),
  };
});

vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ id: 'mock-bull-123' }),
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 10,
        failed: 1,
        delayed: 0,
        paused: 0,
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    QueueEvents: vi.fn().mockImplementation(() => ({
      close: vi.fn().mockResolvedValue(undefined),
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    UnrecoverableError: class extends Error {},
  };
});

import { createServer } from '../../src/api/server';

describe('API Endpoints (Supertest)', () => {
  const app = createServer();

  describe('Health & Observability', () => {
    it('GET /health returns 200 and UP status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.uptime).toBeDefined();
    });

    it('GET /metrics returns Prometheus metric format', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('queueflow_');
    });
  });

  describe('Validation & Error Handling', () => {
    it('POST /api/jobs rejects invalid payload with 422', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({
          type: 'INVALID_TYPE',
          payload: {},
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/jobs rejects malformed email simulation job', async () => {
      const res = await request(app)
        .post('/api/jobs')
        .send({
          type: 'EMAIL_SIMULATION',
          payload: {
            recipient: 'invalid-email-format',
            subject: 'Test',
          },
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('GET /non-existent-route returns 404', async () => {
      const res = await request(app).get('/api/does-not-exist');
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Admin Authorization', () => {
    it('GET /api/admin/jobs/failed denies access without admin key', async () => {
      const res = await request(app).get('/api/admin/jobs/failed');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UnauthorizedError');
    });

    it('GET /api/admin/jobs/failed denies access with incorrect key', async () => {
      const res = await request(app)
        .get('/api/admin/jobs/failed')
        .set('x-admin-key', 'wrong-secret-key');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UnauthorizedError');
    });
  });
});
