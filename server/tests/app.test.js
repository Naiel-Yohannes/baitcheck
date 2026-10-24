/**
 * server/tests/app.test.js
 * Integration tests for the Express app using supertest.
 * No database, no network — uses a fake config object.
 */
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'

// ── Fake config (no real secrets, no DB) ──────────────────────────
const fakeConfig = {
  clientOrigins: ['http://localhost:5173'],
}

const app = createApp(fakeConfig)

// ── Tests ─────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  it('returns 200 with { ok: true }', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describe('unknown route', () => {
  it('returns 404 with code NOT_FOUND', async () => {
    const res = await request(app).get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('malformed JSON body', () => {
  it('returns 400 with code VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{ this is not json }')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('oversized body', () => {
  it('returns 400 with code VALIDATION_ERROR when body exceeds 10 kb', async () => {
    // 11 kB of JSON  — over the 10 kb limit
    const bigValue = 'x'.repeat(11 * 1024)
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ data: bigValue }))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})
