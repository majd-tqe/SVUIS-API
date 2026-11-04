import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { Payment, EPaymentStatus } from '../types/index.js';
import { cells as rowCells, cleanText, findHeader, requiredNumber } from './table.js';

export function parsePayments(html: string, baseUrl: string): Payment[] {
  const $ = cheerio.load(html);
  const payments: Payment[] = [];
  const seen = new Set<string>();

  const header = findHeader($, ['payment ID', 'payment description', 'total Amount', 'Currency']);
  if (!header) {
    throw new SvuisParseError('Could not find payments table with "payment id" header', 'student_payments.php', html.slice(0, 500));
  }

  $(header.rows.slice(header.rows.indexOf(header.row) + 1)).each((_ri, row) => {
    const cells = rowCells($, row);
    if (!cells.some(c => $(c).hasClass('tlp'))) return;
    if (cells.length !== header.headings.length) throw new SvuisParseError('Payment row does not match headers', 'student_payments.php');

    const vals = cells.map(c => cleanText($(c).text()));
    const value = (label: string) => vals[header.headings.indexOf(label.toLowerCase())] || '';
    const id = value('payment ID');

    if (!id || seen.has(id)) return;
    seen.add(id);

    const linkEl = $(cells[header.headings.indexOf('link')]).find('a');
    const link = linkEl.length ? linkEl.attr('href') || '' : '';

    const payment: Payment = {
      id,
      description: value('payment description'),
      status: value('Status'), term: value('Term'),
      date: normalizeDate(value('validation Date')),
      validator: value('validated By'),
      amount: requiredNumber(value('total Amount'), 'student_payments.php', 'amount'),
      currency: value('Currency'),
      specialAmount: requiredNumber(value('special Amount'), 'student_payments.php', 'special amount'),
      program: value('program'), forDelete: value('For Delete'),
      processStatus: value('process Status'),
      link: link ? new URL(link, `${baseUrl.replace(/\/$/, '')}/`).href : '',
    };
    payments.push(payment);
  });

  return payments;
}

function normalizeDate(dateStr: string): string {
  const cleaned = dateStr.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})(?: (\d{2}:\d{2}:\d{2}))?$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}${match[4] ? `T${match[4]}` : ''}`;
  return cleaned;
}

export function parseEPaymentStatus(html: string): EPaymentStatus {
  const $ = cheerio.load(html);
  const body = $('body').text().trim().toLowerCase();
  const hasDue = body.includes('due') || body.includes('مستحق') || body.includes('required');
  const message = $('.message, .alert, .error').first().text().trim() || (hasDue ? 'Payment is due' : 'No dues');
  return { hasDue, message };
}
