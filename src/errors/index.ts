import type { ApiResponse } from '../types/index.js';

export class SvuisInputError extends Error {
  constructor(message: string) { super(message); this.name = 'SvuisInputError'; }
}

export class SvuisAuthError extends Error {
  constructor(
    message: string,
    public readonly code: 'SESSION_EXPIRED' | 'INVALID_CREDENTIALS' | 'OTP_REQUIRED'
  ) {
    super(message);
    this.name = 'SvuisAuthError';
  }
}

export class SvuisParseError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly rawPreview?: string
  ) {
    super(message);
    this.name = 'SvuisParseError';
  }
}

export class SvuisNetworkError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'SvuisNetworkError';
  }
}

export function apiOk<T>(data: T, cached = false, fetchedAt = new Date().toISOString()): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: { cached, fetchedAt },
  };
}

export function apiErr(message: string): ApiResponse<never> {
  return {
    success: false,
    error: message,
    meta: { cached: false, fetchedAt: new Date().toISOString() },
  };
}
