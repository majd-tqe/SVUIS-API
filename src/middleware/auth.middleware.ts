import type { Request, Response, NextFunction } from 'express';
import { cookieManager } from '../adapters/cookie-manager.js';
import { SvuisAuthError } from '../errors/index.js';
import { CONFIG } from '../config.js';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      if (key) cookies[key] = val;
    }
  }
  return cookies;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[CONFIG.session.cookieName];
  if (!sessionId) {
    return next(new SvuisAuthError('No session cookie found', 'SESSION_EXPIRED'));
  }

  const stored = cookieManager.get(sessionId);
  if (!stored) {
    return next(new SvuisAuthError('Session expired or invalid', 'SESSION_EXPIRED'));
  }

  (req as any).sessionId = sessionId;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies[CONFIG.session.cookieName];
  if (sessionId) {
    const stored = cookieManager.get(sessionId);
    if (stored) {
      (req as any).sessionId = sessionId;
    }
  }
  next();
}
