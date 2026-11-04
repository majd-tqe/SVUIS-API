import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { CurrentAverage, GradeEntry } from '../types/index.js';
import { cells, cleanText, findHeader, numberOrNull, ownRows, requiredNumber } from './table.js';

const endpoint = 'std_current_average.php';

export function parseAverage(html: string): CurrentAverage {
  const $ = cheerio.load(html);
  const summary = findHeader($, ['Program', 'Spec.', 'Student Term', 'Ave.', 'GPA', 'Literal']);
  if (!summary) throw new SvuisParseError('Could not find official average summary', endpoint);
  const dataRow = summary.rows.slice(summary.rows.indexOf(summary.row) + 1).find(r => cells($, r).length === summary.headings.length);
  if (!dataRow) throw new SvuisParseError('Missing official average summary row', endpoint);
  const values = cells($, dataRow).map(c => cleanText($(c).text()));
  const value = (label: string) => values[summary.headings.indexOf(label.toLowerCase())] || '';
  const completed = value('Number of completed hours');
  const pass = completed.match(/\bP\s*:\s*(\d+)/i);
  const exempt = completed.match(/\bE\s*:\s*(\d+)/i);
  if (!pass || !exempt) throw new SvuisParseError('Invalid completed P/E credit totals', endpoint);
  const completedPass = Number(pass[1]);
  const completedExempt = Number(exempt[1]);
  const courses: GradeEntry[] = [];
  for (const table of $('table').toArray()) {
    const rows = ownRows($, table);
    const header = rows.find(r => cells($, r).some(c => cleanText($(c).text()) === 'Course Code'));
    if (!header) continue;
    const headings = cells($, header).map(c => cleanText($(c).text()));
    for (const row of rows.slice(rows.indexOf(header) + 1)) {
      const rowCells = cells($, row);
      if (!rowCells.some(c => $(c).hasClass('tlp'))) continue;
      if (rowCells.length !== headings.length) throw new SvuisParseError('Course row does not match headers', endpoint);
      const text = (label: string) => {
        const col = headings.indexOf(label);
        return col >= 0 ? cleanText($(rowCells[col]).text()) : '';
      };
      const courseCode = text('Course Code');
      if (!courseCode) continue;
      courses.push({
        status: text('Status'), courseCode,
        chr: requiredNumber(text('Course CHR'), endpoint, 'course credits'),
        mark: numberOrNull(text('Mark')), term: text('Term'),
        letterGrade: text('Literal'), gpaValue: numberOrNull(text('4.0 Scale')),
        gradeSource: headings.includes('4.0 Scale') ? 'portal' : 'unavailable',
      });
    }
  }
  return {
    program: value('Program'), specialization: value('Spec.'), studentTerm: value('Student Term'),
    average: requiredNumber(value('Ave.'), endpoint, 'average'),
    gpa: requiredNumber(value('GPA'), endpoint, 'GPA'), literalGrade: value('Literal'),
    completedPass, completedExempt, completedExam: completedExempt,
    chr: completedPass + completedExempt,
    englishChr: requiredNumber(value('CHR Eng.'), endpoint, 'English credits'),
    engPt: requiredNumber(value('PT.'), endpoint, 'placement test'), courses,
  };
}
