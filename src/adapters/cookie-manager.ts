import { CONFIG } from '../config.js';
import { cacheService } from '../services/cache.service.js';

interface SessionData {
  cookies: string;
  createdAt: number;
}

const sessions = new Map<string, SessionData>();

export const cookieManager = {
  get(sessionId: string): string | null {
    const data = sessions.get(sessionId);
    if (!data) return null;
    if (Date.now() - data.createdAt > CONFIG.session.ttlMs) {
      sessions.delete(sessionId);
      cacheService.invalidateSession(sessionId);
      return null;
    }
    return data.cookies;
  },

  set(sessionId: string, cookies: string): void {
    sessions.set(sessionId, { cookies, createdAt: sessions.get(sessionId)?.createdAt ?? Date.now() });
  },

  delete(sessionId: string): void {
    sessions.delete(sessionId);
    cacheService.invalidateSession(sessionId);
  },

  cleanup(): void {
    const now = Date.now();
    for (const [id, data] of sessions) {
      if (now - data.createdAt > CONFIG.session.ttlMs) {
        sessions.delete(id);
        cacheService.invalidateSession(id);
      }
    }
  },

  count(): number {
    return sessions.size;
  },
};
