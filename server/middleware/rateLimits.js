import { rateLimit } from 'express-rate-limit'
import { rateLimited } from '../utils/errors.js'


export const RATE_LIMIT_DEFAULTS = Object.freeze({
  globalLimiter: Object.freeze({ windowMs: 60 * 1000, limit: 100 }),
  authLimiter: Object.freeze({ windowMs: 60 * 1000, limit: 10 }),
  startSessionLimiter: Object.freeze({ windowMs: 60 * 60 * 1000, limit: 20 }),
  messageLimiter: Object.freeze({ windowMs: 60 * 1000, limit: 8 }),
  finishLimiter: Object.freeze({ windowMs: 60 * 1000, limit: 6 }),
})

function makeLimiter(name, overrides, perUser = false) {
  const options = { ...RATE_LIMIT_DEFAULTS[name], ...overrides[name] }
  return rateLimit({
    ...options,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: req => req.method === 'OPTIONS',
    ...(perUser ? {
      keyGenerator: req => req.user
        ? String(req.user._id ?? req.user.id)
        : req.ip,
    } : {}),
    handler: (req, res, next, limitOptions) => {
      const retrySeconds = Math.max(1, Math.ceil((limitOptions.windowMs ?? options.windowMs) / 1000))
      res.setHeader('Retry-After', String(retrySeconds))
      return next(rateLimited())
    },
  })
}

export function createRateLimiters(overrides = {}) {
  return {
    globalLimiter: makeLimiter('globalLimiter', overrides),
    authLimiter: makeLimiter('authLimiter', overrides),
    startSessionLimiter: makeLimiter('startSessionLimiter', overrides, true),
    messageLimiter: makeLimiter('messageLimiter', overrides, true),
    finishLimiter: makeLimiter('finishLimiter', overrides, true),
  }
}
