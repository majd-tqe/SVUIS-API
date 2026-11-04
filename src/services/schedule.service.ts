import { svuisClient } from '../adapters/svuis-client.js';
import { SvuisInputError } from '../errors/index.js';
import { parseClassSchedule, parseScheduleOptions } from '../parsers/schedule.parser.js';
import type { SelectOption } from '../types/index.js';

export interface ScheduleQuery {
  program?: string;
  term?: string;
  course?: string;
  day?: string;
  tutor?: string;
}

const endpoint = 'course_time_tutor_ajax.php';
const requireOption = (options: SelectOption[], value: string, name: string) => {
  if (!options.some(o => o.value === value)) throw new SvuisInputError(`Unavailable schedule ${name}`);
};

export async function getScheduleOptions(sessionId: string, query: ScheduleQuery) {
  const page = await svuisClient.get(sessionId, 'course_time_tutor.php');
  const programs = parseScheduleOptions(page.text, 'Program');
  const terms = parseScheduleOptions(page.text, 'Term');
  const days = parseScheduleOptions(page.text, 'SessionDay');
  let courses: SelectOption[] = [];
  let tutors: SelectOption[] = [];
  if (query.program || query.term) {
    if (!query.program || !query.term) throw new SvuisInputError('program and term must be supplied together');
    requireOption(programs, query.program, 'program');
    requireOption(terms, query.term, 'term');
    const body = { program: query.program, term: query.term };
    courses = parseScheduleOptions((await svuisClient.post(sessionId, endpoint, { act: 'course', ...body })).text);
    if (query.course && query.course !== '-1') requireOption(courses, query.course, 'course');
    if (query.day) {
      requireOption(days, query.day, 'day');
      tutors = parseScheduleOptions((await svuisClient.post(sessionId, endpoint, { act: 'tutor', ...body, course: query.course || '-1', sessionday: query.day })).text);
    }
  } else if (query.course || query.day || query.tutor) throw new SvuisInputError('program and term are required for dependent filters');
  if (query.tutor) {
    if (!query.day) throw new SvuisInputError('day is required when filtering by tutor');
    requireOption(tutors, query.tutor, 'tutor');
  }
  return { programs, terms, days, courses, tutors };
}

export async function getClassSchedule(sessionId: string, query: ScheduleQuery) {
  if (!query.program || !query.term) throw new SvuisInputError('program and term are required');
  await getScheduleOptions(sessionId, query);
  const body = { program: query.program, term: query.term, course: query.course || '-1' };
  const request = query.tutor
    ? { ...body, act: 'finalresult', sessionday: query.day!, tutor: query.tutor }
    : query.day ? { ...body, act: 'resultsessionday', sessionday: query.day }
      : { ...body, act: 'resultcourse' };
  return parseClassSchedule((await svuisClient.post(sessionId, endpoint, request)).text);
}
