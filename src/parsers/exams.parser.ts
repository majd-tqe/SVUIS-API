import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { ExamSchedule, ExamEntry } from '../types/index.js';

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function parseExams(jsonText: string, context: { program: string; term: string }): ExamSchedule {
  try {
    let data: any;
    try {
      data = JSON.parse(jsonText);
    } catch {
      throw new Error('Response is not valid JSON');
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid exam response envelope');
    if (Number(data.res) !== 1) throw new Error('SVUIS rejected the exam report request');
    if (typeof data.msgs !== 'string') throw new Error('Missing exam report HTML');
    const msgsRaw: string = data.msgs;

    const htmlTable = `<table>${msgsRaw}</table>`;
    const $ = cheerio.load(htmlTable);
    const exams: ExamEntry[] = [];

    const header = $('tr').filter((_, row) => $(row).children('td,th').toArray().some(c => cleanText($(c).text()) === 'Course')).first();
    if (!header.length) throw new Error('Missing exam report headers');
    const headings = header.children('td, th').map((_, c) => cleanText($(c).text())).get();
    if (!['Course', 'Class', 'Date', 'Start Time', 'End Time', 'Duration', 'Telecenter'].every(c => headings.includes(c))) throw new Error('Unrecognized exam report columns');
    header.nextAll('tr').each((_, row) => {
      const cells = $(row).children('td');
      if (cells.length === 1 && cells.first().attr('colspan')) return;
      if (cells.length !== headings.length) throw new Error('Exam row does not match headers');
      const value = (label: string) => cleanText(cells.eq(headings.indexOf(label)).text());

      const course = value('Course');
      const className = value('Class');
      const date = value('Date');
      const startTime = value('Start Time');
      const endTime = value('End Time');
      const duration = value('Duration');
      const telecenter = value('Telecenter');

      if (course) {
        exams.push({ course, class: className, date, startTime, endTime, duration, telecenter });
      }
    });

    return { program: Number(context.program), term: Number(context.term), exams };
  } catch (err: any) {
    throw new SvuisParseError(
      `Failed to parse exams: ${err.message}`,
      'exam_calendar_student_validation.php',
      jsonText.slice(0, 500)
    );
  }
}
