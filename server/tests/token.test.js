import { describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'
import { signToken, verifyToken } from '../utils/token.js'

const secret = 'test-secret-that-is-long-enough-for-tests'

describe('token utilities', () => {
  it('round trips a user id with only standard claims', () => {
    const token = signToken('507f1f77bcf86cd799439011', secret)
    const payload = verifyToken(token, secret)
    expect(payload).toMatchObject({ sub: '507f1f77bcf86cd799439011' })
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub'])
  })

  it('rejects a wrong secret and expired tokens', () => {
    const token = signToken('507f1f77bcf86cd799439011', secret)
    expect(() => verifyToken(token, 'wrong-secret')).toThrow()
    const expired = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, secret, { algorithm: 'HS256', expiresIn: -1 })
    expect(() => verifyToken(expired, secret)).toThrow()
  })

  it('rejects an alg none token', () => {
    const token = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: '507f1f77bcf86cd799439011' })).toString('base64url')}.`
    expect(() => verifyToken(token, secret)).toThrow()
  })
})
