/**
 * server/app.js
 * Creates and configures the Express application.
 * Does NOT call listen() or connect to the database.
 */
import cors    from 'cors'
import express from 'express'
import helmet  from 'helmet'
import { ZodError } from 'zod'
import { AppError, notFound, validationError } from './utils/errors.js'
import { createAuthRouter } from './routes/auth.js'
import { createRequireAuth } from './middleware/auth.js'
import { createRateLimiters } from './middleware/rateLimits.js'

/**
 * @param {{ clientOrigins: string[] }} config
 * @returns {import('express').Express}
 */
export function createApp(config) {
  const app = express()
  const requireAuth = createRequireAuth({ jwtSecret: config.JWT_SECRET })
  const { globalLimiter, authLimiter, startSessionLimiter, messageLimiter, finishLimiter } = createRateLimiters()
  app.locals.requireAuth = requireAuth
  app.locals.rateLimits = { startSessionLimiter, messageLimiter, finishLimiter }

  // ── Trust proxy (for rate-limit, IP detection behind reverse proxy) ──
  app.set('trust proxy', 1)

  // ── Security headers ──────────────────────────────────────────
  app.use(helmet())

  // ── CORS ──────────────────────────────────────────────────────
  app.use(cors({ origin: config.clientOrigins }))

  // ── Global API rate limit ───────────────────────────────────
  app.use('/api', globalLimiter)

  // ── JSON body parser (10 kb limit) ───────────────────────────
  app.use(express.json({ limit: '10kb' }))

  // ── Request logger ────────────────────────────────────────────
  // Prints "METHOD path status durationMs" after the response finishes.
  // Uses req.path (no query string). Never logs headers or bodies.
  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const ms = Date.now() - start
      // req.path gives the path without the query string
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`)
    })
    next()
  })

  // ── Health endpoint ───────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api/auth', authLimiter, createAuthRouter(config, requireAuth))

  // ── 404 handler for unmatched routes ─────────────────────────
  app.use((_req, res, next) => {
    next(notFound())
  })

  // ── Central error handler (must be last, 4-arg signature) ────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    // AppError: use its status and code directly
    if (err instanceof AppError) {
      const body = { error: { code: err.code, message: err.message } }
      if (err.details !== undefined) body.error.details = err.details
      return res.status(err.status).json(body)
    }

    // ZodError → 400 VALIDATION_ERROR with details [{field, issue}]
    if (err instanceof ZodError) {
      const details = err.errors.map(e => ({
        field: e.path.join('.') || 'unknown',
        issue: e.message,
      }))
      const ae = validationError('Validation failed.', details)
      return res.status(400).json({ error: { code: ae.code, message: ae.message, details: ae.details } })
    }

    // JSON SyntaxError from body-parser → 400 VALIDATION_ERROR
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      const ae = validationError('Invalid JSON in request body.')
      return res.status(400).json({ error: { code: ae.code, message: ae.message } })
    }

    // Payload too large → 400 VALIDATION_ERROR
    if (err.type === 'entity.too.large' || err.status === 413) {
      const ae = validationError('Request body too large.')
      return res.status(400).json({ error: { code: ae.code, message: ae.message } })
    }

    // Unknown error → 500 SERVER_ERROR
    // Log only err.name — never stack, message, or request data
    console.error(`Unhandled error: ${err.name ?? 'UnknownError'}`)
    return res.status(500).json({
      error: {
        code:    'SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    })
  })

  return app
}
