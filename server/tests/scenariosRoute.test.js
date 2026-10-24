import { describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createScenariosRouter } from '../routes/scenarios.js'

const scenario = {
  id: 'sample',
  title: { en: 'Sample', am: 'ምሳሌ' },
  description: { en: 'Description', am: 'መግለጫ' },
  languages: ['en', 'am'],
  channel: 'call',
  estimatedMinutes: 3,
}

function app() {
  const server = express()
  const requireAuth = (req, res, next) => {
    if (req.get('x-test-auth') !== 'yes') return res.status(401).json({ error: 'unauthorized' })
    return next()
  }
  server.use('/api/scenarios', createScenariosRouter({
    requireAuth,
    store: { listPublic: () => [scenario] },
  }))
  return server
}

describe('scenarios route', () => {
  it('requires authentication', async () => {
    expect((await request(app()).get('/api/scenarios')).status).toBe(401)
  })

  it('returns the public scenarios shape when authenticated', async () => {
    const response = await request(app()).get('/api/scenarios').set('x-test-auth', 'yes')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ scenarios: [scenario] })
  })
})
