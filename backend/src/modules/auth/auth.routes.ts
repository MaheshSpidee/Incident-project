import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { loginSchema } from './auth.validation.js';
import { login } from './auth.service.js';

export const authRouter = Router();

authRouter.post(
  '/login',
  rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    res.json({ data: await login(body.email, body.password) });
  }),
);

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ data: { user: req.user } });
});
