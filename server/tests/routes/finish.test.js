import { afterEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import { ZodError } from 'zod'
import { fileURLToPath } from 'node:url'
import { loadScenarios } from '../../scenarios/loadScenarios.js'
import { createSessionsRouter } from '../../routes/sessions.js'
import { createFakeAi } from '../../engine/fakeAi.js'
import { AppError, notFound, validationError } from '../../utils/errors.js'

const USER_A = '507f1f77bcf86cd799439011'
const USER_B = '507f1f77bcf86cd799439012'
const SESSION_ID = '507f1f77bcf86cd799439101'
const SCENARIO_ID = 'mobile-money-call'
const store = await loadScenarios(fileURLToPath(new URL('../../scenarios/', import.meta.url)))

function countingLimiter() {
  const limiter = (_req, _res, next) => { limiter.calls += 1; next() }
  limiter.calls = 0
  return limiter
}

function createMemoryRepo({ initial = [], loseRace = false } = {}) {
  const documents = new Map(initial.map(doc => [doc._id, structuredClone(doc)]))
  const repo = {
    documents,
    loseRace,
    async findOwned(id, userId) {
      if (typeof id !== 'string' || !mongoose.isValidObjectId(id) || !/^[a-f\d]{24}$/i.test(id)) return null
      const document = documents.get(id)
      if (!document || String(document.userId) !== String(userId)) return null
      return structuredClone(document)
    },
    async finalize({ id, userId, set }) {
      const document = await repo.findOwned(id, userId)
      if (!document || document.status !== 'active') return null
      const stored = documents.get(id)
      if (repo.loseRace) {
        repo.loseRace = false
        Object.assign(stored, {
          status: 'finished', finishedAt: new Date('2026-01-01T00:01:00.000Z'),
          endReason: 'user_button', score: 80, band: 'resilient', report: { marker: 'race-report' },
        })
        return null
      }
      stored.status = 'finished'
      for (const key of ['finishedAt', 'endReason', 'score', 'band', 'report']) stored[key] = set[key]
      return structuredClone(stored)
    },
  }
  return repo
}

function fakeRequireAuth(req, _res, next) {
  req.user = { _id: req.get('x-test-user') ?? USER_A }
  return next()
}

function buildApp({ sessions = [], ai = createFakeAi(), repo, scenarioStore = store } = {}) {
  const sessionRepo = repo ?? createMemoryRepo({ initial: sessions })
  const finishLimiter = countingLimiter()
  const app = express()
  app.use(express.json())
  app.use('/api/sessions', createSessionsRouter({
    requireAuth: fakeRequireAuth,
    rateLimits: { startSessionLimiter: countingLimiter(), messageLimiter: countingLimiter(), finishLimiter },
    store: scenarioStore,
    ai,
    repo: sessionRepo,
  }))
  app.use((_req, _res, next) => next(notFound()))
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      const body = { error: { code: err.code, message: err.message } }
      if (err.details !== undefined) body.error.details = err.details
      return res.status(err.status).json(body)
    }
    if (err instanceof ZodError) {
      const ae = validationError('Validation failed.', err.errors.map(item => ({ field: item.path.join('.') || 'unknown', issue: item.message })))
      return res.status(400).json({ error: { code: ae.code, message: ae.message, details: ae.details } })
    }
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred.' } })
  })
  return { app, repo: sessionRepo, finishLimiter, ai }
}

function makeSession(overrides = {}) {
  return {
    _id: SESSION_ID,
    id: SESSION_ID,
    userId: USER_A,
    orgId: null,
    scenarioId: SCENARIO_ID,
    language: 'en',
    status: 'active',
    stageIndex: 1,
    turnCount: 2,
    messages: [
      { role: 'attacker', text: 'Opening line', stageIndex: 0, createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { role: 'user', text: 'I will verify independently', stageIndex: 0, createdAt: new Date('2026-01-01T00:00:01.000Z') },
      { role: 'attacker', text: 'Please do that', stageIndex: 1, createdAt: new Date('2026-01-01T00:00:02.000Z') },
      { role: 'user', text: 'I refuse to share a code', stageIndex: 1, createdAt: new Date('2026-01-01T00:00:03.000Z') },
    ],
    endReason: null,
    score: null,
    band: null,
    report: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: null,
    ...overrides,
  }
}

function finish(ctx, id = SESSION_ID, userId = USER_A, body = undefined) {
  const req = request(ctx.app).post(`/api/sessions/${id}/finish`).set('x-test-user', userId)
  return body === undefined ? req : req.send(body)
}

afterEach(() => vi.restoreAllMocks())

describe('POST /api/sessions/:id/finish', () => {
  it('rejects sessions with no turns', async () => {
    const ctx = buildApp({ sessions: [makeSession({ turnCount: 0, messages: [] })] })
    const response = await finish(ctx)
    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(response.body.error.details).toEqual([{ field: 'turnCount', issue: 'no messages were sent' }])
  })

  it('finishes, stores the report without changing messages, ignores body fields, and is idempotent', async () => {
    const initial = makeSession()
    const originalMessages = structuredClone(initial.messages)
    const ai = createFakeAi()
    const judge = vi.spyOn(ai, 'judgeCheckpoints')
    const feedback = vi.spyOn(ai, 'generateFeedback')
    const ctx = buildApp({ sessions: [initial], ai })
    const first = await finish(ctx, SESSION_ID, USER_A, { score: 0, endReason: 'max_turns', messages: ['fake'] })
    expect(first.status).toBe(200)
    expect(first.body.report.endReason).toBe('user_button')
    const stored = ctx.repo.documents.get(SESSION_ID)
    expect(stored.status).toBe('finished')
    expect(stored.finishedAt).toBeInstanceOf(Date)
    expect(stored.endReason).toBe('user_button')
    expect(stored.score).toBe(first.body.report.score)
    expect(stored.band).toBe(first.body.report.band)
    expect(stored.report).toEqual(first.body.report)
    expect(stored.messages).toEqual(originalMessages)
    expect(ctx.finishLimiter.calls).toBe(1)
    const calls = [judge.mock.calls.length, feedback.mock.calls.length]

    const second = await finish(ctx)
    expect(second.status).toBe(200)
    expect(second.body.report).toEqual(first.body.report)
    expect([judge.mock.calls.length, feedback.mock.calls.length]).toEqual(calls)

    const get = await request(ctx.app).get(`/api/sessions/${SESSION_ID}`).set('x-test-user', USER_A)
    expect(get.status).toBe(200)
    expect(get.body.session.report).toEqual(first.body.report)
  })

  it('preserves an existing endReason', async () => {
    const ctx = buildApp({ sessions: [makeSession({ endReason: 'end_signal' })] })
    const response = await finish(ctx)
    expect(response.status).toBe(200)
    expect(ctx.repo.documents.get(SESSION_ID).endReason).toBe('end_signal')
    expect(response.body.report.endReason).toBe('end_signal')
  })

  it('reloads and returns the stored report when finalize loses a race', async () => {
    const repo = createMemoryRepo({ initial: [makeSession()], loseRace: true })
    const ctx = buildApp({ repo })
    const response = await finish(ctx)
    expect(response.status).toBe(200)
    expect(response.body.report).toEqual({ marker: 'race-report' })
  })

  it('returns identical not-found responses for a wrong owner and an unknown or invalid id', async () => {
    const ctx = buildApp({ sessions: [makeSession()] })
    const wrongOwner = await finish(ctx, SESSION_ID, USER_B)
    const missing = await finish(ctx, 'aaaaaaaaaaaaaaaaaaaaaaaa')
    const invalid = await finish(ctx, 'abc')
    expect(wrongOwner.status).toBe(404)
    expect(wrongOwner.body).toEqual(missing.body)
    expect(wrongOwner.body).toEqual(invalid.body)
  })

  it('returns 404 if the session scenario is missing', async () => {
    const ctx = buildApp({
      sessions: [makeSession({ scenarioId: 'retired-scenario' })],
      scenarioStore: { getById: () => undefined },
    })
    const response = await finish(ctx)
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it('does not log user messages or report contents', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = buildApp({ sessions: [makeSession({ messages: [
      { role: 'user', text: 'UNIQUE_FINISH_PRIVATE_MESSAGE', stageIndex: 0 },
    ] })] })
    const response = await finish(ctx)
    expect(response.status).toBe(200)
    const output = [...log.mock.calls, ...error.mock.calls].flat().map(String).join(' ')
    expect(output).not.toContain('UNIQUE_FINISH_PRIVATE_MESSAGE')
    expect(output).not.toContain(JSON.stringify(response.body.report))
  })
})
