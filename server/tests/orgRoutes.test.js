import { describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createOrgRouter } from '../routes/org.js'
import { AppError } from '../utils/errors.js'

function fakeRequireAuth(req, _res, next) {
  req.user = { role: req.get('x-test-role') }
  req.org = req.get('x-test-noorg')
    ? null
    : { _id: 'org1', name: 'Test Org', joinCode: 'ABC234' }
  next()
}

function createFakeModel(docs) {
  const calls = { find: [], select: [] }
  return {
    calls,
    find(filter) {
      calls.find.push(filter)
      return {
        select(fields) {
          calls.select.push(fields)
          return {
            lean: async () => docs,
          }
        },
      }
    },
  }
}

function tinyOrgApp({ employees = [], sessions = [], scenarioIds = [], UserModel, OrgModel, now } = {}) {
  const users = UserModel ?? createFakeModel(employees)
  const SessionModel = createFakeModel(sessions)
  const app = express()
  app.use('/api/org', createOrgRouter({
    requireAuth: fakeRequireAuth,
    UserModel: users,
    SessionModel,
    OrgModel,
    store: { getAll: () => scenarioIds.map(id => ({ id })) },
    getScenarioTitle: (id) => `Title ${id}`,
    getCheckpointDescription: () => ({ en: 'The user can report the caller', am: 'ሪፖርት' }),
    now: now ?? (() => new Date('2026-03-04T12:00:00.000Z')),
  }))
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      const body = { error: { code: err.code, message: err.message } }
      if (err.details !== undefined) body.error.details = err.details
      return res.status(err.status).json(body)
    }
    return res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred.' },
    })
  })
  return { app, UserModel: users, SessionModel }
}

describe('GET /api/org/summary', () => {
  it('returns 403 FORBIDDEN for an employee', async () => {
    const { app, UserModel } = tinyOrgApp()
    const res = await request(app).get('/api/org/summary').set('x-test-role', 'employee')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
    expect(UserModel.calls.find).toEqual([])
  })

  it('returns 403 FORBIDDEN for an individual', async () => {
    const { app } = tinyOrgApp()
    const res = await request(app).get('/api/org/summary').set('x-test-role', 'individual')
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 200 with the org summary shape for an orgAdmin', async () => {
    const finishedAt = '2026-02-01T00:00:00.000Z'
    const { app, UserModel, SessionModel } = tinyOrgApp({
      employees: [{ _id: 'emp1', name: 'Ada' }],
      sessions: [{
        userId: 'emp1',
        scenarioId: 'phish-1',
        language: 'en',
        score: 80,
        band: 'strong',
        finishedAt,
      }],
    })

    const res = await request(app).get('/api/org/summary').set('x-test-role', 'orgAdmin')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toEqual({
      org: { name: 'Test Org', joinCode: 'ABC234' },
      averageScore: 80,
      completedSessions: 1,
      employeeCount: 1,
      employees: [{
        id: 'emp1',
        name: 'Ada',
        sessionsCompleted: 1,
        averageScore: 80,
        lastActivity: finishedAt,
        sessions: [{
          scenarioId: 'phish-1',
          scenarioTitle: 'Title phish-1',
          score: 80,
          band: 'strong',
          finishedAt,
        }],
      }],
      scoreDistribution: { vulnerable: 0, partial: 0, resilient: 0, strong: 1 },
      byScenario: [{ scenarioId: 'phish-1', scenarioTitle: 'Title phish-1', completed: 1, averageScore: 80 }],
      trend: [
        { weekStart: '2026-01-12', completed: 0, averageScore: null },
        { weekStart: '2026-01-19', completed: 0, averageScore: null },
        { weekStart: '2026-01-26', completed: 1, averageScore: 80 },
        { weekStart: '2026-02-02', completed: 0, averageScore: null },
        { weekStart: '2026-02-09', completed: 0, averageScore: null },
        { weekStart: '2026-02-16', completed: 0, averageScore: null },
        { weekStart: '2026-02-23', completed: 0, averageScore: null },
        { weekStart: '2026-03-02', completed: 0, averageScore: null },
      ],
      weakSpots: [],
      improvement: null,
    })

    expect(UserModel.calls.find).toEqual([{ orgId: 'org1', role: 'employee' }])
    expect(SessionModel.calls.find[0]).toMatchObject({
      orgId: 'org1',
      status: 'finished',
      userId: { $in: ['emp1'] },
    })
    const sessionSelect = SessionModel.calls.select[0]
    expect(typeof sessionSelect).toBe('string')
    expect(sessionSelect).toContain('score')
    expect(sessionSelect).toContain('checkpointSummary')
    expect(sessionSelect).not.toContain('messages')
    expect(sessionSelect).not.toContain('report')
  })

  it('includes scenarios from the store even before employees complete them', async () => {
    const { app } = tinyOrgApp({
      employees: [{ _id: 'emp1', name: 'Ada' }],
      sessions: [{
        userId: 'emp1',
        scenarioId: 'played',
        language: 'en',
        score: 60,
        band: 'partial',
        finishedAt: '2026-03-01T00:00:00.000Z',
      }],
      scenarioIds: ['played', 'new-scenario'],
    })
    const res = await request(app).get('/api/org/summary').set('x-test-role', 'orgAdmin')
    expect(res.status).toBe(200)
    expect(res.body.byScenario).toEqual([
      { scenarioId: 'new-scenario', scenarioTitle: 'Title new-scenario', completed: 0, averageScore: null },
      { scenarioId: 'played', scenarioTitle: 'Title played', completed: 1, averageScore: 60 },
    ])
  })

  it('excludes the admin and drops private keys even when checkpoint text says report', async () => {
    const finishedAt = '2026-02-10T00:00:00.000Z'
    const checkpointSummary = [{ id: 'leak', status: 'failed' }]
    const { app } = tinyOrgApp({
      employees: [{ _id: 'emp1', name: 'Ada' }],
      sessions: [
        { userId: 'emp1', scenarioId: 'phish-1', language: 'en', score: 10, band: 'vulnerable', finishedAt, checkpointSummary, messages: [{ text: 'secret' }], report: { evidence: 'quote' } },
        { userId: 'emp1', scenarioId: 'phish-1', language: 'en', score: 20, band: 'vulnerable', finishedAt, checkpointSummary },
        { userId: 'emp1', scenarioId: 'phish-1', language: 'en', score: 30, band: 'vulnerable', finishedAt, checkpointSummary },
        { userId: 'admin', scenarioId: 'phish-1', language: 'en', score: 0, band: 'vulnerable', finishedAt, checkpointSummary },
      ],
    })
    const res = await request(app).get('/api/org/summary').set('x-test-role', 'orgAdmin')
    expect(res.status).toBe(200)
    expect(res.body.completedSessions).toBe(3)
    expect(res.body.averageScore).toBe(20)
    expect(res.body.weakSpots[0]).toMatchObject({
      checkpointId: 'leak',
      description: { en: 'The user can report the caller', am: 'ሪፖርት' },
      passRate: 0,
      sample: 3,
    })
    const names = new Set()
    const walk = (value) => {
      if (!value || typeof value !== 'object') return
      for (const key of Object.keys(value)) {
        names.add(key)
        walk(value[key])
      }
    }
    walk(res.body)
    for (const forbidden of ['messages', 'report', 'feedback', 'evidence', 'transcript', 'email', 'userId']) {
      expect(names.has(forbidden)).toBe(false)
    }
  })

  it('returns 404 when an orgAdmin has no org', async () => {
    const { app, UserModel, SessionModel } = tinyOrgApp()
    const res = await request(app)
      .get('/api/org/summary')
      .set('x-test-role', 'orgAdmin')
      .set('x-test-noorg', '1')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
    expect(UserModel.calls.find).toEqual([])
    expect(SessionModel.calls.find).toEqual([])
  })
})

const EMPLOYEE_ID = '507f1f77bcf86cd799439011'

function notFoundBody() {
  return { error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } }
}

describe('POST /api/org/rotate-code', () => {
  it('returns 403 for an employee and an individual', async () => {
    for (const role of ['employee', 'individual']) {
      const { app } = tinyOrgApp()
      const res = await request(app).post('/api/org/rotate-code').set('x-test-role', role)
      expect(res.status).toBe(403)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.body.error.code).toBe('FORBIDDEN')
    }
  })

  it('saves a new code after a duplicate-key retry and returns only that code', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { code: 11000 })
    const calls = []
    const OrgModel = {
      async findOneAndUpdate(filter, update) {
        calls.push({ filter, update })
        if (calls.length === 1) throw duplicate
        return { _id: filter._id, joinCode: update.$set.joinCode }
      },
    }
    const { app } = tinyOrgApp({ OrgModel })
    const res = await request(app).post('/api/org/rotate-code').set('x-test-role', 'orgAdmin')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(calls).toHaveLength(2)
    expect(calls[0].filter).toEqual({ _id: 'org1' })
    expect(calls[1].update.$set.joinCode).toHaveLength(6)
    expect(calls[1].update.$set.joinCode).not.toBe('ABC234')
    expect(res.body).toEqual({ joinCode: calls[1].update.$set.joinCode })
  })

  it('returns 404 when the admin has no org', async () => {
    const { app } = tinyOrgApp()
    const res = await request(app).post('/api/org/rotate-code').set('x-test-role', 'orgAdmin').set('x-test-noorg', '1')
    expect(res.status).toBe(404)
    expect(res.body).toEqual(notFoundBody())
  })
})

describe('DELETE /api/org/employees/:id', () => {
  function userModel(result) {
    const calls = []
    return {
      calls,
      find() {
        return { select: () => ({ lean: async () => [] }) }
      },
      async findOneAndUpdate(filter, update) {
        calls.push({ filter, update })
        return result
      },
    }
  }

  it('returns 403 for an employee and an individual', async () => {
    for (const role of ['employee', 'individual']) {
      const { app } = tinyOrgApp()
      const res = await request(app).delete(`/api/org/employees/${EMPLOYEE_ID}`).set('x-test-role', role)
      expect(res.status).toBe(403)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(res.body.error.code).toBe('FORBIDDEN')
    }
  })

  it('clears the org and role for an employee in this org', async () => {
    const UserModel = userModel({ _id: EMPLOYEE_ID })
    const { app } = tinyOrgApp({ UserModel })
    const res = await request(app).delete(`/api/org/employees/${EMPLOYEE_ID}`).set('x-test-role', 'orgAdmin')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.body).toEqual({ ok: true })
    expect(UserModel.calls).toEqual([{
      filter: { _id: EMPLOYEE_ID, orgId: 'org1', role: 'employee' },
      update: { $set: { orgId: null, role: 'individual' } },
    }])
  })

  it('returns the same 404 for an unknown id, a non-employee, and an invalid id', async () => {
    const unknown = userModel(null)
    const unknownRes = await request(tinyOrgApp({ UserModel: unknown }).app)
      .delete(`/api/org/employees/${EMPLOYEE_ID}`)
      .set('x-test-role', 'orgAdmin')
    const invalid = userModel({ _id: 'should-not-update' })
    const invalidRes = await request(tinyOrgApp({ UserModel: invalid }).app)
      .delete('/api/org/employees/abc')
      .set('x-test-role', 'orgAdmin')
    const missingOrg = await request(tinyOrgApp().app)
      .delete(`/api/org/employees/${EMPLOYEE_ID}`)
      .set('x-test-role', 'orgAdmin')
      .set('x-test-noorg', '1')

    expect(unknownRes.status).toBe(404)
    expect(invalidRes.status).toBe(404)
    expect(missingOrg.status).toBe(404)
    expect(unknownRes.body).toEqual(notFoundBody())
    expect(invalidRes.body).toEqual(unknownRes.body)
    expect(missingOrg.body).toEqual(unknownRes.body)
    expect(unknown.calls[0].filter).toEqual({ _id: EMPLOYEE_ID, orgId: 'org1', role: 'employee' })
    expect(invalid.calls).toEqual([])
  })
})
