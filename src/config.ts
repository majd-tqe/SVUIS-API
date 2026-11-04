export const CONFIG = {
  port: parseInt(process.env.PORT || '4000', 10),
  svuisBase: process.env.SVUIS_BASE || 'https://svuis.svuonline.org/SVUIS',
  nodeEnv: process.env.NODE_ENV || 'development',
  upstreamTimeoutMs: 25_000,

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  cacheTtl: {
    profile: 5 * 60,
    grades: 2 * 60,
    payments: 60,
    exams: 10 * 60,
    classes: 30 * 60,
    ams: 5 * 60,
  } as const,

  session: {
    ttlMs: 30 * 60 * 1000,
    cookieName: 'svuis_sid',
  },
} as const;
