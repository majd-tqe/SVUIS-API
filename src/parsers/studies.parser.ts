import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { Semester, CourseGrade, GradeScores, GradeWeights } from '../types/index.js';
import { cells, cleanText, ownRows, numberOrNull, requiredNumber } from './table.js';
import { derivedGrade } from './grading.js';

const endpoint = 'std_profileS.php';
const components = ['e1', 'e2', 'e3', 'midterm', 'oral', 'practical', 'finalExam', 'total'] as const;
const labels = ['E1', 'E2', 'E3', 'M', 'O', 'P', 'F', 'Total'];

export function parseStudies(html: string): Semester[] {
  const $ = cheerio.load(html);
  const semesters: Semester[] = [];
  let recognizedTables = 0;
  for (const table of $('table').toArray()) {
    const rows = ownRows($, table);
    const header = rows.find(row => {
      const values = cells($, row).map(c => cleanText($(c).text()));
      return ['Course', 'CHR', ...labels].every(label => values.includes(label));
    });
    if (!header) continue;
    recognizedTables++;
    const headings = cells($, header).map(c => cleanText($(c).text()));
    const index = (label: string) => headings.indexOf(label);
    const context = $(table).parents('table').first();
    const heading = context.length ? ownRows($, context[0])[0] : rows[0];
    const termText = heading ? cells($, heading).map(c => cleanText($(c).text())).join(' ') : '';
    const match = termText.match(/\b(SU|F|S|W)(\d{2})\b\s*(\d{4})?/i);
    if (!match) throw new SvuisParseError('Could not identify semester heading', endpoint);
    const termCode = `${match[1].toUpperCase()}${match[2]}`;
    const term = ({ F: 'Fall', S: 'Spring', W: 'Winter', SU: 'Summer' } as Record<string, string>)[match[1].toUpperCase()];
    const year = match[3] || `20${match[2]}`;
    const courses: CourseGrade[] = [];
    for (let i = rows.indexOf(header) + 1; i < rows.length; i++) {
      const scoreCells = cells($, rows[i]);
      if (!$(rows[i]).children('td.tdpadding_l').length) continue;
      const weightRow = rows[++i];
      if (!weightRow) throw new SvuisParseError('Missing paired course/weights row', endpoint);
      const weightCells = cells($, weightRow);
      const text = (list: typeof scoreCells, col: number) => col >= 0 && list[col] ? cleanText($(list[col]).text()) : '';
      const code = text(weightCells, index('Course'));
      const name = text(scoreCells, index('Course'));
      if (!code || !name || !$(weightRow).children('td.tdpadding_l').length) {
        throw new SvuisParseError('Invalid paired course rows', endpoint);
      }
      const status = text(scoreCells, 1);
      if (!status) throw new SvuisParseError('Missing course status', endpoint);
      const scores = Object.fromEntries(components.map((key, n) => [key, numberOrNull(text(scoreCells, index(labels[n])))])) as unknown as GradeScores;
      // Helped can be appended inside Total, rather than occupying its own cell.
      const totalText = text(scoreCells, index('Total'));
      scores.total = numberOrNull(totalText.replace(/\bHelped\b/gi, ''));
      const weights = Object.fromEntries(components.map((key, n) => [key, requiredNumber(text(weightCells, index(labels[n])), endpoint, `${code} ${key} weight`)])) as unknown as GradeWeights;
      const pending = ['R', 'I'].includes(status) && scores.finalExam === null;
      const mark = status === 'E' || pending ? null : scores.total;
      if (['P', 'F'].includes(status) && mark === null) throw new SvuisParseError('Missing completed course total', endpoint);
      courses.push({
        code, name, term: termCode, class: text(scoreCells, index('Class')),
        specialStatus: text(scoreCells, index('Special Status')),
        finalAttendance: text(scoreCells, index('FA')),
        chr: requiredNumber(text(weightCells, index('CHR')), endpoint, `${code} credits`),
        mark, ...derivedGrade(mark), gradeSource: 'derived', status,
        helped: /helped/i.test(totalText + ' ' + text(scoreCells, index('Helped'))), weights, scores,
      });
    }
    semesters.push({ term, termCode, year, courses });
  }
  if (!recognizedTables) throw new SvuisParseError('Could not find semester course tables', endpoint);
  return semesters;
}
