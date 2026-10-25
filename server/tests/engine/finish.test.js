import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildSessionReport } from '../../engine/finish.js'
import { createFakeAi } from '../../engine/fakeAi.js'
import { buildFallbackFeedback } from '../../engine/feedback.js'
import { computeScore } from '../../engine/scoring.js'

const scenarioFile = fileURLToPath(new URL('../../scenarios/mobile-money-call.json', import.meta.url))
const scenario = JSON.parse(await readFile(scenarioFile, 'utf8'))
const now = new Date('2026-01-02T03:04:05.000Z')

function session({ texts, endReason = null, turnCount = texts.length, stageIndex = 3, language = 'en' }) {
  return {
    _id: 'session-id',
    userId: 'user-id',
    language,
    status: 'active',
    endReason,
    turnCount,
    stageIndex,
    messages: texts.map(text => ({ role: 'user', text })),
  }
}

function byId(report, id) {
  return report.checkpoints.find(checkpoint => checkpoint.id === id)
}

describe('buildSessionReport', () => {
  it('A: scores verified caller, fake data leak, urgency compliance, and unfinished conversation', async () => {
    const input = session({
      endReason: 'scenario_complete',
      texts: ['who is this? I will verify', 'ok', 'fine', '4821', '739204', 'alright', 'ok'],
    })
    const { report } = await buildSessionReport({ session: input, scenario, ai: createFakeAi(), now })
    expect(byId(report, 'verify_caller')).toMatchObject({ status: 'passed' })
    expect(byId(report, 'refuse_code')).toMatchObject({ status: 'failed', evidence: '4821' })
    expect(byId(report, 'resist_urgency')).toMatchObject({ status: 'failed' })
    expect(byId(report, 'end_conversation')).toMatchObject({ status: 'failed' })
    expect(report).toMatchObject({ score: 20, band: 'vulnerable', degraded: false })
    expect(report.timeline.map(item => item.startedAtTurn)).toEqual([0, 2, 4, 6])
  })

  it('B: passes all checks when the user verifies, refuses, and ends the call', async () => {
    const input = session({
      endReason: 'end_signal',
      texts: ['Who are you? I will verify with the official app', 'I will not share anything', 'I will hang up now'],
    })
    const { report } = await buildSessionReport({ session: input, scenario, ai: createFakeAi(), now })
    expect(report.score).toBe(100)
    expect(report.band).toBe('strong')
    expect(report.checkpoints.every(item => item.status === 'passed')).toBe(true)
  })

  it('C: gives a partial score when the user refuses and resists pressure but does not verify or end', async () => {
    const input = session({
      endReason: 'scenario_complete',
      texts: ['no thanks', 'I refuse', 'I do not share codes', 'not interested', 'goodbye', 'I said no', 'no thanks again'],
    })
    const { report } = await buildSessionReport({ session: input, scenario, ai: createFakeAi(), now })
    expect(report.score).toBe(60)
    expect(report.band).toBe('partial')
    expect(byId(report, 'verify_caller').status).toBe('failed')
    expect(byId(report, 'refuse_code').status).toBe('passed')
    expect(byId(report, 'resist_urgency').status).toBe('passed')
    expect(byId(report, 'end_conversation').status).toBe('failed')
  })

  it('D: defaults a missing end reason to user_button', async () => {
    const { report, endReason } = await buildSessionReport({
      session: session({ texts: ['no thanks', 'I refuse'], turnCount: 2, stageIndex: 1 }),
      scenario, ai: createFakeAi(), now,
    })
    expect(endReason).toBe('user_button')
    expect(report.endReason).toBe('user_button')
    expect(report.score).toBe(80)
    expect(report.band).toBe('resilient')
    expect(report.timeline).toHaveLength(2)
  })

  it('E: marks AI results unjudged after exactly two failed judge attempts and scores code checks', async () => {
    const ai = createFakeAi()
    const judge = vi.spyOn(ai, 'judgeCheckpoints')
    const { report } = await buildSessionReport({
      session: session({ texts: ['/unjudged', 'I refuse'], endReason: 'user_button', turnCount: 2, stageIndex: 1 }),
      scenario, ai, now,
    })
    expect(judge).toHaveBeenCalledTimes(2)
    expect(byId(report, 'verify_caller')).toMatchObject({ status: 'unjudged', evidence: null })
    expect(byId(report, 'resist_urgency')).toMatchObject({ status: 'unjudged', evidence: null })
    expect(report).toMatchObject({ degraded: true, score: 100 })
  })

  it('F: discards unverifiable evidence and degrades invalid judge results after retrying', async () => {
    const evidenceAi = {
      async judgeCheckpoints({ checkpoints }) {
        return checkpoints.map(checkpoint => ({ id: checkpoint.id, passed: true, evidence: 'not said by the user' }))
      },
      async generateFeedback() { return null },
    }
    const valid = await buildSessionReport({
      session: session({ texts: ['hello'], endReason: 'user_button', turnCount: 1, stageIndex: 0 }),
      scenario, ai: evidenceAi, now,
    })
    expect(byId(valid.report, 'verify_caller')).toMatchObject({ status: 'passed', evidence: null })

    const judgeCheckpoints = vi.fn().mockResolvedValue([{ id: 'unexpected', passed: true }])
    const invalid = await buildSessionReport({
      session: session({ texts: ['hello'], endReason: 'user_button', turnCount: 1, stageIndex: 0 }),
      scenario, ai: { judgeCheckpoints, async generateFeedback() { return null } }, now,
    })
    expect(judgeCheckpoints).toHaveBeenCalledTimes(2)
    expect(byId(invalid.report, 'verify_caller').status).toBe('unjudged')
    expect(invalid.report.degraded).toBe(true)
  })

  it('G: falls back if feedback fails and cleans AI feedback without affecting score', async () => {
    const fallbackAi = createFakeAi()
    const fallback = await buildSessionReport({
      session: session({ texts: ['/nofeedback'], endReason: 'user_button', turnCount: 1, stageIndex: 0 }),
      scenario, ai: fallbackAi, now,
    })
    expect(fallback.report.feedback).toEqual(buildFallbackFeedback({
      scenario,
      language: 'en',
      results: fallback.report.checkpoints,
      band: fallback.report.band,
    }))

    const ai = createFakeAi()
    ai.generateFeedback = async () => ({
      summary: 'Review https://example.net safely.',
      didWell: ['A good choice.', 'The code 739204 was shared.'],
      improve: [],
      nextTime: [],
    })
    const cleaned = await buildSessionReport({
      session: session({ texts: ['I will verify this'], endReason: 'user_button', turnCount: 1, stageIndex: 0 }),
      scenario, ai, now,
    })
    expect(cleaned.report.feedback.summary).toBe('Review [link removed] safely.')
    expect(cleaned.report.feedback.didWell).toEqual(['A good choice.'])
    expect(cleaned.report.score).toBe(100)
  })

  it('H: keeps stage-gated AI checks not applicable and excludes them from judging and scoring', async () => {
    const modified = JSON.parse(JSON.stringify(scenario))
    modified.checkpoints.push({
      id: 'reported', weight: 2, detection: 'code', rule: 'keyword',
      keywords: { en: ['report'], am: ['አሳውቃለሁ'] },
      description: { en: 'The user reports the call.', am: 'ተጠቃሚው ጥሪውን ሪፖርት ያደርጋል።' },
    })
    modified.checkpoints.push({
      id: 'late_ai', weight: 100, detection: 'ai', requiresStage: 'stage_4',
      description: { en: 'A late check.', am: 'ዘግይቶ የሚደረግ ማረጋገጫ።' },
    })
    const ai = createFakeAi()
    const judge = vi.spyOn(ai, 'judgeCheckpoints')
    const { report } = await buildSessionReport({
      session: session({ texts: ['I will report this'], endReason: 'scenario_complete', turnCount: 2, stageIndex: 1 }),
      scenario: modified, ai, now,
    })
    expect(judge.mock.calls[0][0].checkpoints.some(checkpoint => checkpoint.id === 'late_ai')).toBe(false)
    expect(byId(report, 'late_ai')).toMatchObject({ status: 'na', evidence: null })
    expect(byId(report, 'reported')).toMatchObject({ status: 'passed', evidence: 'I will report this' })
    expect(report.score).toBe(computeScore(report.checkpoints, modified))
  })

  it('I: keeps exact report shapes, bounds feedback, avoids mutation, and is deterministic', async () => {
    const input = session({ texts: ['I will verify independently', 'I refuse'], endReason: null, turnCount: 2, stageIndex: 1 })
    const before = JSON.stringify(input)
    const first = await buildSessionReport({ session: input, scenario, ai: createFakeAi(), now })
    const second = await buildSessionReport({ session: input, scenario, ai: createFakeAi(), now })
    expect(JSON.stringify(input)).toBe(before)
    expect(first).toEqual(second)
    expect(Object.keys(first.report)).toEqual([
      'score', 'band', 'degraded', 'scenarioId', 'scenarioTitle', 'language', 'endReason',
      'turnCount', 'checkpoints', 'timeline', 'feedback', 'createdAt',
    ])
    for (const checkpoint of first.report.checkpoints) {
      expect(Object.keys(checkpoint)).toEqual(['id', 'weight', 'method', 'status', 'description', 'evidence'])
    }
    for (const list of Object.values(first.report.feedback).filter(Array.isArray)) expect(list.length).toBeLessThanOrEqual(3)
  })

  it('J: localizes Amharic checkpoint, timeline, and feedback text', async () => {
    const { report } = await buildSessionReport({
      session: session({ texts: ['ይፋዊውን መተግበሪያ አረጋግጡ'], endReason: 'user_button', turnCount: 1, stageIndex: 0, language: 'am' }),
      scenario, ai: createFakeAi(), now,
    })
    expect(report.checkpoints[0].description).toBe(scenario.checkpoints[0].description.am)
    expect(report.timeline[0].technique).toBe(scenario.stages[0].technique.am)
    expect(report.feedback.summary).toMatch(/[\u1200-\u137F]/)
  })
})
