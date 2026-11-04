import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import { cells, cleanText, findHeader } from './table.js';
import type { ClassScheduleEntry, SelectOption } from '../types/index.js';

export function parseScheduleOptions(html: string, selectName?: string): SelectOption[] {
  const $ = cheerio.load(html);
  const options = selectName ? $(`select[name="${selectName}"] option`) : $('option');
  if (selectName && !$(`select[name="${selectName}"]`).length) {
    throw new SvuisParseError(`Missing schedule ${selectName} selector`, 'course_time_tutor.php');
  }
  if (!selectName && !options.length) throw new SvuisParseError('Missing schedule options', 'course_time_tutor_ajax.php');
  const seen = new Set<string>();
  return options.toArray().flatMap(el => {
    const value = $(el).attr('value') || '';
    const label = cleanText($(el).text());
    if (!/^\d+$/.test(value) || !label || seen.has(value)) return [];
    seen.add(value);
    return [{ value, label }];
  });
}

export function parseClassSchedule(html: string): ClassScheduleEntry[] {
  const $ = cheerio.load(html);
  const header = findHeader($, ['Day', 'Class', 'Tutor Email', 'Tutor Name', 'Quota']);
  if (!header) throw new SvuisParseError('Missing schedule report headers', 'course_time_tutor_ajax.php');
  return header.rows.slice(header.rows.indexOf(header.row) + 1).flatMap(row => {
    const rowCells = cells($, row);
    if (rowCells.length === 1 && $(rowCells[0]).attr('colspan')) return [];
    if (rowCells.length !== header.headings.length) throw new SvuisParseError('Schedule row does not match headers', 'course_time_tutor_ajax.php');
    const value = (label: string) => cleanText($(rowCells[header.headings.indexOf(label.toLowerCase())]).text());
    return [{ sessionTime: value('Day'), class: value('Class'), tutorEmail: value('Tutor Email'), tutor: value('Tutor Name'), quota: value('Quota') }];
  });
}
