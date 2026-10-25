import cors    from 'cors'
import express from 'express'
import helmet  from 'helmet'
import { ZodError } from 'zod'
import { AppError, notFound, validationError } from './utils/errors.js'
import { createAuthRouter } from './routes/auth.js'
import { createOrgRouter } from './routes/org.js'
import { createRequireAuth } from './middleware/auth.js'
import { createRateLimiters } from './middleware/rateLimits.js'
import { createScenariosRouter } from './routes/scenarios.js'
import { createSessionsRouter } from './routes/sessions.js'
import { createSessionRepo } from './repos/sessionRepo.js'

export function createApp(config, deps = {}) {
  const app = express()
  const requireAuth = createRequireAuth({ jwtSecret: config.JWT_SECRET })
  const { globalLimiter, authLimiter, startSessionLimiter, messageLimiter, finishLimiter } = createRateLimiters()
  app.locals.requireAuth = requireAuth
  app.locals.rateLimits = { startSessionLimiter, messageLimiter, finishLimiter }

  app.set('trust proxy', 1)

  app.use(helmet())

  app.use(cors({ origin: config.clientOrigins }))

  app.use('/api', globalLimiter)

  app.use(express.json({ limit: '10kb' }))

  app.use((req, res, next) => {
    const start = Date.now()
    res.on('finish', () => {
      const ms = Date.now() - start
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`)
    })
    next()
  })

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api/auth', authLimiter, createAuthRouter(config, requireAuth))

  app.use('/api/org', createOrgRouter({
    requireAuth: app.locals.requireAuth,
    getScenarioTitle: deps.getScenarioTitle ?? (deps.scenarios
      ? (id, language) => deps.scenarios.getTitle(id, language)
      : undefined),
  }))

  if (deps.scenarios) {
    app.use('/api/scenarios', createScenariosRouter({
      requireAuth: app.locals.requireAuth,
      store: deps.scenarios,
    }))
  }

  if (deps.ai && deps.scenarios) {
    app.use('/api/sessions', createSessionsRouter({
      requireAuth: app.locals.requireAuth,
      rateLimits: app.locals.rateLimits,
      store: deps.scenarios,
      ai: deps.ai,
      repo: deps.sessionRepo ?? createSessionRepo(),
    }))
  }

  app.use((_req, res, next) => {
    next(notFound())
  })

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      const body = { error: { code: err.code, message: err.message } }
      if (err.details !== undefined) body.error.details = err.details
      return res.status(err.status).json(body)
    }

    if (err instanceof ZodError) {
      const details = err.errors.map(e => ({
        field: e.path.join('.') || 'unknown',
        issue: e.message,
      }))
      const ae = validationError('Validation failed.', details)
      return res.status(400).json({ error: { code: ae.code, message: ae.message, details: ae.details } })
    }

    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      const ae = validationError('Invalid JSON in request body.')
      return res.status(400).json({ error: { code: ae.code, message: ae.message } })
    }

    if (err.type === 'entity.too.large' || err.status === 413) {
      const ae = validationError('Request body too large.')
      return res.status(400).json({ error: { code: ae.code, message: ae.message } })
    }

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
