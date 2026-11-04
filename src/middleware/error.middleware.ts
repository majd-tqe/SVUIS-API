import type { ErrorRequestHandler } from 'express';
import { SvuisAuthError, SvuisInputError, SvuisNetworkError, SvuisParseError, apiErr } from '../errors/index.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof SvuisInputError) res.status(400).json(apiErr(err.message));
  else if (err instanceof SvuisAuthError) res.status(401).json(apiErr(err.message));
  else if (err instanceof SvuisParseError) res.status(502).json(apiErr(`Parse error from ${err.endpoint}: ${err.message}`));
  else if (err instanceof SvuisNetworkError) res.status(503).json(apiErr(`SVUIS unreachable: ${err.message}`));
  else res.status(500).json(apiErr('Internal server error'));
};
