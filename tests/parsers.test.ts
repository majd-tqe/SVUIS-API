import { readFileSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import { parseStudies, parseAverage, parsePayments, parseClasses, parseExams, parseProfile } from '../src/parsers/index.js';
import { parseExamForm, parseExamOptions } from '../src/parsers/exams-options.parser.js';
import { derivedGrade } from '../src/parsers/grading.js';
import { isLoginPage, assertAuthenticatedPage } from '../src/adapters/page-state.js';
import { parseClassSchedule, parseScheduleOptions } from '../src/parsers/schedule.parser.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('observed portal contracts (synthetic data)', () => {
  it('reads the schedule table after its introductory row and preserves 24:00', () => {
    const schedule = parseClassSchedule(fixture('schedule.html'));
    expect(schedule).toHaveLength(2);
    expect(schedule[1]).toMatchObject({ sessionTime: 'Saturday_22:00_24:00', class: 'TEST_C1', tutorEmail: 't_example1@example.test', quota: '100 %' });
    expect(parseScheduleOptions('<option value="-1">Select</option><option value="1380">CSC101</option>')).toEqual([{ value: '1380', label: 'CSC101' }]);
    expect(() => parseClassSchedule('Server error')).toThrow('headers');
  });
  it('reads each nested semester and paired course once, retaining the source status', () => {
    const terms = parseStudies(fixture('studies.html'));
    expect(terms.map(t => t.termCode)).toEqual(['F24', 'S24']);
    const courses = terms.flatMap(t => t.courses);
    expect(courses.map(c => c.code)).toEqual(['CSC101', 'CSC102', 'CSC103', 'CSC104']);
    expect(courses.map(c => c.status)).toEqual(['R', 'P', 'F', 'E']);
    expect(courses.map(c => c.mark)).toEqual([null, 75, 58, null]);
    expect(courses[1].scores).toMatchObject({ e1: 20, e2: null, finalExam: 55, total: 75 });
    expect(courses[1].weights).toMatchObject({ e1: 30, finalExam: 70, total: 100 });
    expect(courses[1].chr).toBe(4);
    expect(courses[2].status).toBe('F'); // A total >= 50 does not prove a pass.
    expect(courses.map(c => c.helped)).toEqual([false, true, false, false]);
    expect(terms[0].gpa).toBeUndefined(); // No invented official semester summary.
  });

  it('retains published placement-test scores even when their source status remains R', () => {
    const $ = cheerio.load(fixture('studies.html'));
    const row = $('td.tdpadding_l').filter((_, td) => $(td).text() === 'Synthetic Course 1').parent();
    row.children('td').eq(12).text('60'); row.children('td').eq(13).text('60');
    expect(parseStudies($.html())[0].courses[0]).toMatchObject({ status: 'R', mark: 60 });
  });

  it('uses official summary columns and preserves passed, exempt and failed course rows', () => {
    const average = parseAverage(fixture('average.html'));
    expect(average).toMatchObject({ program: 'TEST', studentTerm: 'F24', average: 72.5, gpa: 2.5, literalGrade: 'C+', completedPass: 12, completedExempt: 3, chr: 15, englishChr: 3, engPt: 65 });
    expect(average.courses).toHaveLength(3);
    expect(average.courses[0]).toMatchObject({ status: 'E', courseCode: 'CSC201', mark: null, gpaValue: 0, letterGrade: 'E/F' });
    expect(average.courses[2]).toMatchObject({ status: 'F', mark: 42, gpaValue: null, letterGrade: '', gradeSource: 'unavailable' });
  });

  it('retains two distinct payment IDs with the same description and parses local timestamps', () => {
    const payments = parsePayments(fixture('payments.html'), 'https://example.test/SVUIS');
    expect(payments).toHaveLength(2);
    expect(payments[0]).toMatchObject({ id: '900001', description: 'Course Registration', status: 'paid', amount: 1250, currency: 'SYP', date: '2024-02-19T00:00:00', processStatus: 'started' });
    expect(payments[0].link).toBe('https://example.test/SVUIS/print_payment.php?course_fee_id=900001');
  });

  it('reads six-column classes and keeps multiple tutors/sections', () => {
    const classes = parseClasses(fixture('classes.html'));
    expect(classes).toHaveLength(2);
    expect(classes[0]).toMatchObject({ email: 't_example0', sessionTime: 'Saturday_20:00_22:00' });
  });

  it('retains All Programs=0, omits -1, and obtains identity from the exam form', () => {
    const html = fixture('exams-form.html');
    expect(parseExamOptions(html).programs.map(o => o.value)).toEqual(['0', '53']);
    expect(parseExamForm(html)).toMatchObject({ studentId: '999001', telecenter: '1' });
    expect(() => parseExamForm(html.replace('value="999001"', 'value=""'))).toThrow('identity');
  });

  it('distinguishes a legitimate empty exam report from validation failure', () => {
    expect(parseExams(fixture('exams-empty.json'), { program: '53', term: '49' })).toEqual({ program: 53, term: 49, exams: [] });
    for (const invalid of ['null', '{}', '<html>Login</html>', '{"res":-2,"msgs":["Select a program"]}', '{"res":1,"msgs":"Server error"}']) {
      expect(() => parseExams(invalid, { program: '53', term: '49' })).toThrow();
    }
  });

  it('extracts a populated exam fragment by column names', () => {
    const msgs = '<tr><td>#</td><td>Course</td><td>Class</td><td>Date</td><td>Start Time</td><td>End Time</td><td>Duration</td><td>Telecenter</td></tr><tr><td>1</td><td>CSC101</td><td>C1</td><td>2026-01-01</td><td>10:00</td><td>12:00</td><td>120</td><td>Center</td></tr>';
    expect(parseExams(JSON.stringify({ res: 1, msgs }), { program: '53', term: '49' }).exams[0]).toMatchObject({ course: 'CSC101', telecenter: 'Center' });
  });

  it('does not accept public logout/profile links as proof of authentication', () => {
    const login = fixture('login.html');
    expect(isLoginPage(login)).toBe(true);
    expect(() => assertAuthenticatedPage(login)).toThrow('session expired');
    for (const parser of [parseStudies, parseAverage, parseClasses, parseProfile]) expect(() => parser(login)).toThrow();
    expect(() => parsePayments(login, 'https://example.test')).toThrow();
  });

  it.each([[49, 'E/F', 0], [50, 'D', 1.5], [70, 'C+', 2.5], [75, 'B-', 2.75], [85, 'B+', 3.25], [98, 'A+', 4], [100, 'A+', 4]])('matches the displayed grade scale at %s', (mark, letter, gpa) => {
    expect(derivedGrade(mark as number)).toEqual({ letterGrade: letter, gpaValue: gpa });
  });
});
