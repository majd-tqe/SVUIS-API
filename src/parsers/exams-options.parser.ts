import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { ExamOptions } from '../types/index.js';

function parseSelectOptions($: cheerio.CheerioAPI, selectId: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const seen = new Set<string>();

  $(`#${selectId} option, select[name="${selectId}"] option, select[id*="${selectId}"] option`).each((_, el) => {
    const value = $(el).attr('value') || '';
    const label = $(el).text().trim();
    if (value && label && /^\d+$/.test(value)) {
      const key = value;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ value, label });
      } else {
        const existing = options.find(o => o.value === value);
        if (existing && label.length < existing.label.length) {
          existing.label = label;
        }
      }
    }
  });

  return options;
}

export function parseExamOptions(html: string): ExamOptions {
  const $ = cheerio.load(html);

  const programs = parseSelectOptions($, 'Program');
  const terms = parseSelectOptions($, 'Term');

  if (programs.length === 0 && terms.length === 0) {
    throw new SvuisParseError('No exam select options found', 'exam_calendar_student.php', html.slice(0, 500));
  }

  return { programs, terms };
}

/** Hidden identity fields belong to the authenticated upstream form, never client input. */
export function parseExamForm(html: string) {
  const $ = cheerio.load(html);
  const studentId = $('input[name="StudentID"]').attr('value') || '';
  const telecenter = $('input[name="StudentTelecenter"]').attr('value') || '';
  if (!/^\d+$/.test(studentId) || !/^\d+$/.test(telecenter)) {
    throw new SvuisParseError('Missing exam form identity fields', 'exam_calendar_student.php');
  }
  return { ...parseExamOptions(html), studentId, telecenter };
}
