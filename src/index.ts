import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';
import { CONFIG } from './config.js';
import { errorHandler } from './middleware/error.middleware.js';
import type { ApiResponse, SvuisHealth } from './types/index.js';
import { cookieManager } from './adapters/cookie-manager.js';
import { cacheService } from './services/cache.service.js';
import { swaggerSpec } from './swagger.js';
import apiRoutes from './routes/index.js';
import { getUpstreamHealth } from './services/health.service.js';
import { protectApi } from './middleware/security.middleware.js';

const app = express();
const PORT = CONFIG.port;

// Only trust forwarding headers from the local reverse proxy.
app.set('trust proxy', 'loopback');
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api', protectApi);

app.use((req, _res, next) => {
  (req as any).id = randomUUID();
  next();
});

app.use(
  rateLimit({
    windowMs: CONFIG.rateLimit.windowMs,
    max: CONFIG.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.' },
  } as any)
);

app.use((req, res, next) => {
  res.setHeader('X-Request-Id', (req as any).id);
  res.setHeader('X-API-Version', '2.0.0');
  next();
});

// ===== Swagger UI =====
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCssUrl: 'https://cdn.jsdelivr.net/npm/swagger-ui-themes@3.0.0/themes/3.x/theme-material.css',
  customSiteTitle: 'SVUIS API Docs',
}));

// ===== Health =====
/**
 * @openapi
 * /api/v1/health:
 *   get:
 *     tags: [Health]
 *     summary: Check API health
 *     description: Returns server status, uptime, cache size, session count, and SVUIS reachability.
 *     security: []
 *     responses:
 *       200:
 *         description: Server health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ApiResponse/properties/data'
 */
app.get('/api/v1/health', async (_req, res, next) => {
  try {
    const upstream = await getUpstreamHealth();
    const body: ApiResponse<SvuisHealth> = {
      success: true,
      data: {
        status: upstream.reachable ? 'ok' : 'degraded',
        uptime: process.uptime(),
        cacheSize: cacheService.size(),
        sessionCount: cookieManager.count(),
        svuisReachable: upstream.reachable,
        svuisCheckedAt: upstream.checkedAt,
      },
      meta: { cached: false, fetchedAt: new Date().toISOString() },
    };
    res.json(body);
  } catch (err) { next(err); }
});

app.use('/api/v1', apiRoutes);

setInterval(() => {
  cookieManager.cleanup();
}, 60_000);

app.use(errorHandler);

app.get('/', (_req, res) => {
  res.redirect('/api-docs');
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`SVUIS API v2 running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`   Docs:  http://localhost:${PORT}/api-docs`);
});

export default app;
