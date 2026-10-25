import { describe, expect, it } from 'vitest'
import { loginSchema, registerSchema } from '../routes/auth.js'

describe('auth request schemas', () => {
  const validRegistration = { name: 'Ab', email: ' TEST@EXAMPLE.COM ', password: '12345678' }

  it('validates password character and byte limits', () => {
    expect(registerSchema.safeParse({ ...validRegistration, password: '1234567' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegistration, password: 'a'.repeat(72) }).success).toBe(true)
    expect(registerSchema.safeParse({ ...validRegistration, password: 'a'.repeat(73) }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegistration, password: 'ሀ'.repeat(30) }).success).toBe(false)
  })

  it('normalizes email and validates name and mutually exclusive organization fields', () => {
    expect(registerSchema.parse(validRegistration).email).toBe('test@example.com')
    expect(registerSchema.safeParse({ ...validRegistration, name: 'A' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...validRegistration, joinCode: 'ABC123', orgName: 'Org' }).success).toBe(false)
  })

  it('rejects an empty login password', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false)
  })
})
