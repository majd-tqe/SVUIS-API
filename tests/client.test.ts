import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import iconv from 'iconv-lite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { decode, encodeForm } from '../src/adapters/encoding.js';

const state = vi.hoisted(() => ({ base: '', timeout: 200, loginAllowed: false, profileOffline: false, actions: [] as string[] }));
vi.mock('../src/config.js', () => ({ CONFIG: {
  get svuisBase() { return state.base; },
  get upstreamTimeoutMs() { return state.timeout; },
  session: { ttlMs: 60_000, cookieName: 'svuis_sid' },
} }));

let server: Server;
let client: typeof import('../src/adapters/svuis-client.js').svuisClient;
let cookies: typeof import('../src/adapters/cookie-manager.js').cookieManager;
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

beforeAll(async () => {
  server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const path = new URL(req.url!, 'http://localhost').pathname;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (path.endsWith('/cookies')) {
      res.setHeader('Set-Cookie', ['PHPSESSID=test-session; Path=/', 'lang=en; Path=/']);
      return res.end('ok');
    }
    if (path.endsWith('/echo')) return res.end(`${req.method}|${body}|${req.headers.cookie || ''}`);
    if (/\/r(303|307)$/.test(path)) {
      res.writeHead(Number(path.slice(-3)), { Location: 'echo' });
      return res.end();
    }
    if (path.endsWith('/external')) { res.writeHead(302, { Location: 'http://example.invalid/' }); return res.end(); }
    if (path.endsWith('/broken')) { res.statusCode = 500; return res.end('failure'); }
    if (path.endsWith('/slow')) return; // No response: client must time out.
    if (path.endsWith('/course_time_tutor.php')) return res.end('<select name="Program"><option value="53">TEST</option></select><select name="Term"><option value="49">F24</option></select><select name="SessionDay"><option value="1">Saturday</option></select>');
    if (path.endsWith('/course_time_tutor_ajax.php')) {
      const act = new URLSearchParams(body).get('act')!;
      state.actions.push(act);
      if (act === 'course') return res.end('<option value="-1">Select</option><option value="1380">CSC101</option>');
      if (act === 'tutor') return res.end('<option value="-1">Select</option><option value="2426">Example Tutor</option>');
      return res.end(fixture('schedule.html'));
    }
    if (path.endsWith('/getOTP.php')) return res.end(new URLSearchParams(body).get('user') === 'otp_student' ? '1' : '0');
    if (path.endsWith('/login.php')) {
      state.loginAllowed = new URLSearchParams(body).get('user_name') === 'test_student';
      res.setHeader('Set-Cookie', 'PHPSESSID=test-session; Path=/');
      return res.end(state.loginAllowed ? '<a href="std_profileP.php">Profile</a>' : fixture('login.html'));
    }
    if (path.endsWith('/std_profileP.php')) {
      if (state.profileOffline) { res.statusCode = 503; return res.end('Offline'); }
      return res.end(state.loginAllowed ? fixture('profile.html') : fixture('login.html'));
    }
    return res.end(fixture('login.html'));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  state.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/SVUIS`;
  client = (await import('../src/adapters/svuis-client.js')).svuisClient;
  cookies = (await import('../src/adapters/cookie-manager.js')).cookieManager;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('real HTTP transport against a local portal simulator', () => {
  it('retains every Set-Cookie header and sends them on subsequent requests', async () => {
    await client.get('cookie-test', 'cookies');
    const response = await client.get('cookie-test', 'echo');
    expect(response.text).toContain('PHPSESSID=test-session; lang=en');
  });

  it('switches POST to GET on 303 and retains the encoded POST on 307', async () => {
    expect((await client.post('redirect', 'r303', { q: 'test' })).text).toMatch(/^GET\|\|/);
    expect((await client.post('redirect', 'r307', { q: 'test' })).text).toContain(`POST|${encodeForm({ q: 'test' })}|`);
  });

  it('rejects cross-origin redirects and HTTP failures', async () => {
    await expect(client.get('errors', 'external')).rejects.toThrow('cross-origin');
    await expect(client.get('errors', 'broken')).rejects.toThrow('HTTP 500');
  });

  it('detects HTTP-200 login pages and rejects public menu links as session evidence', async () => {
    state.loginAllowed = false;
    await expect(client.get('errors', 'index.php')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    cookies.set('expired', 'PHPSESSID=expired');
    expect(await client.isLoggedIn('expired')).toBe(false);
  });

  it('requires a matching protected student profile after login', async () => {
    expect((await client.login('valid-login', 'test_student', 'synthetic-password')).success).toBe(true);
    expect(await client.isLoggedIn('valid-login')).toBe(true);
    expect((await client.login('bad-login', 'invalid_student', 'synthetic-password')).success).toBe(false);
  });

  it('checks OTP before attempting login', async () => {
    await expect(client.login('otp', 'otp_student', 'synthetic-password')).rejects.toMatchObject({ code: 'OTP_REQUIRED' });
  });

  it('does not report a network outage as an expired session', async () => {
    cookies.set('offline-status', 'PHPSESSID=synthetic');
    state.profileOffline = true;
    try { await expect(client.isLoggedIn('offline-status')).rejects.toThrow('HTTP 503'); }
    finally { state.profileOffline = false; }
  });

  it('probes anonymous upstream reachability without retaining a student session', async () => {
    const before = cookies.count();
    expect(await client.isReachable()).toBe(true);
    expect(cookies.count()).toBe(before);
  });

  it('removes temporary sessions after failed authentication', async () => {
    const { authService } = await import('../src/services/auth.service.js');
    const before = cookies.count();
    await expect(authService.login('invalid_student', 'synthetic-password')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(cookies.count()).toBe(before);
  });

  it('bounds requests with a timeout', async () => {
    await expect(client.get('slow', 'slow')).rejects.toThrow('SVUIS request failed');
  });

  it('replays the observed dependent schedule actions and rejects unavailable filters', async () => {
    const { getClassSchedule, getScheduleOptions } = await import('../src/services/schedule.service.js');
    const filters = { program: '53', term: '49', course: '1380' };
    const options = await getScheduleOptions('schedule', { ...filters, day: '1' });
    expect(options.tutors[0].value).toBe('2426');
    for (const [extra, action] of [[{}, 'resultcourse'], [{ day: '1' }, 'resultsessionday'], [{ day: '1', tutor: '2426' }, 'finalresult']] as const) {
      const rows = await getClassSchedule('schedule', { ...filters, ...extra });
      expect(rows).toHaveLength(2);
      expect(state.actions.at(-1)).toBe(action);
    }
    await expect(getClassSchedule('schedule', { ...filters, program: '999' })).rejects.toThrow('Unavailable');
    await expect(getClassSchedule('schedule', { ...filters, tutor: '2426' })).rejects.toThrow('day is required');
  });
});

describe('encoding', () => {
  it('reads UTF-8 HTML and legacy win1256 using their declared encodings', () => {
    const utf = Buffer.from('<meta charset="UTF-8">مرحبا');
    expect(decode(utf, 'text/html')).toContain('مرحبا');
    const legacy = iconv.encode('<meta charset="windows-1256">مرحبا', 'win1256');
    expect(decode(legacy, 'text/html')).toContain('مرحبا');
    expect(decode(Buffer.from('{"message":"مرحبا"}'), 'application/json')).toContain('مرحبا');
  });

  it('encodes Arabic form fields as Windows-1256 bytes', () => {
    const encoded = encodeForm({ q: 'مرحبا' });
    const value = encoded.split('=')[1];
    const bytes = Buffer.from(value.split('%').filter(Boolean).map(hex => Number.parseInt(hex, 16)));
    expect(iconv.decode(bytes, 'win1256')).toBe('مرحبا');
  });
});
