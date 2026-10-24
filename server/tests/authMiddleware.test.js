import { describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import { createRequireAuth, requireRole } from '../middleware/auth.js'
import { signToken } from '../utils/token.js'

const secret = 'test-secret-that-is-long-enough-for-tests'
const id = '507f1f77bcf86cd799439011'

function invoke(middleware, authorization) {
  const req = { headers: authorization === undefined ? {} : { authorization } }
  const res = {}
  let passedError
  const next = vi.fn(err => { passedError = err })
  const done = middleware(req, res, next)
  return Promise.resolve(done).then(() => ({ req, next, error: passedError }))
}

describe('auth middleware', () => {
  it('returns the same unauthorized error for missing, malformed, expired, and unknown-user credentials', async () => {
    const UserModel = { findById: vi.fn().mockResolvedValue(null) }
    const middleware = createRequireAuth({ jwtSecret: secret, UserModel, OrgModel: {} })
    const expired = jwt.sign({ sub: id }, secret, { algorithm: 'HS256', expiresIn: -1 })
    const cases = [
      await invoke(middleware, undefined),
      await invoke(middleware, 'Basic abc'),
      await invoke(middleware, 'Bearer garbage'),
      await invoke(middleware, `Bearer ${expired}`),
      await invoke(middleware, `Bearer ${signToken(id, secret)}`),
    ]
    expect(cases.map(result => [result.error?.status, result.error?.code])).toEqual(
      Array(5).fill([401, 'UNAUTHORIZED']),
    )
  })

  it('loads user and org each request and ignores token roles', async () => {
    const user = { _id: id, role: 'employee', orgId: '507f191e810c19729de860ea' }
    const org = { _id: user.orgId, name: 'Org' }
    const UserModel = { findById: vi.fn().mockResolvedValue(user) }
    const OrgModel = { findById: vi.fn().mockResolvedValue(org) }
    const middleware = createRequireAuth({ jwtSecret: secret, UserModel, OrgModel })
    const token = signToken(id, secret)
    const privilegedToken = jwt.sign({ sub: id, role: 'orgAdmin' }, secret, { algorithm: 'HS256' })
    const result = await invoke(middleware, `Bearer ${privilegedToken}`)
    expect(result.error).toBeUndefined()
    expect(result.req.user).toBe(user)
    expect(result.req.org).toBe(org)
    expect(UserModel.findById).toHaveBeenCalledWith(id)
    expect(OrgModel.findById).toHaveBeenCalledWith(user.orgId)
  })

  it('requires one of the allowed roles', () => {
    const next = vi.fn()
    requireRole('orgAdmin')({ user: { role: 'orgAdmin' } }, {}, next)
    expect(next).toHaveBeenCalledWith()
    const deniedNext = vi.fn()
    requireRole('orgAdmin')({ user: { role: 'employee' } }, {}, deniedNext)
    expect(deniedNext.mock.calls[0][0]).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })
})
