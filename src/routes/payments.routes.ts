import { Router } from 'express';
import { svuisClient } from '../adapters/svuis-client.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { cacheService } from '../services/cache.service.js';
import { parsePayments, parseEPaymentStatus } from '../parsers/index.js';
import { apiOk, apiErr } from '../errors/index.js';
import { CONFIG } from '../config.js';

const router = Router();

/**
 * @openapi
 * /api/v1/payments:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment history
 *     description: Returns all payments with 14 columns including ID, description, status, term, date, validator, amount, currency, special amount, program, process status, and link. Data sourced from `student_payments.php`.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payment history
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
 *                     $ref: '#/components/schemas/Payment'
 *       502:
 *         description: Failed to fetch payments
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const cacheKey = `payments:${sessionId}`;

    const { data: payments, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const { text } = await svuisClient.get(sessionId, 'student_payments.php');
        return parsePayments(text, CONFIG.svuisBase);
      },
      60
    );

    res.json(apiOk(payments, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/payments/epay:
 *   get:
 *     tags: [Payments]
 *     summary: '[INCOMPLETE] Get e-payment status'
 *     description: >-
 *       Checks whether there are any due payments on the student's account from `e_payment.php`.

 *       **Note: This endpoint is incomplete — the e-payment workflow (payment initiation, callback handling, etc.) is not yet implemented.**
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: E-payment status
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
 *                     hasDue:
 *                       type: boolean
 *                       example: false
 *                     message:
 *                       type: string
 *                       example: No dues
 *       502:
 *         description: Failed to fetch e-payment status
 */
router.get('/epay', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const cacheKey = `epay:${sessionId}`;

    const { data: status, cached, fetchedAt } = await cacheService.getOrFetch(
      cacheKey,
      async () => {
        const { text } = await svuisClient.get(sessionId, 'e_payment.php');
        return parseEPaymentStatus(text);
      },
      60
    );

    res.json(apiOk(status, cached, fetchedAt));
  } catch (err: unknown) {
    next(err);
  }
});

export default router;
