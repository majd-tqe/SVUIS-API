import { Router } from 'express';
import { z } from 'zod';
import { svuisClient } from '../adapters/svuis-client.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { cacheService } from '../services/cache.service.js';
import { parseTutorOptions, parseTutorReport } from '../parsers/index.js';
import { apiOk, apiErr } from '../errors/index.js';

const router = Router();

/**
 * @openapi
 * /api/v1/tutors/options:
 *   get:
 *     tags: [Tutors]
 *     summary: Get tutor report filter options
 *     description: Returns available programs, courses, and terms for filtering tutor reports from SVUIS "Course &amp; Tutors" page. Optionally pass a `pid` to narrow down courses for a specific program.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: pid
 *         required: false
 *         schema:
 *           type: string
 *         example: "1"
 *         description: Program ID to filter courses
 *     responses:
 *       200:
 *         description: Tutor filter options
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
 *                           label:
 *                             type: string
 *                     courses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *                     terms:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: string
 *                           label:
 *                             type: string
 *       502:
 *         description: Failed to fetch tutor options
 */
router.get('/options', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const pid = (req.query.pid as string) || '';
    const cacheKey = `tutors-options:${sessionId}:${pid}`;

    const { data: options, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const url = pid ? `tutor_reports.php?pid=${encodeURIComponent(pid)}` : 'tutor_reports.php';
        const { text } = await svuisClient.get(sessionId, url);
        return parseTutorOptions(text);
      },
      600
    );

    res.json(apiOk(options, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

const tutorQuerySchema = z.object({
  pid: z.string().min(1),
  course: z.string().min(1),
  term: z.string().min(1),
});

/**
 * @openapi
 * /api/v1/tutors:
 *   get:
 *     tags: [Tutors]
 *     summary: Get tutor report
 *     description: Returns tutor reports grouped by specialization track from SVUIS "Course &amp; Tutors" page. Requires `pid`, `course`, and `term` parameters from `GET /tutors/options`.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: pid
 *         required: true
 *         schema:
 *           type: string
 *         example: "1"
 *         description: Program ID
 *       - in: query
 *         name: course
 *         required: true
 *         schema:
 *           type: string
 *         example: "CS101"
 *         description: Course code
 *       - in: query
 *         name: term
 *         required: true
 *         schema:
 *           type: string
 *         example: "147"
 *         description: Term ID
 *     responses:
 *       200:
 *         description: Tutor report grouped by specialization
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
 *                     $ref: '#/components/schemas/TutorGroup'
 *       400:
 *         description: Missing required query parameters
 *       502:
 *         description: Failed to fetch tutor report
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const parsed = tutorQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(apiErr(parsed.error.issues[0].message));
      return;
    }

    const { pid, course, term } = parsed.data;
    const cacheKey = `tutors:${sessionId}:${pid}:${course}:${term}`;

    const { data: entries, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const q = `${pid},${course},${term}`;
        const { text } = await svuisClient.get(sessionId, `search_ajax/tutor_report.php?sid=${Math.random()}&q=${encodeURIComponent(q)}`);
        return parseTutorReport(text);
      },
      600
    );

    res.json(apiOk(entries, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

export default router;
