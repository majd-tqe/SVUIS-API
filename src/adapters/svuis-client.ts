import fetch, { Headers as FetchHeaders, type Response } from 'node-fetch';
import { randomUUID } from 'node:crypto';
import { CONFIG } from '../config.js';
import { SvuisAuthError, SvuisNetworkError, SvuisParseError } from '../errors/index.js';
import { cookieManager } from './cookie-manager.js';
import { decode, encodeForm } from './encoding.js';
import { assertAuthenticatedPage, isLoginPage } from './page-state.js';
import { parseProfile } from '../parsers/profile.parser.js';

const BASE = CONFIG.svuisBase;
const MAX_REDIRECTS = 5;

function extractCookies(headers: FetchHeaders): string {
  const cookies = (headers.raw()['set-cookie'] || []).map(value => value.split(';')[0]);
  return cookies.join('; ');
}

function parseCookies(cookieStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of cookieStr.split(';')) {
    const idx = pair.indexOf('=');
    if (idx !== -1) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      if (key) result[key] = val;
    }
  }
  return result;
}

function mergeCookies(existing: string, newCookies: string): string {
  if (!newCookies) return existing;
  const existingMap = parseCookies(existing);
  const newMap = parseCookies(newCookies);
  const merged = { ...existingMap, ...newMap };
  return Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function decodeResponse(buffer: Buffer, headers: FetchHeaders): string {
  return decode(buffer, headers.get('content-type') || '');
}

async function _request(
  sessionId: string,
  method: 'GET' | 'POST',
  endpoint: string,
  body?: Record<string, string>
): Promise<{ buffer: Buffer; status: number; headers: FetchHeaders }> {
  let currentUrl = endpoint.startsWith('http') ? endpoint : `${BASE}/${endpoint.startsWith('/') ? endpoint.slice(1) : endpoint}`;
  let redirectCount = 0;
  let finalStatus = 200;
  let finalBuffer: Buffer | null = null;
  let finalHeaders: FetchHeaders | null = null;
  let currentMethod = method;
  let currentBody = body ? { ...body } : undefined;

  while (redirectCount <= MAX_REDIRECTS) {
    if (new URL(currentUrl).origin !== new URL(BASE).origin) {
      throw new SvuisNetworkError('Unexpected cross-origin SVUIS redirect');
    }
    const stored = cookieManager.get(sessionId) || '';
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    };

    if (stored) {
      headers['Cookie'] = stored;
    }

    const fetchOpts: any = {
      method: currentMethod,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(CONFIG.upstreamTimeoutMs),
    };

    if (currentMethod === 'POST' && currentBody) {
      const formBody = encodeForm(currentBody);
      headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=windows-1256';
      headers['Content-Length'] = String(Buffer.byteLength(formBody, 'utf8'));
      fetchOpts.body = formBody;
    }

    let resp: Response;
    try {
      resp = await fetch(currentUrl, fetchOpts);
    } catch (err: any) {
      throw new SvuisNetworkError(`SVUIS request failed: ${err.message}`, err);
    }

    const newCookies = extractCookies(resp.headers);
    if (newCookies) {
      const existing = cookieManager.get(sessionId) || '';
      const merged = mergeCookies(existing, newCookies);
      cookieManager.set(sessionId, merged);
    }

    const status = resp.status;
    const location = resp.headers.get('location');

    if ((status === 301 || status === 302 || status === 303 || status === 307 || status === 308) && location) {
      await resp.arrayBuffer();
      currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).toString();
      redirectCount++;
      if (status !== 307 && status !== 308) {
        currentMethod = 'GET';
        currentBody = undefined;
      }
      continue;
    }

    finalStatus = status;
    if (status === 401 || status === 403) throw new SvuisAuthError('SVUIS session expired or access denied', 'SESSION_EXPIRED');
    if (status < 200 || status >= 300) throw new SvuisNetworkError(`SVUIS returned HTTP ${status}`);
    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await resp.arrayBuffer();
    } catch (err: any) {
      throw new SvuisNetworkError('Could not read SVUIS response', err);
    }
    finalBuffer = Buffer.from(arrayBuffer);
    finalHeaders = resp.headers;
    break;
  }

  if (!finalBuffer || !finalHeaders) {
    throw new SvuisNetworkError('Max redirects exceeded');
  }

  return { buffer: finalBuffer, status: finalStatus, headers: finalHeaders };
}

export const svuisClient = {
  async isReachable(): Promise<boolean> {
    const probeSession = randomUUID();
    try {
      const response = await _request(probeSession, 'GET', 'index.php');
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    } finally {
      cookieManager.delete(probeSession);
    }
  },

  async get(sessionId: string, endpoint: string): Promise<{ text: string; status: number }> {
    const { buffer, status, headers } = await _request(sessionId, 'GET', endpoint);
    const text = decodeResponse(buffer, headers);
    assertAuthenticatedPage(text);
    return { text, status };
  },

  async post(sessionId: string, endpoint: string, formBody: Record<string, string>): Promise<{ text: string; status: number }> {
    const { buffer, status, headers } = await _request(sessionId, 'POST', endpoint, formBody);
    const text = decodeResponse(buffer, headers);
    assertAuthenticatedPage(text);
    return { text, status };
  },

  async getRaw(sessionId: string, endpoint: string): Promise<{ buffer: Buffer; contentType: string; status: number }> {
    const { buffer, status, headers } = await _request(sessionId, 'GET', endpoint);
    if ((headers.get('content-type') || '').includes('text/html')) assertAuthenticatedPage(decodeResponse(buffer, headers));
    return { buffer, contentType: headers.get('content-type') || 'application/octet-stream', status };
  },

  async login(sessionId: string, username: string, password: string, otp?: string): Promise<{ success: boolean; profileHtml?: string }> {
    if (!otp) {
      const preflight = await _request(sessionId, 'POST', 'search_ajax/getOTP.php', { user: username });
      const required = decodeResponse(preflight.buffer, preflight.headers).trim();
      if (required === '1') throw new SvuisAuthError('OTP code is required', 'OTP_REQUIRED');
      if (required !== '' && required !== '0') throw new SvuisParseError('Unrecognized OTP response', 'search_ajax/getOTP.php');
    }
    const body: Record<string, string> = {
      user_name: username,
      user_pass: password,
      user_otp: otp || '',
      from_page: '/SVUIS/',
    };
    const { buffer, headers } = await _request(sessionId, 'POST', 'login.php', body);
    const text = decodeResponse(buffer, headers);
    if (isLoginPage(text) || /username\s*\/\s*password\s+is\s+incorrect/i.test(text)) return { success: false };
    const profileResponse = await _request(sessionId, 'GET', 'std_profileP.php');
    const profileHtml = decodeResponse(profileResponse.buffer, profileResponse.headers);
    if (isLoginPage(profileHtml)) return { success: false };
    const profile = parseProfile(profileHtml);
    if (profile.username.toLowerCase() !== username.toLowerCase()) return { success: false };
    return { success: true, profileHtml };
  },

  async logout(sessionId: string): Promise<void> {
    try {
      await _request(sessionId, 'GET', 'login.php?act=logout');
    } catch {
      // Ignore errors during logout
    }
    cookieManager.delete(sessionId);
  },

  async isLoggedIn(sessionId: string): Promise<boolean> {
    const stored = cookieManager.get(sessionId);
    if (!stored) return false;
    try {
      const { buffer, headers } = await _request(sessionId, 'GET', 'std_profileP.php');
      const text = decodeResponse(buffer, headers);
      if (isLoginPage(text)) return false;
      const profile = parseProfile(text);
      return profile.id > 0 && profile.username.length > 0;
    } catch (err) {
      if (err instanceof SvuisAuthError) return false;
      throw err;
    }
  },
};
