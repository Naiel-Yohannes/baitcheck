import { Router } from 'express'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { z } from 'zod'
import User from '../models/User.js'
import Org from '../models/Org.js'
import { createOrgWithUniqueCode } from '../utils/joinCode.js'
import { toUserResponse } from '../utils/userResponse.js'
import { signToken } from '../utils/token.js'
import { createRequireAuth } from '../middleware/auth.js'
import { AppError, emailTaken, invalidCredentials } from '../utils/errors.js'
import asyncHandler from '../utils/asyncHandler.js'

const optionalTrimmed = z.string().trim().transform(value => value || undefined).optional()

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Password must be at most 72 bytes.',
  }),
  joinCode: optionalTrimmed,
  orgName: optionalTrimmed,
}).superRefine((body, ctx) => {
  if (body.joinCode && body.orgName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['joinCode'],
      message: 'Provide either a join code or an organization name, not both.',
    })
  }
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
})

const DUMMY_PASSWORD_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

export function createAuthRouter(config, requireAuth = createRequireAuth({ jwtSecret: config.JWT_SECRET })) {
  const router = Router()

  router.post('/register', asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body)
    if (await User.findOne({ email: body.email })) throw emailTaken()

    let org = null
    if (body.joinCode) {
      org = await Org.findOne({ joinCode: body.joinCode.toUpperCase() })
      if (!org) throw new AppError(400, 'INVALID_JOIN_CODE', 'The organization join code is invalid.')
    }

    const passwordHash = await bcrypt.hash(body.password, 10)
    let createdOrg = false
    let userId
    if (body.orgName) {
      userId = new mongoose.Types.ObjectId()
      org = await createOrgWithUniqueCode({ name: body.orgName, createdBy: userId })
      createdOrg = true
    }

    let user
    try {
      const role = body.orgName ? 'orgAdmin' : body.joinCode ? 'employee' : 'individual'
      user = await User.create({
        ...(userId ? { _id: userId } : {}),
        name: body.name,
        email: body.email,
        passwordHash,
        role,
        orgId: org?._id ?? null,
      })
    } catch (err) {
      if (createdOrg && org) await Org.deleteOne({ _id: org._id })
      if (err?.code === 11000 && (err.keyPattern?.email || err.keyValue?.email)) throw emailTaken()
      throw err
    }

    const response = {
      token: signToken(user._id, config.JWT_SECRET),
      user: toUserResponse(user, org),
    }
    if (body.orgName) response.joinCode = org.joinCode
    return res.status(201).json(response)
  }))

  router.post('/login', asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body)
    const user = await User.findOne({ email: body.email }).select('+passwordHash')
    if (!user) {
      await bcrypt.compare(body.password, DUMMY_PASSWORD_HASH)
      throw invalidCredentials()
    }
    if (!(await bcrypt.compare(body.password, user.passwordHash))) throw invalidCredentials()

    const org = user.orgId ? await Org.findById(user.orgId) : null
    return res.json({
      token: signToken(user._id, config.JWT_SECRET),
      user: toUserResponse(user, org),
    })
  }))

  router.get('/me', requireAuth, (req, res) => {
    return res.json({ user: toUserResponse(req.user, req.org) })
  })

  return router
}
