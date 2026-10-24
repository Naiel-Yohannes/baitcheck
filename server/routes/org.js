import { Router } from 'express'
import User from '../models/User.js'
import Session from '../models/Session.js'
import { requireRole } from '../middleware/auth.js'
import { notFound } from '../utils/errors.js'
import asyncHandler from '../utils/asyncHandler.js'
import { buildOrgSummary } from '../utils/orgSummary.js'

export function createOrgRouter({
  requireAuth,
  UserModel = User,
  SessionModel = Session,
  getScenarioTitle = (id) => id,
}) {
  const router = Router()

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
        .select('userId scenarioId language score band finishedAt')
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
        })),
        getScenarioTitle,
      })

      res.set('Cache-Control', 'no-store')
      return res.status(200).json(summary)
    }),
  )

  return router
}
