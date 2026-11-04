import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { TutorEntry, TutorGroup, TutorOptions } from '../types/index.js';

function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSelectOptions($: cheerio.CheerioAPI, selectName: string): { value: string; label: string }[] {
  const map = new Map<string, string>();
  $(`select[name="${selectName}"] option`).each((_, opt) => {
    const value = cleanText($(opt).attr('value') || '');
    const label = cleanText($(opt).text());
    if (value && label && value !== '') {
      if (!map.has(value) || label.length < (map.get(value) || '').length) {
        map.set(value, label);
      }
    }
  });
  return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
}

export function parseTutorOptions(html: string): TutorOptions {
  try {
    const $ = cheerio.load(html);
    const programs = parseSelectOptions($, 'pid');
    const courses = parseSelectOptions($, 'course');
    const terms = parseSelectOptions($, 'term');

    if (programs.length === 0 && courses.length === 0 && terms.length === 0) {
      throw new SvuisParseError('No tutor select options found', 'tutor_reports.php', html.slice(0, 500));
    }

    return { programs, courses, terms };
  } catch (err: any) {
    throw new SvuisParseError(
      `Failed to parse tutor options: ${err.message}`,
      'tutor_reports.php',
      html.slice(0, 500)
    );
  }
}

function parseEntriesFromTable(table: cheerio.Cheerio<any>, $: cheerio.CheerioAPI, groupLabel: string): TutorEntry[] {
  const entries: TutorEntry[] = [];

  $(table).find('tr').each((_, row) => {
    const courseNameCell = $(row).children('td.tdpadding_l_p').first();
    const colspanCell = $(row).children('td[colspan]').first();

    if (!courseNameCell.length || !colspanCell.length) return;

    const courseName = cleanText(courseNameCell.text());
    if (!courseName) return;

    const nestedTable = colspanCell.children('table');
    if (!nestedTable.length) return;

    nestedTable.find('tr').each((__, subRow) => {
      const cells = $(subRow).find('td.tdpadding_l_p');
      if (cells.length >= 4) {
        const className = cleanText(cells.eq(0).text());
        const tutor = cleanText(cells.eq(1).text());
        const percent = cleanText(cells.eq(2).text());
        const term = cleanText(cells.eq(3).text());
        if (className && tutor) {
          entries.push({ course: courseName, class: className, tutor, percent, term, group: groupLabel });
        }
      }
    });
  });

  return entries;
}

export function parseTutorReport(htmlText: string): TutorGroup[] {
  try {
    const html = `<div>${htmlText}</div>`;
    const $ = cheerio.load(html);
    const groups: TutorGroup[] = [];

    $('body > div').children('table').each((_, table) => {
      const headerCells = $(table).find('tr').first().children('td.tdhead_left_colored');
      const groupLabel = headerCells.length >= 2 ? cleanText(headerCells.eq(1).text()) : '';
      if (!groupLabel) return;

      const entries = parseEntriesFromTable($(table), $, groupLabel);
      if (entries.length > 0) {
        groups.push({ group: groupLabel, entries });
      }
    });

    return groups;
  } catch (err: any) {
    throw new SvuisParseError(
      `Failed to parse tutor report: ${err.message}`,
      'tutor_report.php',
      htmlText.slice(0, 500)
    );
  }
}
