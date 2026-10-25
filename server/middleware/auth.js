import User from '../models/User.js'
import Org from '../models/Org.js'
import { unauthorized, forbidden } from '../utils/errors.js'
import { verifyToken } from '../utils/token.js'
import asyncHandler from '../utils/asyncHandler.js'

export function createRequireAuth({ jwtSecret, UserModel = User, OrgModel = Org }) {
  return asyncHandler(async (req, _res, next) => {
    const header = req.get?.('authorization') ?? req.headers?.authorization
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return next(unauthorized())
    }

    let payload
    try {
      payload = verifyToken(header.slice(7), jwtSecret)
    } catch {
      return next(unauthorized())
    }

    if (typeof payload?.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) {
      return next(unauthorized())
    }

    let user
    try {
      user = await UserModel.findById(payload.sub)
    } catch {
      return next(unauthorized())
    }
    if (!user) return next(unauthorized())

    let org = null
    if (user.orgId) {
      try {
        org = await OrgModel.findById(user.orgId)
      } catch (err) {
        return next(err)
      }
    }

    req.user = user
    req.org = org ?? null
    return next()
  })
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) return next(forbidden())
    return next()
  }
}
