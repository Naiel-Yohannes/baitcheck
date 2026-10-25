import { afterEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import { ZodError } from 'zod'
import { loadScenarios } from '../scenarios/loadScenarios.js'
import { createSessionsRouter } from '../routes/sessions.js'
import { createFakeAi } from '../engine/fakeAi.js'
import { AppError, notFound, validationError } from '../utils/errors.js'
import { sanitizeOutput } from '../engine/safety.js'

const USER_A = '507f1f77bcf86cd799439011'
const USER_B = '507f1f77bcf86cd799439012'
const ORG_ID = '507f191e810c19729de860ea'
const MISSING_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const SCENARIO_ID = 'mobile-money-call'

const store = await loadScenarios(fileURLToPath(new URL('../scenarios/', import.meta.url)))
const scenario = store.getById(SCENARIO_ID)
const openingEn = sanitizeOutput(scenario.openingLine.en, scenario, 'en')

function isValidObjectId(id) {
  return typeof id === 'string' && mongoose.isValidObjectId(id) && /^[a-fA-F0-9]{24}$/.test(id)
}

function countingLimiter() {
  const limiter = (req, _res, next) => {
    limiter.calls += 1
    next()
  }
  limiter.calls = 0
  return limiter
}

function createMemoryRepo() {
  const documents = new Map()
  let createdAtSeq = 0
  const repo = {
    documents,
    failNextAppend: false,
    async create(data) {
      const id = new mongoose.Types.ObjectId().toString()
      const doc = {
        ...data,
        _id: id,
        id,
        userId: data.userId != null ? String(data.userId) : data.userId,
        orgId: data.orgId == null ? null : String(data.orgId),
        messages: (data.messages ?? []).map(message => ({ ...message })),
        createdAt: data.createdAt ?? new Date(Date.now() + (++createdAtSeq)),
        finishedAt: data.finishedAt ?? null,
      }
      documents.set(id, doc)
      return structuredClone(doc)
    },
    async findOwned(id, userId) {
      if (!isValidObjectId(id)) return null
      const doc = documents.get(String(id))
      if (!doc || String(doc.userId) !== String(userId)) return null
      return structuredClone(doc)
    },
    async listMine(userId, limit = 50) {
      return [...documents.values()]
        .filter(doc => String(doc.userId) === String(userId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map(doc => ({
          id: doc.id,
          _id: doc._id,
          scenarioId: doc.scenarioId,
          language: doc.language,
          status: doc.status,
          score: doc.score,
          band: doc.band,
          createdAt: doc.createdAt,
          finishedAt: doc.finishedAt,
        }))
    },
    async appendTurn({ id, userId, expectedTurnCount, userMessage, attackerMessage, turnCount, stageIndex, endReason }) {
      if (repo.failNextAppend) {
        repo.failNextAppend = false
        return null
      }
      const doc = documents.get(String(id))
      if (!doc) return null
      if (String(doc.userId) !== String(userId)) return null
      if (doc.status !== 'active') return null
      if (doc.turnCount !== expectedTurnCount) return null
      if (doc.endReason != null) return null
      doc.messages.push({ ...userMessage }, { ...attackerMessage })
      doc.turnCount = turnCount
      doc.stageIndex = stageIndex
      if (endReason) doc.endReason = endReason
      return structuredClone(doc)
    },
  }
  return repo
}

function fakeRequireAuth(req, _res, next) {
  req.user = {
    _id: req.get('x-test-user'),
    orgId: req.get('x-test-org') ?? null,
  }
  next()
}

function errorHandler(err, _req, res, _next) {
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
  console.error(`Unhandled error: ${err.name ?? 'UnknownError'}`)
  return res.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred.' },
  })
}

function buildApp(overrides = {}) {
  const repo = overrides.repo ?? createMemoryRepo()
  const startSessionLimiter = countingLimiter()
  const messageLimiter = countingLimiter()
  const finishLimiter = countingLimiter()
  const app = express()
  app.use(express.json())
  app.use('/api/sessions', createSessionsRouter({
    requireAuth: fakeRequireAuth,
    rateLimits: { startSessionLimiter, messageLimiter, finishLimiter },
    store: overrides.store ?? store,
    ai: overrides.ai ?? createFakeAi(),
    repo,
  }))
  app.use((_req, _res, next) => next(notFound()))
  app.use(errorHandler)
  return { app, repo, startSessionLimiter, messageLimiter }
}

function asUser(req, userId = USER_A, orgId) {
  req.set('x-test-user', userId)
  if (orgId !== undefined) req.set('x-test-org', orgId)
  return req
}

async function startSession(app, { userId = USER_A, orgId, language = 'en', scenarioId = SCENARIO_ID } = {}) {
  const req = asUser(request(app).post('/api/sessions'), userId, orgId)
  return req.send({ scenarioId, language })
}

describe('POST /api/sessions', () => {
  it('returns the 201 start shape, stores the opening line, copies orgId, and calls the start limiter', async () => {
    const { app, repo, startSessionLimiter } = buildApp()
    const res = await startSession(app, { orgId: ORG_ID })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({
      sessionId: res.body.sessionId,
      scenarioId: SCENARIO_ID,
      scenarioTitle: scenario.title.en,
      language: 'en',
      channel: 'call',
      persona: {
        userRole: scenario.persona.userRole.en,
        fakeData: scenario.persona.fakeData.map(({ key, label, value }) => ({
          key,
          label: label.en,
          value,
        })),
      },
      firstMessage: openingEn,
      maxTurns: 10,
      turnCount: 0,
    })
    expect(Object.keys(res.body).sort()).toEqual([
      'channel', 'firstMessage', 'language', 'maxTurns', 'persona',
      'scenarioId', 'scenarioTitle', 'sessionId', 'turnCount',
    ].sort())

    const saved = await repo.findOwned(res.body.sessionId, USER_A)
    expect(saved.orgId).toBe(ORG_ID)
    expect(saved.messages[0]).toMatchObject({
      role: 'attacker',
      text: openingEn,
      stageIndex: 0,
    })
    expect(startSessionLimiter.calls).toBe(1)
  })

  it('returns 404 for an unknown scenarioId', async () => {
    const { app } = buildApp()
    const res = await startSession(app, { scenarioId: 'does-not-exist' })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 400 VALIDATION_ERROR when the scenario does not list the language', async () => {
    const { app } = buildApp({
      store: {
        getById(id) {
          const found = store.getById(id)
          return found ? { ...found, languages: ['en'] } : found
        },
        getTitle: store.getTitle.bind(store),
      },
    })
    const res = await startSession(app, { language: 'am' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details).toEqual([{ field: 'language', issue: 'not supported' }])
  })
})

describe('GET /api/sessions/:id and /mine', () => {
  it('returns the owner the full session shape with only role and text in messages', async () => {
    const { app } = buildApp()
    const started = await startSession(app)
    const res = await asUser(request(app).get(`/api/sessions/${started.body.sessionId}`))
    expect(res.status).toBe(200)
    expect(res.body.session).toMatchObject({
      id: started.body.sessionId,
      scenarioId: SCENARIO_ID,
      scenarioTitle: scenario.title.en,
      language: 'en',
      channel: 'call',
      status: 'active',
      turnCount: 0,
      maxTurns: 10,
      stageIndex: 0,
      persona: started.body.persona,
      report: null,
    })
    expect(res.body.session.messages).toEqual([{ role: 'attacker', text: openingEn }])
    expect(Object.keys(res.body.session.messages[0]).sort()).toEqual(['role', 'text'])
  })

  it('returns the same 404 for another user and for an unknown id', async () => {
    const { app } = buildApp()
    const started = await startSession(app)
    const other = await asUser(request(app).get(`/api/sessions/${started.body.sessionId}`), USER_B)
    const unknown = await asUser(request(app).get(`/api/sessions/${MISSING_ID}`))
    expect(other.status).toBe(404)
    expect(unknown.status).toBe(404)
    expect(other.body).toEqual(unknown.body)
    expect(other.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 not 500 for an invalid id', async () => {
    const { app } = buildApp()
    const res = await asUser(request(app).get('/api/sessions/abc'))
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 200 with the fallback persona when the scenario is missing', async () => {
    const { app, repo } = buildApp()
    const created = await repo.create({
      userId: USER_A,
      orgId: null,
      scenarioId: 'retired-scenario',
      language: 'en',
      status: 'active',
      stageIndex: 0,
      turnCount: 0,
      endReason: null,
      score: null,
      band: null,
      report: { scenarioTitle: 'Legacy Title' },
      messages: [{ role: 'attacker', text: 'hello', stageIndex: 0 }],
    })
    const res = await asUser(request(app).get(`/api/sessions/${created.id}`))
    expect(res.status).toBe(200)
    expect(res.body.session.persona).toEqual({ userRole: '', fakeData: [] })
    expect(res.body.session.maxTurns).toBe(10)
    expect(res.body.session.channel).toBe('message')
    expect(res.body.session.scenarioTitle).toBe('Legacy Title')
  })

  it('lists only my sessions newest first, omits messages and report, and does not capture /mine as /:id', async () => {
    const { app } = buildApp()
    const first = await startSession(app)
    const second = await startSession(app)
    await startSession(app, { userId: USER_B })

    const res = await asUser(request(app).get('/api/sessions/mine'))
    expect(res.status).toBe(200)
    expect(res.body.sessions.map(session => session.id)).toEqual([
      second.body.sessionId,
      first.body.sessionId,
    ])
    expect(res.body.sessions[0]).toEqual({
      id: second.body.sessionId,
      scenarioId: SCENARIO_ID,
      scenarioTitle: scenario.title.en,
      language: 'en',
      status: 'active',
      score: null,
      band: null,
      createdAt: res.body.sessions[0].createdAt,
      finishedAt: null,
    })
    const json = JSON.stringify(res.body)
    expect(json).not.toContain('"messages"')
    expect(json).not.toContain('"report"')
  })
})

describe('POST /api/sessions/:id/message', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function opened() {
    const ctx = buildApp()
    const started = await startSession(ctx.app)
    return { ...ctx, sessionId: started.body.sessionId }
  }

  async function send(ctx, text, extra = {}, userId = USER_A) {
    return asUser(
      request(ctx.app).post(`/api/sessions/${ctx.sessionId}/message`),
      userId,
    ).send({ text, ...extra })
  }

  it('stores a normal turn at the previous stage and advances on later turns', async () => {
    const ctx = await opened()
    const first = await send(ctx, 'hello')
    expect(first.status).toBe(200)
    expect(first.body).toEqual({
      reply: first.body.reply,
      stageIndex: 0,
      turnCount: 1,
      ended: false,
      warning: null,
    })
    expect(typeof first.body.reply).toBe('string')
    expect(first.body.reply.length).toBeGreaterThan(0)

    let saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.messages).toHaveLength(3)
    expect(saved.messages[1]).toMatchObject({ role: 'user', text: 'hello', stageIndex: 0 })
    expect(saved.messages[2]).toMatchObject({ role: 'attacker', stageIndex: 0, text: first.body.reply })

    const second = await send(ctx, 'still here')
    expect(second.status).toBe(200)
    expect(second.body.turnCount).toBe(2)
    expect(second.body.stageIndex).toBe(1)

    saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.messages[3]).toMatchObject({ role: 'user', text: 'still here', stageIndex: 0 })
    expect(saved.messages[4]).toMatchObject({ role: 'attacker', stageIndex: 1 })

    const third = await send(ctx, 'go on')
    expect(third.status).toBe(200)
    expect(third.body.turnCount).toBe(3)
    expect(third.body.stageIndex).toBe(1)
    expect(ctx.messageLimiter.calls).toBe(3)
  })

  it('accepts the fake OTP and blocks a real-looking phone number without saving it', async () => {
    const ctx = await opened()
    const otp = await send(ctx, '739204')
    expect(otp.status).toBe(200)
    expect(otp.body.warning).toBeNull()
    expect(otp.body.turnCount).toBe(1)

    const blocked = await send(ctx, '0911 22 33 44')
    expect(blocked.status).toBe(200)
    expect(blocked.body.reply).toBeNull()
    expect(blocked.body.ended).toBe(false)
    expect(blocked.body.turnCount).toBe(1)
    expect(blocked.body.stageIndex).toBe(0)
    expect(blocked.body.warning).toMatchObject({ code: 'LONG_DIGITS' })
    expect(blocked.body.warning.message).toBeTruthy()

    const saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.turnCount).toBe(1)
    expect(saved.messages.some(message => message.text === '0911 22 33 44')).toBe(false)
  })

  it('returns LLM errors for /503 and /502 without storing the turn, then allows a retry', async () => {
    const ctx = await opened()
    const busy = await send(ctx, '/503')
    expect(busy.status).toBe(503)
    expect(busy.body.error.code).toBe('LLM_BUSY')

    const failed = await send(ctx, '/502')
    expect(failed.status).toBe(502)
    expect(failed.body.error.code).toBe('LLM_FAILED')

    let saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.turnCount).toBe(0)
    expect(saved.messages).toHaveLength(1)

    const busyAgain = await send(ctx, '/503')
    expect(busyAgain.status).toBe(503)
    const ok = await send(ctx, 'hello after errors')
    expect(ok.status).toBe(200)
    expect(ok.body.turnCount).toBe(1)
  })

  it('ends on an end signal, stores endReason, and then returns 409', async () => {
    const ctx = await opened()
    const ended = await send(ctx, 'I will hang up now')
    expect(ended.status).toBe(200)
    expect(ended.body.ended).toBe(true)
    expect(ended.body.reply).toBeTruthy()
    expect(ended.body.warning).toBeNull()

    const saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.endReason).toBe('end_signal')
    expect(saved.status).toBe('active')

    const next = await send(ctx, 'one more')
    expect(next.status).toBe(409)
    expect(next.body.error.code).toBe('SESSION_FINISHED')
  })

  it('returns 409 when the session status is finished', async () => {
    const { app, repo } = buildApp()
    const created = await repo.create({
      userId: USER_A,
      orgId: null,
      scenarioId: SCENARIO_ID,
      language: 'en',
      status: 'finished',
      stageIndex: 0,
      turnCount: 1,
      endReason: 'user_button',
      score: 10,
      band: 'fair',
      report: null,
      messages: [],
    })
    const res = await asUser(request(app).post(`/api/sessions/${created.id}/message`))
      .send({ text: 'hello' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('SESSION_FINISHED')
  })

  it('returns 400 VALIDATION_ERROR for empty, whitespace, too-long, and non-string text', async () => {
    const ctx = await opened()
    const cases = [
      { text: '' },
      { text: '   ' },
      { text: 'x'.repeat(501) },
      { text: 12 },
    ]
    for (const body of cases) {
      const res = await asUser(request(ctx.app).post(`/api/sessions/${ctx.sessionId}/message`)).send(body)
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    }
    const saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.turnCount).toBe(0)
    expect(saved.messages).toHaveLength(1)
  })

  it('ignores client-supplied stageIndex, ended, turnCount, endReason and score', async () => {
    const ctx = await opened()
    const res = await send(ctx, 'hello', {
      stageIndex: 3,
      ended: true,
      turnCount: 9,
      endReason: 'max_turns',
      score: 0,
    })
    expect(res.status).toBe(200)
    expect(res.body.stageIndex).toBe(0)
    expect(res.body.turnCount).toBe(1)
    expect(res.body.ended).toBe(false)
    const saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.stageIndex).toBe(0)
    expect(saved.turnCount).toBe(1)
    expect(saved.endReason).toBeNull()
    expect(saved.score).toBeNull()
  })

  it('returns 429 RATE_LIMITED when a stale expectedTurnCount loses the atomic update', async () => {
    const ctx = await opened()
    ctx.repo.failNextAppend = true
    const res = await send(ctx, 'hello')
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    const saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.turnCount).toBe(0)
  })

  it('returns 404 for another user\'s session', async () => {
    const ctx = await opened()
    const res = await send(ctx, 'hello', {}, USER_B)
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('sanitizes attacker replies that contain a URL or a long digit run', async () => {
    const ctx = buildApp({
      ai: {
        async generateReply() {
          return 'Visit https://evil.example/phish and call 091122334455'
        },
      },
    })
    const started = await startSession(ctx.app)
    ctx.sessionId = started.body.sessionId
    const res = await send(ctx, 'hello')
    expect(res.status).toBe(200)
    expect(res.body.reply).not.toMatch(/https?:\/\//i)
    expect(res.body.reply).not.toMatch(/\d{6,}/)
    const saved = await ctx.repo.findOwned(ctx.sessionId, USER_A)
    expect(saved.messages.at(-1).text).toBe(res.body.reply)
  })

  it('does not log message text', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = await opened()
    const secret = 'UNIQUE_PAYLOAD_DO_NOT_LOG'
    await send(ctx, secret)
    await send(ctx, '0911 22 33 44')
    await send(ctx, '/503')
    const output = [...log.mock.calls, ...error.mock.calls].flat().map(String).join(' ')
    expect(output).not.toContain(secret)
    expect(output).not.toContain('0911 22 33 44')
    expect(output).not.toContain('/503')
  })
})
