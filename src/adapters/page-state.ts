import * as cheerio from 'cheerio';
import { SvuisAuthError } from '../errors/index.js';

export function isLoginPage(html: string): boolean {
  const $ = cheerio.load(html);
  return $('input[name="user_name"]').length > 0 && $('input[name="user_pass"]').length > 0;
}

export function assertAuthenticatedPage(html: string): void {
  if (isLoginPage(html)) throw new SvuisAuthError('SVUIS session expired', 'SESSION_EXPIRED');
}
