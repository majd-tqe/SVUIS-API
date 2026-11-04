import { Router } from 'express';
import { svuisClient } from '../adapters/svuis-client.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { cacheService } from '../services/cache.service.js';
import { parseClasses } from '../parsers/index.js';
import { apiOk, apiErr } from '../errors/index.js';

const router = Router();

/**
 * @openapi
 * /api/v1/classes:
 *   get:
 *     tags: [Classes]
 *     summary: Get current semester classes
 *     description: Returns the six-column class table from std_classes.php, including the raw Tutor mail and Session Time values. Tutor mail may be a login rather than an email address.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Class list
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
 *                     $ref: '#/components/schemas/StudentClass'
 *       502:
 *         description: Failed to fetch classes
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const cacheKey = `classes:${sessionId}`;

    const { data: classes, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const { text } = await svuisClient.get(sessionId, 'std_classes.php');
        return parseClasses(text);
      },
      1800
    );

    res.json(apiOk(classes, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

export default router;
