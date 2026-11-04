import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import { SvuisParseError } from '../errors/index.js';

export const cleanText = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** Rows owned by this table, excluding nested layout and data tables. */
export function ownRows($: cheerio.CheerioAPI, table: AnyNode): Element[] {
  return $(table).find('tr').filter((_, row) => $(row).closest('table')[0] === table).toArray();
}

export function cells($: cheerio.CheerioAPI, row: AnyNode): Element[] {
  return $(row).children('td, th').toArray();
}

export function numberOrNull(text: string): number | null {
  const value = cleanText(text).replace(/,/g, '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export function requiredNumber(text: string, endpoint: string, field: string): number {
  const value = numberOrNull(text);
  if (value === null) throw new SvuisParseError(`Missing or invalid ${field}`, endpoint);
  return value;
}

export function findHeader($: cheerio.CheerioAPI, required: string[]) {
  for (const table of $('table').toArray()) {
    for (const row of ownRows($, table)) {
      const headings = cells($, row).map(c => cleanText($(c).text()).toLowerCase());
      if (required.every(label => headings.includes(label.toLowerCase()))) {
        return { table, row, headings, rows: ownRows($, table) };
      }
    }
  }
  return null;
}
