import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware.js';
import { apiErr, apiOk } from '../errors/index.js';
import { cacheService } from '../services/cache.service.js';
import { getClassSchedule, getScheduleOptions } from '../services/schedule.service.js';

const router = Router();
const id = z.string().regex(/^\d+$/);
const querySchema = z.object({ program: id.optional(), term: id.optional(), course: z.string().regex(/^(?:-1|\d+)$/).optional(), day: id.optional(), tutor: id.optional() });

/**
 * @openapi
 * /api/v1/classes/schedule/options:
 *   get:
 *     tags: [Classes]
 *     summary: Get dependent weekly schedule filters
 *     description: Without filters returns programs, terms and days. Supply program and term for courses; add day and optional course for tutors. Values come from course_time_tutor.php and its AJAX endpoint.
 *     parameters:
 *       - {in: query, name: program, schema: {type: string}}
 *       - {in: query, name: term, schema: {type: string}}
 *       - {in: query, name: course, schema: {type: string}}
 *       - {in: query, name: day, schema: {type: string}}
 *     responses:
 *       200: {description: "Objects with programs, terms, days, courses and tutors option arrays"}
 *       400: {description: Invalid or unavailable filters}
 * /api/v1/classes/schedule:
 *   get:
 *     tags: [Classes]
 *     summary: Get weekly class schedules by program, course, day and tutor
 *     description: Returns sessionTime, class, tutorEmail, tutor and quota. sessionTime and quota are preserved as published by SVUIS. This is a weekly schedule, not dated lectures.
 *     parameters:
 *       - {in: query, name: program, required: true, schema: {type: string}}
 *       - {in: query, name: term, required: true, schema: {type: string}}
 *       - {in: query, name: course, schema: {type: string}, description: "Omit or use -1 for all courses"}
 *       - {in: query, name: day, schema: {type: string}}
 *       - {in: query, name: tutor, schema: {type: string}, description: "Requires day"}
 *     responses:
 *       200: {description: Array of weekly schedule entries}
 *       400: {description: Invalid or unavailable filters}
 */
router.get(['/options', '/'], requireAuth, async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json(apiErr(parsed.error.issues[0].message)); return; }
    const sessionId = (req as any).sessionId as string;
    const options = req.path === '/options';
    const key = `schedule:${sessionId}:${options}:${JSON.stringify(parsed.data)}`;
    type Result = Awaited<ReturnType<typeof getScheduleOptions>> | Awaited<ReturnType<typeof getClassSchedule>>;
    const { data, cached, fetchedAt } = await cacheService.getOrFetch<Result>(key, () => options ? getScheduleOptions(sessionId, parsed.data) : getClassSchedule(sessionId, parsed.data), 600);
    res.json(apiOk(data, cached, fetchedAt));
  } catch (err) { next(err); }
});

export default router;
