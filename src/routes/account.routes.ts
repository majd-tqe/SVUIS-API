import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { apiErr } from '../errors/index.js';

const router = Router();

/**
 * @openapi
 * /api/v1/account/change-password:
 *   post:
 *     tags: [Account]
 *     summary: Password change temporarily unavailable
 *     description: Disabled until the upstream success response can be reliably verified.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       501:
 *         description: Not implemented
 */
router.post('/change-password', requireAuth, (_req, res) => {
  res.status(501).json(apiErr('Password change is temporarily unavailable'));
});

/**
 * @openapi
 * /api/v1/account/upload/naqaba:
 *   post:
 *     tags: [Account]
 *     summary: Upload Naqaba document (not implemented)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       501:
 *         description: Not implemented
 */
router.post('/upload/naqaba', requireAuth, (_req, res) => {
  res.status(501).json(apiErr('Not implemented yet'));
});

/**
 * @openapi
 * /api/v1/account/upload/military:
 *   post:
 *     tags: [Account]
 *     summary: Upload military document (not implemented)
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       501:
 *         description: Not implemented
 */
router.post('/upload/military', requireAuth, (_req, res) => {
  res.status(501).json(apiErr('Not implemented yet'));
});

export default router;
