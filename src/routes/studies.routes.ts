import { Router } from 'express';
import { z } from 'zod';
import { svuisClient } from '../adapters/svuis-client.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { cacheService } from '../services/cache.service.js';
import { parseStudies, parseAverage, parseExams, parseExamOptions } from '../parsers/index.js';
import { apiOk, apiErr, SvuisInputError } from '../errors/index.js';
import { parseExamForm } from '../parsers/exams-options.parser.js';

const router = Router();

/**
 * @openapi
 * /api/v1/studies/profile:
 *   get:
 *     tags: [Studies]
 *     summary: Get semester grades (full academic history)
 *     description: Returns semesters and paired course score/weight rows from std_profileS.php. Source statuses are preserved; missing scores and ungraded registered/exempt marks are null. Per-course letter/GPA values are derived from the displayed portal scale. No official semester GPA or average is invented. Use studies/average for the official cumulative summary.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Semester grades
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Semester'
 *       502:
 *         description: Failed to fetch or parse studies data
 */
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const cacheKey = `studies:${sessionId}`;

    const { data: semesters, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const { text } = await svuisClient.get(sessionId, 'std_profileS.php');
        return parseStudies(text);
      },
      120
    );

    res.json(apiOk(semesters, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/studies/average:
 *   get:
 *     tags: [Studies]
 *     summary: Get the official current academic average
 *     description: Returns the official cumulative summary from std_current_average.php, including passed and exempt credits. Includes course tables with and without published letter/GPA values; unavailable values remain null or empty.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current average data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CurrentAverage'
 *       502:
 *         description: Failed to fetch or parse average data
 */
router.get('/average', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const cacheKey = `average:${sessionId}`;

    const { data: average, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const { text } = await svuisClient.get(sessionId, 'std_current_average.php');
        return parseAverage(text);
      },
      120
    );

    res.json(apiOk(average, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/studies/exams/options:
 *   get:
 *     tags: [Studies]
 *     summary: Get exam calendar filter options
 *     description: Returns available Program and Term options for filtering the exam calendar. Use these values to call `GET /studies/exams`.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Exam filter options
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     programs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "1"
 *                           label:
 *                             type: string
 *                             example: "Information Technology Engineering"
 *                     terms:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "147"
 *                           label:
 *                             type: string
 *                             example: "Spring 2024"
 *       502:
 *         description: Failed to fetch exam options
 */
router.get('/exams/options', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const cacheKey = `exams-options:${sessionId}`;

    const { data: options, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const { text } = await svuisClient.get(sessionId, 'exam_calendar_student.php');
        return parseExamOptions(text);
      },
      600
    );

    res.json(apiOk(options, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

const examQuerySchema = z.object({
  program: z.string().regex(/^\d+$/).optional(),
  term: z.string().regex(/^\d+$/).optional(),
});

/**
 * @openapi
 * /api/v1/studies/exams:
 *   get:
 *     tags: [Studies]
 *     summary: Get exam schedule
 *     description: Returns the exam schedule for the specified program and term. Use `GET /studies/exams/options` first to get available program/term values.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: program
 *         required: false
 *         schema:
 *           type: string
 *         example: "1"
 *         description: Program ID from exams/options
 *       - in: query
 *         name: term
 *         required: false
 *         schema:
 *           type: string
 *         example: "147"
 *         description: Term ID from exams/options
 *     responses:
 *       200:
 *         description: Exam schedule
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     program:
 *                       type: integer
 *                     term:
 *                       type: integer
 *                     exams:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ExamEntry'
 *       502:
 *         description: Failed to fetch exam schedule
 */
router.get('/exams', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const parsed = examQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(apiErr(parsed.error.issues[0].message));
      return;
    }

    const { program, term } = parsed.data;
    const cacheKey = `exams:${sessionId}:${program || ''}:${term || ''}`;

    const { data: exams, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const page = await svuisClient.get(sessionId, 'exam_calendar_student.php');
        const form = parseExamForm(page.text);
        const selectedProgram = program ?? form.programs[0]?.value;
        const selectedTerm = term ?? form.terms[0]?.value;
        if (!selectedProgram || !selectedTerm
          || !form.programs.some(o => o.value === selectedProgram)
          || !form.terms.some(o => o.value === selectedTerm)) {
          throw new SvuisInputError('Requested exam filters are not available for this account');
        }
        const body = { Program: selectedProgram, Term: selectedTerm, StudentID: form.studentId, StudentTelecenter: form.telecenter };
        const { text } = await svuisClient.post(sessionId, 'exam_calendar_student_validation.php', body);
        return parseExams(text, { program: selectedProgram, term: selectedTerm });
      },
      600
    );

    res.json(apiOk(exams, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

export default router;
