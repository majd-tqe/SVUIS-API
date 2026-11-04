import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { apiOk, apiErr, SvuisAuthError } from '../errors/index.js';
import { CONFIG } from '../config.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again later.' },
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  otp: z.string().optional(),
});

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate with SVUIS
 *     description: Log in using SVUIS credentials. On success, an HttpOnly session cookie is set. The session expires 30 minutes after creation.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Validation error (missing username/password)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials or OTP required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(apiErr(parsed.error.issues[0].message));
      return;
    }

    const { username, password, otp } = parsed.data;
    const result = await authService.login(username, password, otp);

    res.cookie(CONFIG.session.cookieName, result.sessionId, {
      httpOnly: true, secure: CONFIG.nodeEnv === 'production', sameSite: 'lax',
      path: '/', maxAge: CONFIG.session.ttlMs,
    });
    res.json(apiOk({ student: result.student }));
  } catch (err: any) {
    if (err instanceof SvuisAuthError && err.code === 'INVALID_CREDENTIALS') {
      res.status(401).json(apiErr('Invalid username or password'));
      return;
    }
    if (err instanceof SvuisAuthError && err.code === 'OTP_REQUIRED') {
      res.status(401).json(apiErr('OTP code is required'));
      return;
    }
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout and invalidate session
 *     description: Clears the session cookie and invalidates the SVUIS session on the server.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Logged out successfully
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const sessionId = (req as any).sessionId;
    await authService.logout(sessionId);
    res.clearCookie(CONFIG.session.cookieName, { path: '/' });
    res.json(apiOk({ message: 'Logged out successfully' }));
  } catch (err: any) {
    res.status(500).json(apiErr('Logout failed'));
  }
});

/**
 * @openapi
 * /api/v1/auth/status:
 *   get:
 *     tags: [Auth]
 *     summary: Check session validity
 *     description: Returns whether the current session cookie is still valid on SVUIS.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Session status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     loggedIn:
 *                       type: boolean
 *                       example: true
 */
router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const sessionId = (req as any).sessionId;
    const status = await authService.getStatus(sessionId);
    res.json(apiOk(status));
  } catch (err: any) {
    next(err);
  }
});

export default router;
