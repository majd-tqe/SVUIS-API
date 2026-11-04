import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { Assessment } from '../types/index.js';

function cleanText(text: string): string {
  return text.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function parseAms(html: string): Assessment[] {
  const $ = cheerio.load(html);
  const assessments: Assessment[] = [];

  const tables = $('table').toArray();
  let targetTable: any = null;
  let headerRowEl: any = null;

  for (const table of tables) {
    const rows = $(table).find('tr').toArray();
    for (const row of rows) {
      const headerCells = $(row).children('td.course_hd, th.course_hd').toArray();
      if (headerCells.length < 2) continue;
      const headerText = headerCells.map(el => cleanText($(el).text()).toLowerCase()).join(' ');
      if (headerText.includes('#') && headerText.includes('assessment')) {
        targetTable = table;
        headerRowEl = row;
        break;
      }
    }
    if (targetTable) break;
  }

  if (!targetTable) {
    throw new SvuisParseError('Could not find assessments table with # and Assessment headers', 'ams.php', html.slice(0, 500));
  }

  const headerCells = $(headerRowEl).children('td.course_hd, th.course_hd').toArray();
  const headerTexts = headerCells.map(c => cleanText($(c).text()).toLowerCase());

  const nameIdx = headerTexts.findIndex(t => t.includes('assessment'));
  const alertIdx = headerTexts.findIndex(t => /alert/i.test(t));
  const startIdx = headerTexts.findIndex(t => /start/i.test(t));
  const endIdx = headerTexts.findIndex(t => /end/i.test(t));
  const statusIdx = headerTexts.findIndex(t => /status/i.test(t));
  const actionIdx = headerTexts.findIndex(t => /action/i.test(t));

  if (nameIdx < 0) {
    throw new SvuisParseError('Could not find Assessment column in AMS table', 'ams.php', html.slice(0, 500));
  }

  $(targetTable).find('tr').each((i, row) => {
    if (row === headerRowEl) return;
    const cells = $(row).children('td').toArray();
    if (cells.length < 6) return;

    const name = cleanText($(cells[nameIdx]).text());
    if (!name) return;

    let alert: string | null = null;
    if (alertIdx >= 0) {
      const alertCell = cells[alertIdx];
      const alertImg = $(alertCell).find('img[title*="alert"], img[alt*="alert"], img[src*="alert"]');
      if (alertImg.length) {
        alert = alertImg.attr('title') || alertImg.attr('alt') || 'alert';
      } else {
        const cellText = cleanText($(alertCell).text());
        if (cellText) alert = cellText;
      }
    }

    const startTime = startIdx >= 0 ? cleanText($(cells[startIdx]).text()) : '';
    const endTime = endIdx >= 0 ? cleanText($(cells[endIdx]).text()) : '';
    const status = statusIdx >= 0 ? cleanText($(cells[statusIdx]).text()) : '';

    let score: number | null = null;
    if (actionIdx >= 0) {
      const scoreRaw = cleanText($(cells[actionIdx]).text());
      const scoreNum = parseFloat(scoreRaw);
      if (!isNaN(scoreNum)) {
        score = scoreNum;
      }
    }

    assessments.push({
      course: name,
      startTime,
      endTime,
      status,
      score,
      alert,
    });
  });

  return assessments;
}
