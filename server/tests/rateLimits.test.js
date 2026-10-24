import { describe, expect, it } from 'vitest'
import express from 'express'
import cors from 'cors'
import request from 'supertest'
import { createApp } from '../app.js'
import { AppError } from '../utils/errors.js'
import { createRateLimiters } from '../middleware/rateLimits.js'

function tinyApp(limiter, { trustProxy = false, withCors = false, user = null } = {}) {
  const app = express()
  if (trustProxy) app.set('trust proxy', 1)
  if (withCors) app.use(cors())
  if (user) app.use((req, _res, next) => {
    req.user = typeof user === 'function' ? user(req) : user
    next()
  })
  app.use(limiter)
  app.get('/', (_req, res) => res.json({ ok: true }))
  app.options('/', (_req, res) => res.sendStatus(204))
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } })
    }
    return res.sendStatus(500)
  })
  return app
}

describe('rate limit middleware', () => {
  it('allows the first three requests then returns RATE_LIMITED with Retry-After', async () => {
    const app = tinyApp(createRateLimiters({ globalLimiter: { windowMs: 60_000, limit: 3 } }).globalLimiter)
    for (let index = 0; index < 3; index += 1) {
      expect((await request(app).get('/')).status).toBe(200)
    }
    const limited = await request(app).get('/')
    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
    expect(limited.headers['retry-after']).toBeTruthy()
  })

  it('counts forwarded IP addresses separately when trust proxy is enabled', async () => {
    const app = tinyApp(createRateLimiters({ globalLimiter: { windowMs: 60_000, limit: 3 } }).globalLimiter, { trustProxy: true })
    for (let index = 0; index < 3; index += 1) {
      expect((await request(app).get('/').set('X-Forwarded-For', '198.51.100.10')).status).toBe(200)
    }
    expect((await request(app).get('/').set('X-Forwarded-For', '198.51.100.10')).status).toBe(429)
    expect((await request(app).get('/').set('X-Forwarded-For', '198.51.100.11')).status).toBe(200)
  })

  it('keeps per-user counters separate', async () => {
    const limiter = createRateLimiters({ messageLimiter: { windowMs: 60_000, limit: 3 } }).messageLimiter
    const app = tinyApp(limiter, { user: req => ({ id: req.get('x-user-id') }) })
    for (let index = 0; index < 3; index += 1) {
      expect((await request(app).get('/').set('x-user-id', 'user-a')).status).toBe(200)
    }
    expect((await request(app).get('/').set('x-user-id', 'user-a')).status).toBe(429)
    expect((await request(app).get('/').set('x-user-id', 'user-b')).status).toBe(200)
  })

  it('does not count OPTIONS requests', async () => {
    const limiter = createRateLimiters({ globalLimiter: { windowMs: 60_000, limit: 3 } }).globalLimiter
    const app = tinyApp(limiter)
    for (let index = 0; index < 10; index += 1) {
      expect((await request(app).options('/')).status).toBe(204)
    }
    expect((await request(app).get('/')).status).toBe(200)
  })

  it('retains CORS headers on a limited response', async () => {
    const limiter = createRateLimiters({ globalLimiter: { windowMs: 60_000, limit: 3 } }).globalLimiter
    const app = tinyApp(limiter, { withCors: true })
    for (let index = 0; index < 3; index += 1) await request(app).get('/').set('Origin', 'https://client.example')
    const limited = await request(app).get('/').set('Origin', 'https://client.example')
    expect(limited.status).toBe(429)
    expect(limited.headers['access-control-allow-origin']).toBeTruthy()
  })

  it('keeps the real health route available with draft-7 rate headers', async () => {
    const config = Object.freeze({ clientOrigins: [] })
    const response = await request(createApp(config)).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.headers.ratelimit).toMatch(/limit=100/)
  })
})
