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

function tinyOrgApp({ employees = [], sessions = [] } = {}) {
  const UserModel = createFakeModel(employees)
  const SessionModel = createFakeModel(sessions)
  const app = express()
  app.use('/api/org', createOrgRouter({
    requireAuth: fakeRequireAuth,
    UserModel,
    SessionModel,
    getScenarioTitle: (id) => `Title ${id}`,
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
  return { app, UserModel, SessionModel }
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
    expect(sessionSelect).not.toContain('messages')
    expect(sessionSelect).not.toContain('report')
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
