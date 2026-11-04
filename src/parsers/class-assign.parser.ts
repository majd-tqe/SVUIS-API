import * as cheerio from 'cheerio';
import { Element } from 'domhandler';
import { SvuisParseError } from '../errors/index.js';
import type { ClassAssignProgram, ClassAssignGroup, ClassAssignCourse, ClassAssignData } from '../types/index.js';

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

function getTableRows($table: cheerio.Cheerio<Element>): cheerio.Cheerio<Element> {
  const tbody = $table.children('tbody');
  return tbody.length ? tbody.children('tr') : $table.children('tr');
}

export function parseAssignPrograms(html: string): ClassAssignProgram[] {
  try {
    const $ = cheerio.load(html);
    const programs: ClassAssignProgram[] = [];
    const seen = new Set<string>();

    $('select[name="pid"] option').each((_, el) => {
      const value = cleanText($(el).attr('value') || '');
      const label = cleanText($(el).text());
      if (value && label && value !== '' && !seen.has(value)) {
        seen.add(value);
        programs.push({ value, label });
      }
    });

    return programs;
  } catch (err: any) {
    throw new SvuisParseError(
      `Failed to parse class assign programs: ${err.message}`,
      'std_class_assign.php',
      html.slice(0, 500)
    );
  }
}

export function parseAssignCourses(html: string): ClassAssignData {
  try {
    const $ = cheerio.load(html);
    const groups: ClassAssignGroup[] = [];

    $('table').each((_, outerTable) => {
      const rows = getTableRows($(outerTable));
      const headerRow = rows.first();
      const headerCells = headerRow.children('td.tdhead_left_colored');
      if (headerCells.length < 2) return;

      const groupName = cleanText(headerCells.eq(0).text());
      const specialization = cleanText(headerCells.eq(1).text());
      if (!groupName) return;

      const contentRow = rows.eq(1);
      const innerTable = contentRow.children('td[colspan]').children('table');
      if (!innerTable.length) return;

      const courses: ClassAssignCourse[] = [];

      innerTable.find('tr').each((_, row) => {
        const cells = $(row).children('td');
        if (cells.length < 5) return;

        const codeCell = cells.eq(0);
        if (!codeCell.hasClass('tdpadding_l')) return;

        const code = cleanText(codeCell.text());
        if (!code) return;

        const chr = cleanText(cells.eq(1).text());
        const name = cleanText(cells.eq(2).text());

        const status: { letter: string; label: string; color: string }[] = [];
        cells.eq(3).find('a').each((_, a) => {
          const letter = cleanText($(a).text());
          const title = $(a).attr('title') || '';
          const color = $(a).find('font').attr('color') || '';
          if (letter) {
            status.push({ letter, label: title, color });
          }
        });

        courses.push({ code, chr, name, status });
      });

      if (courses.length > 0) {
        groups.push({ name: groupName, specialization, courses });
      }
    });

    let termId = '';
    let studentId = '';
    let programId = '';
    $('input[type="hidden"]').each((_, el) => {
      const name = $(el).attr('name') || '';
      const value = $(el).attr('value') || '';
      if (name === 'term_id') termId = value;
      if (name === 'student_id') studentId = value;
      if (name === 'program_id') programId = value;
    });

    return { termId, studentId, programId, groups };
  } catch (err: any) {
    throw new SvuisParseError(
      `Failed to parse class assign courses: ${err.message}`,
      'std_class_assign.php',
      html.slice(0, 500)
    );
  }
}
