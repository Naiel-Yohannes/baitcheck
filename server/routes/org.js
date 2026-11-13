import mongoose from 'mongoose'
import { Router } from 'express'
import User from '../models/User.js'
import Session from '../models/Session.js'
import Org from '../models/Org.js'
import { requireRole } from '../middleware/auth.js'
import { notFound } from '../utils/errors.js'
import asyncHandler from '../utils/asyncHandler.js'
import { rotateOrgJoinCode } from '../utils/joinCode.js'
import { buildOrgSummary } from '../utils/orgSummary.js'

function isObjectId(id) {
  return typeof id === 'string' && mongoose.isValidObjectId(id) && /^[a-f\d]{24}$/i.test(id)
}

function descriptionFromStore(store, scenarioId, checkpointId) {
  const checkpoint = store?.getById?.(scenarioId)?.checkpoints?.find(item => item?.id === checkpointId)
  const description = checkpoint?.description
  if (!description || typeof description.en !== 'string' || typeof description.am !== 'string') return null
  return { en: description.en, am: description.am }
}

function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
}

export function createOrgRouter({
  requireAuth,
  UserModel = User,
  SessionModel = Session,
  OrgModel = Org,
  getScenarioTitle = (id) => id,
  getCheckpointDescription,
  store,
  now = () => new Date(),
}) {
  const router = Router()
  const describeCheckpoint = getCheckpointDescription
    ?? ((scenarioId, checkpointId) => descriptionFromStore(store, scenarioId, checkpointId))

  router.get(
    '/summary',
    requireAuth,
    requireRole('orgAdmin'),
    asyncHandler(async (req, res, next) => {
      if (!req.org) return next(notFound())

      const employeeDocs = await UserModel.find({ orgId: req.org._id, role: 'employee' })
        .select('name')
        .lean()

      const employeeIds = employeeDocs.map(doc => doc._id)
      const sessionDocs = await SessionModel.find({
        orgId: req.org._id,
        status: 'finished',
        userId: { $in: employeeIds },
      })
        .select('userId scenarioId language score band finishedAt checkpointSummary')
        .lean()

      const summary = buildOrgSummary({
        org: { name: req.org.name, joinCode: req.org.joinCode },
        employees: employeeDocs.map(doc => ({
          id: String(doc._id),
          name: doc.name,
        })),
        sessions: sessionDocs.map(doc => ({
          userId: String(doc.userId),
          scenarioId: doc.scenarioId,
          language: doc.language,
          score: doc.score,
          band: doc.band,
          finishedAt: doc.finishedAt,
          checkpointSummary: doc.checkpointSummary ?? [],
        })),
        getScenarioTitle,
        getCheckpointDescription: describeCheckpoint,
        now: now(),
      })

      res.set('Cache-Control', 'no-store')
      return res.status(200).json(summary)
    }),
  )

  router.post(
    '/rotate-code',
    noStore,
    requireAuth,
    requireRole('orgAdmin'),
    asyncHandler(async (req, res, next) => {
      if (!req.org) return next(notFound())
      const joinCode = await rotateOrgJoinCode(req.org._id, OrgModel)
      if (!joinCode) return next(notFound())
      return res.status(200).json({ joinCode })
    }),
  )

  router.delete(
    '/employees/:id',
    noStore,
    requireAuth,
    requireRole('orgAdmin'),
    asyncHandler(async (req, res, next) => {
      if (!req.org) return next(notFound())
      if (!isObjectId(req.params.id)) return next(notFound())

      const updated = await UserModel.findOneAndUpdate(
        { _id: req.params.id, orgId: req.org._id, role: 'employee' },
        { $set: { orgId: null, role: 'individual' } },
      )
      if (!updated) return next(notFound())

      return res.status(200).json({ ok: true })
    }),
  )

  return router
}
