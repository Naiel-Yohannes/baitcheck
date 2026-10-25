import { Router } from 'express'
import { z } from 'zod'
import asyncHandler from '../utils/asyncHandler.js'
import {
  AppError,
  llmFailed,
  notFound,
  rateLimited,
  sessionFinished,
  validationError,
} from '../utils/errors.js'
import { getEndReason, getStageIndex } from '../engine/stages.js'
import { checkUserInput, sanitizeOutput } from '../engine/safety.js'
import { buildSessionReport } from '../engine/finish.js'

const startSchema = z.object({
  scenarioId: z.string(),
  language: z.enum(['en', 'am']),
})

const messageSchema = z.object({
  text: z.string().trim().min(1).max(500),
})

function toIso(value) {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

function buildPersona(scenario, language) {
  return {
    userRole: scenario.persona.userRole[language],
    fakeData: scenario.persona.fakeData.map(({ key, label, value }) => ({
      key,
      label: label[language],
      value,
    })),
  }
}

function publicMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map(({ role, text }) => ({ role, text }))
}

export function createSessionsRouter({ requireAuth, rateLimits, store, ai, repo }) {
  const router = Router()

  router.post('/', requireAuth, rateLimits.startSessionLimiter, asyncHandler(async (req, res) => {
    const { scenarioId, language } = startSchema.parse(req.body)
    const scenario = store.getById(scenarioId)
    if (!scenario) throw notFound()
    if (!scenario.languages.includes(language)) {
      throw validationError('Validation failed.', [{ field: 'language', issue: 'not supported' }])
    }

    const opening = sanitizeOutput(scenario.openingLine[language], scenario, language)
    const session = await repo.create({
      userId: req.user._id,
      orgId: req.user.orgId ?? null,
      scenarioId,
      language,
      status: 'active',
      stageIndex: 0,
      turnCount: 0,
      endReason: null,
      score: null,
      band: null,
      report: null,
      messages: [{ role: 'attacker', text: opening, stageIndex: 0, createdAt: new Date() }],
    })

    return res.status(201).json({
      sessionId: session.id,
      scenarioId,
      scenarioTitle: scenario.title[language],
      language,
      channel: scenario.channel,
      persona: buildPersona(scenario, language),
      firstMessage: opening,
      maxTurns: scenario.maxTurns,
      turnCount: 0,
    })
  }))

  router.get('/mine', requireAuth, asyncHandler(async (req, res) => {
    const sessions = await repo.listMine(req.user._id)
    return res.status(200).json({
      sessions: sessions.map(session => ({
        id: session.id ?? String(session._id),
        scenarioId: session.scenarioId,
        scenarioTitle: store.getTitle(session.scenarioId, session.language) || session.scenarioId,
        language: session.language,
        status: session.status,
        score: session.score,
        band: session.band,
        createdAt: toIso(session.createdAt),
        finishedAt: session.finishedAt == null ? null : toIso(session.finishedAt),
      })),
    })
  }))

  router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
    const session = await repo.findOwned(req.params.id, req.user._id)
    if (!session) throw notFound()

    const scenario = store.getById(session.scenarioId)
    const report = session.report ?? null
    const language = session.language

    let scenarioTitle
    let channel
    let maxTurns
    let persona
    if (!scenario) {
      scenarioTitle = report?.scenarioTitle || session.scenarioId
      channel = 'message'
      maxTurns = 10
      persona = { userRole: '', fakeData: [] }
    } else {
      scenarioTitle = store.getTitle(session.scenarioId, language) || session.scenarioId
      channel = scenario.channel
      maxTurns = scenario.maxTurns
      persona = buildPersona(scenario, language)
    }

    return res.status(200).json({
      session: {
        id: session.id ?? String(session._id),
        scenarioId: session.scenarioId,
        scenarioTitle,
        language,
        channel,
        status: session.status,
        turnCount: session.turnCount,
        maxTurns,
        stageIndex: session.stageIndex,
        endReason: session.endReason,
        persona,
        messages: publicMessages(session.messages),
        report,
      },
    })
  }))

  router.post('/:id/message', requireAuth, rateLimits.messageLimiter, asyncHandler(async (req, res) => {
    const { text } = messageSchema.parse(req.body)
    const session = await repo.findOwned(req.params.id, req.user._id)
    if (!session) throw notFound()
    if (session.status === 'finished' || session.endReason) throw sessionFinished()

    const scenario = store.getById(session.scenarioId)
    if (!scenario) throw notFound()

    const warning = checkUserInput(text, scenario, session.language)
    if (!warning.ok) {
      return res.status(200).json({
        reply: null,
        stageIndex: session.stageIndex,
        turnCount: session.turnCount,
        ended: false,
        warning: { code: warning.code, message: warning.message },
      })
    }

    const t = session.turnCount + 1
    const newStage = getStageIndex(t, scenario)
    const endReason = getEndReason({ text, turnCount: t, scenario, language: session.language })
    const isFinal = endReason !== null
    const history = [
      ...publicMessages(session.messages),
      { role: 'user', text },
    ].slice(-10)

    let reply
    try {
      reply = await ai.generateReply({
        scenario,
        language: session.language,
        stageIndex: newStage,
        isFinal,
        history,
      })
    } catch (err) {
      if (err instanceof AppError) throw err
      throw llmFailed()
    }

    const cleanReply = sanitizeOutput(reply, scenario, session.language)
    const updated = await repo.appendTurn({
      id: req.params.id,
      userId: req.user._id,
      expectedTurnCount: session.turnCount,
      userMessage: { role: 'user', text, stageIndex: session.stageIndex, createdAt: new Date() },
      attackerMessage: { role: 'attacker', text: cleanReply, stageIndex: newStage, createdAt: new Date() },
      turnCount: t,
      stageIndex: newStage,
      endReason,
    })
    if (!updated) {
      throw new AppError(429, rateLimited().code, 'Another message is being processed, please try again')
    }

    return res.status(200).json({
      reply: cleanReply,
      stageIndex: newStage,
      turnCount: t,
      ended: isFinal,
      warning: null,
    })
  }))

  router.post('/:id/finish', requireAuth, rateLimits.finishLimiter, asyncHandler(async (req, res) => {
    const userId = req.user._id
    const session = await repo.findOwned(req.params.id, userId)
    if (!session) throw notFound()
    if (session.status === 'finished') {
      return res.status(200).json({ report: session.report })
    }
    if (session.turnCount === 0) {
      throw validationError('Nothing to evaluate yet', [{ field: 'turnCount', issue: 'no messages were sent' }])
    }

    const scenario = store.getById(session.scenarioId)
    if (!scenario) throw notFound()

    const { report, endReason } = await buildSessionReport({ session, scenario, ai })
    const updated = await repo.finalize({
      id: req.params.id,
      userId,
      set: {
        finishedAt: new Date(),
        endReason,
        score: report.score,
        band: report.band,
        report,
      },
    })
    if (!updated) {
      const reloaded = await repo.findOwned(req.params.id, userId)
      if (reloaded?.status === 'finished') {
        return res.status(200).json({ report: reloaded.report })
      }
      throw notFound()
    }
    return res.status(200).json({ report })
  }))

  return router
}
