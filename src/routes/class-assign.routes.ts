import { Router } from 'express';
import { z } from 'zod';
import { svuisClient } from '../adapters/svuis-client.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { cacheService } from '../services/cache.service.js';
import { parseAssignPrograms, parseAssignCourses } from '../parsers/index.js';
import { apiOk, apiErr } from '../errors/index.js';

const router = Router();

/**
 * @openapi
 * /api/v1/classes/assign:
 *   get:
 *     tags: [Classes]
 *     summary: '[INCOMPLETE] Get class assignment programs / courses'
 *     description: >-
 *       Fetch available programs and course listings for class assignment from SVUIS "Select Classes" page (`std_class_assign.php`). Without `pid`, returns available program options. With `pid`, returns the course listing grouped by specialization with registration status and class selection options.

 *       **Note: This endpoint is incomplete — the actual class registration/submission logic is not yet implemented.**
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: pid
 *         required: false
 *         schema:
 *           type: string
 *         example: "53"
 *         description: Program ID to fetch course listing for
 *     responses:
 *       200:
 *         description: Class assignment programs or courses
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
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
 *                 - $ref: '#/components/schemas/ClassAssignData'
 *       502:
 *         description: Failed to fetch class assignment data
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const pid = (req.query.pid as string) || '';
    const cacheKey = pid ? `class-assign:${sessionId}:${pid}` : `class-assign:${sessionId}`;

    const { data, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const url = pid ? `std_class_assign.php?pid=${encodeURIComponent(pid)}` : 'std_class_assign.php';
        const { text } = await svuisClient.get(sessionId, url);

        if (pid) {
          return parseAssignCourses(text);
        }
        return { programs: parseAssignPrograms(text) };
      },
      300
    );

    res.json(apiOk(data, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

export default router;
