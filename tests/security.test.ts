import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { protectApi } from '../src/middleware/security.middleware.js';
import { cookieManager } from '../src/adapters/cookie-manager.js';
import { cacheService } from '../src/services/cache.service.js';

const upstream = vi.hoisted(() => ({ get: vi.fn(), getRaw: vi.fn(), login: vi.fn(), logout: vi.fn() }));
vi.mock('../src/adapters/svuis-client.js', () => ({ svuisClient: upstream }));
import authRoutes from '../src/routes/auth.routes.js';
import accountRoutes from '../src/routes/account.routes.js';
import studentRoutes from '../src/routes/student.routes.js';

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', protectApi);
  app.use('/api/auth', authRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/student', studentRoutes);
  server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(() => {
  vi.clearAllMocks();
  cacheService.flush();
  cookieManager.set('security-test', 'PHPSESSID=synthetic');
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  cookieManager.delete('security-test');
});

describe('security controls', () => {
  it('blocks cross-origin writes and disables caching', async () => {
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: 'https://evil.example' } });
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns the session only as an HttpOnly cookie', async () => {
    upstream.login.mockResolvedValue({ success: true, profileHtml: '<div>Student ID: <span>999001</span> Login Name: <span>test_student</span> Student Name: <span>Example Student</span></div><table><tr><td class="tdhead_left_colored">First Name</td><td>Example</td></tr></table>' });
    const response = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify({ username: 'test_student', password: 'synthetic' }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect((await response.json()).data.sessionId).toBeUndefined();
  });

  it('does not retrieve another student photo', async () => {
    upstream.get.mockResolvedValue({ text: '<div>Student ID: <span>999001</span> Login Name: <span>test_student</span> Student Name: <span>Example Student</span></div><table><tr><td class="tdhead_left_colored">First Name</td><td>Example</td></tr></table>' });
    const response = await fetch(`${base}/api/student/photo?std=999002`, { headers: { Cookie: 'svuis_sid=security-test' } });
    expect(response.status).toBe(403);
    expect(upstream.getRaw).not.toHaveBeenCalled();
  });

  it('disables unverified password changes', async () => {
    const response = await fetch(`${base}/api/account/change-password`, { method: 'POST', headers: { Cookie: 'svuis_sid=security-test' } });
    expect(response.status).toBe(501);
  });

  it('removes session cache on logout', async () => {
    await cacheService.getOrFetch('profile:security-test', async () => 'private', 300);
    cookieManager.delete('security-test');
    expect(cacheService.size()).toBe(0);
  });
});
