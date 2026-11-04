import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { svuisClient } from '../src/adapters/svuis-client.js';
import { cookieManager } from '../src/adapters/cookie-manager.js';
import { authService } from '../src/services/auth.service.js';
import { parseProfile, parseStudies, parseAverage, parsePayments, parseClasses, parseAms, parseTutorOptions, parseTutorReport, parseAssignCourses, parseExams } from '../src/parsers/index.js';
import { parseExamForm } from '../src/parsers/exams-options.parser.js';
import { CONFIG } from '../src/config.js';
import { getClassSchedule, getScheduleOptions } from '../src/services/schedule.service.js';

/** Read-only report requests. Credentials/cookies/HTML/student records are never written. */
async function main() {
  let sessionId = randomUUID() as string;
  const suppliedCookie = process.env.SVUIS_AUDIT_COOKIE;
  if (!suppliedCookie && (!process.env.SVUIS_USERNAME || !process.env.SVUIS_PASSWORD)) {
    throw new Error('Set SVUIS_USERNAME and SVUIS_PASSWORD, or SVUIS_AUDIT_COOKIE, in the process environment. Do not put credentials in source files.');
  }
  const results: Record<string, unknown>[] = [];
  try {
    if (suppliedCookie) cookieManager.set(sessionId, suppliedCookie);
    else sessionId = (await authService.login(process.env.SVUIS_USERNAME!, process.env.SVUIS_PASSWORD!, process.env.SVUIS_OTP)).sessionId;
    const fetchPage = async (endpoint: string) => (await svuisClient.get(sessionId, endpoint)).text;
    const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

    const profile = parseProfile(await fetchPage('std_profileP.php'));
    results.push({ endpoint: 'std_profileP.php', identityConfirmed: profile.id > 0, programs: profile.programs.length });

    const studiesHtml = await fetchPage('std_profileS.php');
    const studies = parseStudies(studiesHtml);
    const $studies = cheerio.load(studiesHtml);
    const sourceCourses = $studies('td.tdpadding_l').length / 2;
    const parsedCourses = studies.reduce((sum, term) => sum + term.courses.length, 0);
    check(parsedCourses === sourceCourses, 'Studies: source and parsed course counts differ');
    check(studies.every(t => t.courses.every(c => c.code && c.name)), 'Studies: missing course identity');
    check(studies.every(t => t.courses.every(c => !['P', 'F'].includes(c.status) || c.mark !== null)), 'Studies: missing completed course totals');
    const sourceScoreRows = $studies('tr').filter((_, row) => $studies(row).children('td.tdpadding_l').length > 0 && $studies(row).children('td').eq(1).text().trim() !== '').toArray();
    const coursesInOrder = studies.flatMap(s => s.courses);
    const componentKeys = ['e1', 'e2', 'e3', 'midterm', 'oral', 'practical', 'finalExam', 'total'] as const;
    check(sourceScoreRows.length === coursesInOrder.length, 'Studies: score row count differs');
    sourceScoreRows.forEach((row, i) => {
      const sourceCells = $studies(row).children('td');
      const weights = $studies(row).next('tr').children('td');
      const course = coursesInOrder[i];
      check(course.code === weights.eq(3).text().trim(), 'Studies: course order/code differs');
      check(course.status === sourceCells.eq(1).text().trim(), 'Studies: status differs');
      componentKeys.forEach((key, offset) => {
        const raw = sourceCells.eq(offset + 6).text().replace(/Helped/g, '').trim();
        const expected = raw === '' || raw === '-' ? null : Number(raw);
        check(course.scores?.[key] === expected, 'Studies: score differs from source');
        check(course.weights?.[key] === Number(weights.eq(offset + 6).text()), 'Studies: weight differs from source');
      });
    });
    results.push({ endpoint: 'std_profileS.php', semesters: studies.length, sourceCourses, parsedCourses, statuses: [...new Set(studies.flatMap(s => s.courses.map(c => c.status)))], countMatches: true, scoresMatch: true, weightsMatch: true, statusesMatch: true });

    const averageHtml = await fetchPage('std_current_average.php');
    const average = parseAverage(averageHtml);
    const $average = cheerio.load(averageHtml);
    // Independent positional comparison against the observed official summary.
    const summaryCells = $average('table.stbl').first().find('tr').eq(1).children('td');
    check(average.average === Number(summaryCells.eq(8).text()), 'Average differs from official summary');
    check(average.gpa === Number(summaryCells.eq(10).text()), 'GPA differs from official summary');
    results.push({ endpoint: 'std_current_average.php', averageMatches: true, gpaMatches: true, courses: average.courses.length });

    const paymentsHtml = await fetchPage('student_payments.php');
    const payments = parsePayments(paymentsHtml, CONFIG.svuisBase);
    const $payments = cheerio.load(paymentsHtml);
    const sourcePayments = $payments('tr').filter((_, row) => $payments(row).children('td.tlp').length === 13).length;
    check(payments.length === sourcePayments, 'Payments: source and parsed row counts differ');
    results.push({ endpoint: 'student_payments.php', sourceRows: sourcePayments, parsedRows: payments.length, countMatches: true });

    const classesHtml = await fetchPage('std_classes.php');
    const classes = parseClasses(classesHtml);
    const $classes = cheerio.load(classesHtml);
    const sourceClasses = $classes('tr').filter((_, row) => $classes(row).children('td.tdpadding_l_p').length === 6).length;
    check(classes.length === sourceClasses, 'Classes: source and parsed row counts differ');
    results.push({ endpoint: 'std_classes.php', sourceRows: sourceClasses, parsedRows: classes.length, countMatches: true });
    const amsHtml = await fetchPage('ams.php');
    const assessments = parseAms(amsHtml);
    const $ams = cheerio.load(amsHtml);
    const sourceAssessments = $ams('tr').filter((_, row) => $ams(row).children('td').length === 7 && $ams(row).children('td').first().hasClass('course_hd') === false && /^\d+$/.test($ams(row).children('td').first().text().trim())).length;
    check(assessments.length === sourceAssessments, 'Assessments: source and parsed row counts differ');
    results.push({ endpoint: 'ams.php', assessments: assessments.length, sourceRows: sourceAssessments, countMatches: true, verification: 'Archive numeric Action values observed; active assessment actions not exercised' });

    const examForm = parseExamForm(await fetchPage('exam_calendar_student.php'));
    const program = examForm.programs.find(p => p.value !== '0')?.value || examForm.programs[0]?.value;
    const term = examForm.terms[0]?.value;
    check(!!program && !!term, 'No available exam filters');
    const examResult = await svuisClient.post(sessionId, 'exam_calendar_student_validation.php', {
      Program: program!, Term: term!, StudentID: examForm.studentId, StudentTelecenter: examForm.telecenter,
    });
    const exams = parseExams(examResult.text, { program: program!, term: term! });
    results.push({ endpoint: 'exam_calendar_student_validation.php', exams: exams.exams.length, identityFromForm: true });

    const ownProgram = examForm.programs.find(p => p.label === average.program)?.value;
    if (ownProgram) {
      const options = parseTutorOptions(await fetchPage(`tutor_reports.php?pid=${encodeURIComponent(ownProgram)}`));
      results.push({ endpoint: 'tutor_reports.php', courses: options.courses.length, terms: options.terms.length });
      const course = options.courses.find(c => c.label !== '[]');
      if (course && options.terms.length) {
        const q = encodeURIComponent(`${ownProgram},${course.value},${options.terms[0].value}`);
        const report = parseTutorReport(await fetchPage(`search_ajax/tutor_report.php?q=${q}`));
        results.push({ endpoint: 'search_ajax/tutor_report.php', groups: report.length, verification: 'parser completed; independent entry count pending' });
      }
      const assignment = parseAssignCourses(await fetchPage(`std_class_assign.php?pid=${encodeURIComponent(ownProgram)}`));
      results.push({ endpoint: 'std_class_assign.php', groups: assignment.groups.length, verification: 'listing only; registration not exercised' });

      const initial = await getScheduleOptions(sessionId, {});
      if (initial.terms[0]) {
        const filters = { program: ownProgram, term: initial.terms[0].value };
        const options = await getScheduleOptions(sessionId, filters);
        const course = options.courses.find(c => c.label.split('|')[1]?.trim() === classes[0]?.course) || options.courses[0];
        if (course) {
          const schedule = await getClassSchedule(sessionId, { ...filters, course: course.value });
          results.push({ endpoint: 'course_time_tutor_ajax.php', actions: ['course', 'resultcourse'], entries: schedule.length, verification: 'Weekly schedule parsed; sessionTime preserved verbatim' });
        }
      }
    }

    const reportUrl = new URL('../reports/latest-audit.json', import.meta.url);
    await mkdir(new URL('.', reportUrl), { recursive: true });
    const report = { checkedAt: new Date().toISOString(), origin: new URL(CONFIG.svuisBase).origin, scope: 'One authorized student account; read-only pages and report POST', results };
    await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
    console.log(`Audit passed (${results.length} checks). Report: ${fileURLToPath(reportUrl)}`);
  } finally {
    if (!suppliedCookie) await svuisClient.logout(sessionId);
    cookieManager.delete(sessionId);
  }
}

main().catch((err: Error) => { console.error(`Portal audit failed: ${err.message}`); process.exitCode = 1; });
