import { Router } from 'express';
import { svuisClient } from '../adapters/svuis-client.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { cacheService } from '../services/cache.service.js';
import { parseAms } from '../parsers/index.js';
import { apiOk, apiErr } from '../errors/index.js';

const router = Router();

/**
 * @openapi
 * /api/v1/assessments:
 *   get:
 *     tags: [Assessments]
 *     summary: 'Get AMS (Expert Assessment Management System: EXAMS) assessments'
 *     description: >-
 *       Returns online assessment/quiz records from SVUIS AMS (Expert Assessment Management System: EXAMS). Shows course name, start/end time, status (Archive/Done/Checking), and score (extracted from the "Action" column). An `alert` field indicates if a warning icon was present.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Assessment records
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
 *                     $ref: '#/components/schemas/Assessment'
 *       502:
 *         description: Failed to fetch assessments
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const cacheKey = `ams:${sessionId}`;

    const { data: assessments, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const { text } = await svuisClient.get(sessionId, 'ams.php');
        return parseAms(text);
      },
      300
    );

    res.json(apiOk(assessments, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

export default router;
