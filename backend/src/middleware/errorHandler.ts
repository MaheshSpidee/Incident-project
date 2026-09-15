import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors.js';
import { sanitizeErrorMessage } from '../shared/sanitize.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid request', details: err.flatten() },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  console.error('Unhandled error', { message: sanitizeErrorMessage(err) });
  res.status(500).json({ error: { code: 'internal_error', message: 'Unexpected server error' } });
};
