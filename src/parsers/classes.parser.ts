import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { StudentClass } from '../types/index.js';
import { ownRows } from './table.js';

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

export function parseClasses(html: string): StudentClass[] {
  try {
    const $ = cheerio.load(html);
    const classes: StudentClass[] = [];
    const seen = new Map<string, number>();
    let recognized = false;

    $('table').each((_, table) => {
      const rows = ownRows($, table);
      const headerCells = $(rows[0]).children('td, th');
      if (headerCells.length < 5) return;

      const headerTexts = headerCells.map((_, c) => cleanText($(c).text()).toLowerCase()).get();

      const hasCourse = headerTexts.some(t => t.includes('course'));
      const hasTerm = headerTexts.some(t => t.includes('term'));
      const hasClass = headerTexts.some(t => t.includes('class'));
      const hasTutor = headerTexts.some(t => /tutor/.test(t));

      if (!(hasCourse && hasTerm && hasClass && hasTutor)) return;

      let courseIdx = headerTexts.findIndex(t => t.includes('course'));
      let termIdx = headerTexts.findIndex(t => t.includes('term'));
      let classIdx = headerTexts.findIndex(t => t.includes('class') && !t.includes('course'));
      let tutorIdx = headerTexts.findIndex(t => t === 'tutor');
      let emailIdx = headerTexts.findIndex(t => t.includes('mail') || t.includes('email') || t.includes('ايميل') || t.includes('البريد'));

      if (courseIdx < 0) courseIdx = 0;
      if (emailIdx < 0 || emailIdx === tutorIdx) emailIdx = headerTexts.length - 1;
      const sessionIdx = headerTexts.findIndex(t => t === 'session time');
      recognized = true;

      $(rows).each((i, row) => {
        if (i === 0) return;
        const cells = $(row).children('td');
        if (cells.length < 4) return;

        const course = cleanText(cells.eq(courseIdx).text());
        if (!course) return;

        const key = `${course}|${cleanText(cells.eq(termIdx).text())}|${cleanText(cells.eq(classIdx).text())}|${cleanText(cells.eq(tutorIdx).text())}`;
        if (seen.has(key)) return;
        seen.set(key, classes.length);

        classes.push({
          course,
          term: cleanText(cells.eq(termIdx).text()),
          class: cleanText(cells.eq(classIdx).text()),
          tutor: cleanText(cells.eq(tutorIdx).text()),
          email: cleanText(cells.eq(emailIdx).text()),
          ...(sessionIdx >= 0 ? { sessionTime: cleanText(cells.eq(sessionIdx).text()) } : {}),
        });
      });
    });

    if (!recognized) throw new SvuisParseError('Could not find classes table', 'std_classes.php');
    return classes;
  } catch (err: any) {
    throw new SvuisParseError(
      `Failed to parse classes: ${err.message}`,
      'std_classes.php',
      html.slice(0, 500)
    );
  }
}
