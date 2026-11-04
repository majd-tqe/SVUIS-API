import type { RequestHandler } from 'express';

export const protectApi: RequestHandler = (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) {
    res.status(403).json({ success: false, error: 'Cross-origin request forbidden' });
    return;
  }
  next();
};
