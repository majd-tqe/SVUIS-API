import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SvuisAuthError, SvuisNetworkError } from '../src/errors/index.js';
import { errorHandler } from '../src/middleware/error.middleware.js';
import { cookieManager } from '../src/adapters/cookie-manager.js';
import { cacheService } from '../src/services/cache.service.js';

const upstream = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), isReachable: vi.fn() }));
vi.mock('../src/adapters/svuis-client.js', () => ({ svuisClient: upstream }));
import studiesRoutes from '../src/routes/studies.routes.js';
import classesRoutes from '../src/routes/classes.routes.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use('/studies', studiesRoutes);
  app.use('/classes', classesRoutes);
  app.use(errorHandler);
  server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  upstream.get.mockReset(); upstream.post.mockReset(); cacheService.flush();
  cookieManager.set('route-test', 'PHPSESSID=synthetic');
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  cookieManager.delete('route-test');
});
const get = (path: string) => fetch(`${base}${path}`, { headers: { Cookie: 'svuis_sid=route-test' } });

describe('route contracts and error propagation', () => {
  it('sends the exam form identity and retains filter context when the report is empty', async () => {
    upstream.get.mockResolvedValue({ text: fixture('exams-form.html'), status: 200 });
    upstream.post.mockResolvedValue({ text: fixture('exams-empty.json'), status: 200 });
    const response = await get('/studies/exams?program=53&term=49');
    expect(response.status).toBe(200);
    expect(upstream.post).toHaveBeenCalledWith('route-test', 'exam_calendar_student_validation.php', { Program: '53', Term: '49', StudentID: '999001', StudentTelecenter: '1' });
    expect((await response.json()).data).toEqual({ program: 53, term: 49, exams: [] });
  });

  it('rejects unavailable exam filters before submitting a report', async () => {
    upstream.get.mockResolvedValue({ text: fixture('exams-form.html'), status: 200 });
    expect((await get('/studies/exams?program=999&term=49')).status).toBe(400);
    expect(upstream.post).not.toHaveBeenCalled();
  });

  it('preserves auth, network and parser error status codes', async () => {
    upstream.get.mockRejectedValueOnce(new SvuisAuthError('Expired', 'SESSION_EXPIRED'));
    expect((await get('/classes')).status).toBe(401);
    upstream.get.mockRejectedValueOnce(new SvuisNetworkError('Offline'));
    expect((await get('/classes')).status).toBe(503);
    upstream.get.mockResolvedValueOnce({ text: '<p>Unexpected page</p>', status: 200 });
    expect((await get('/classes')).status).toBe(502);
  });

  it('retains the original fetch time in cached API responses', async () => {
    upstream.get.mockResolvedValue({ text: fixture('classes.html'), status: 200 });
    const first = await (await get('/classes')).json();
    const second = await (await get('/classes')).json();
    expect(first.meta.cached).toBe(false);
    expect(second.meta.cached).toBe(true);
    expect(second.meta.fetchedAt).toBe(first.meta.fetchedAt);
    expect(upstream.get).toHaveBeenCalledTimes(1);
  });

  it('reports an upstream outage and caches the real probe result with its timestamp', async () => {
    const { getUpstreamHealth } = await import('../src/services/health.service.js');
    upstream.isReachable.mockResolvedValue(false);
    const first = await getUpstreamHealth();
    const second = await getUpstreamHealth();
    expect(first.reachable).toBe(false);
    expect(second.checkedAt).toBe(first.checkedAt);
    expect(upstream.isReachable).toHaveBeenCalledTimes(1);
  });
});
