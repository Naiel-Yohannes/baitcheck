import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../app.js'
import { loginSchema, registerSchema } from '../routes/auth.js'

describe('auth request schemas', () => {
  const validRegistration = { name: 'Ab', email: ' TEST@EXAMPLE.COM ', password: 'Abcdef1!' }

  it('validates password character and byte limits', () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: 'Abcdef1' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegistration, password: `Abcdef1!${'a'.repeat(64)}` }).success).toBe(true)
    expect(registerSchema.safeParse({ ...validRegistration, password: `Abcdef1!${'a'.repeat(65)}` }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegistration, password: 'ሀ'.repeat(30) }).success).toBe(false)
  })

  it('normalizes email and validates name and mutually exclusive organization fields', () => {
    expect(registerSchema.parse(validRegistration).email).toBe('test@example.com')
    expect(registerSchema.safeParse({ ...validRegistration, name: 'A' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegistration, joinCode: 'ABC123', orgName: 'Org' }).success).toBe(false)
  })

  it('rejects an empty login password', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'password' }).success).toBe(true)
  })

  it('returns password policy issues as validation details on registration', async () => {
    const app = createApp({ clientOrigins: [], JWT_SECRET: 'test-secret' })
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test-user@example.com', password: 'Abcdefg1' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(response.body.error.details).toEqual([
      { field: 'password', issue: 'PASSWORD_NEEDS_SYMBOL' },
    ])
  })
})
