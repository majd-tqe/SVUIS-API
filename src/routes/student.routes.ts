import { Router } from 'express';
import { svuisClient } from '../adapters/svuis-client.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { cacheService } from '../services/cache.service.js';
import { parseProfile } from '../parsers/index.js';
import { apiOk, apiErr } from '../errors/index.js';

const router = Router();

/**
 * @openapi
 * /api/v1/student/profile:
 *   get:
 *     tags: [Student]
 *     summary: Get full student profile
 *     description: Returns personal information, contact details, registration info, and account balance from SVUIS.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Student profile data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/StudentProfile'
 *       401:
 *         description: Missing or expired session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: Failed to fetch or parse profile from SVUIS
 */
router.get('/profile', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const cacheKey = `profile:${sessionId}`;

    const { data: profile, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const { text } = await svuisClient.get(sessionId, 'std_profileP.php');
        return parseProfile(text);
      },
      300
    );

    res.json(apiOk(profile, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/student/photo:
 *   get:
 *     tags: [Student]
 *     summary: Get student photo
 *     description: Returns the student's photo as a raw image (JPEG). The `std` parameter is the student ID from the profile.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: std
 *         required: true
 *         schema:
 *           type: string
 *         example: "12345"
 *         description: Student ID number
 *       - in: query
 *         name: t
 *         required: false
 *         schema:
 *           type: string
 *           default: "4"
 *         example: "4"
 *         description: Photo type (default 4)
 *     responses:
 *       200:
 *         description: Student photo (JPEG image)
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing student ID parameter
 *       502:
 *         description: Failed to fetch photo from SVUIS
 */
router.get('/photo', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const studentId = req.query.std as string;

    if (!studentId) {
      res.status(400).json(apiErr('Student ID (std) query parameter is required'));
      return;
    }

    const { text } = await svuisClient.get(sessionId, 'std_profileP.php');
    const profile = parseProfile(text);
    if (String(profile.id) !== studentId) {
      res.status(403).json(apiErr('Access to this student photo is forbidden'));
      return;
    }

    const photoType = (req.query.t as string) || '4';
    const endpoint = `view_picture.php?std=${encodeURIComponent(studentId)}&t=${encodeURIComponent(photoType)}`;
    const { buffer, contentType } = await svuisClient.getRaw(sessionId, endpoint);
    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-store');
    res.status(200).send(buffer);
  } catch (err: unknown) {
    next(err);
  }
});

export default router;
