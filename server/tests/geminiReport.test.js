import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildSessionReport } from '../engine/finish.js'
import { computeScore } from '../engine/scoring.js'
import { buildFallbackFeedback } from '../engine/feedback.js'
import { createGeminiAi } from '../ai/geminiAi.js'

const scenario = JSON.parse(await readFile(fileURLToPath(new URL('../scenarios/mobile-money-call.json', import.meta.url)), 'utf8'))
const config = { LLM_MODEL: 'attacker-model', LLM_MODEL_JUDGE: 'judge-model' }
const goodLines = [
  'Who are you? I will verify with the official app',
  'I will not share anything',
  'I will hang up now',
]
const feedback = {
  summary: 'You checked carefully and protected your information.',
  didWell: ['You said you would verify independently.'],
  improve: [],
  nextTime: ['Use an official channel.', 'End suspicious conversations.'],
}

function sessionFor(lines, language = 'en') {
  const messages = [{ role: 'attacker', text: 'Opening line.' }]
  for (const line of lines) {
    messages.push({ role: 'user', text: line })
    messages.push({ role: 'attacker', text: 'Attacker reply kept out of AI evaluation.' })
  }
  return {
    id: 'in-memory-session', scenarioId: scenario.id, language, messages,
    stageIndex: 3, turnCount: lines.length, endReason: 'user_button',
  }
}

function llmForResponses(handler) {
  return { generateJSON: vi.fn(handler), generateText: vi.fn(async () => ({ text: 'A scripted trial response.' })) }
}

describe('Gemini report integration', () => {
  it('computes a successful report using code scoring, ignoring a model-provided score', async () => {
    const llm = llmForResponses(async ({ temperature }) => temperature === 0
      ? {
          results: [
            { id: 'verify_caller', passed: true, evidence: 'Who are you?', score: 0 },
            { id: 'resist_urgency', passed: true, evidence: 'I will verify with the official app' },
          ],
          score: 0,
        }
      : feedback)
    const ai = createGeminiAi({ config, llm })
    const { report } = await buildSessionReport({ session: sessionFor(goodLines), scenario, ai })
    expect(report.checkpoints.map(({ id, status }) => [id, status])).toEqual([
      ['verify_caller', 'passed'], ['refuse_code', 'passed'], ['resist_urgency', 'passed'], ['end_conversation', 'passed'],
    ])
    expect(report.score).toBe(computeScore(report.checkpoints, scenario))
    expect(report.score).toBe(100)
    expect(report.score).not.toBe(0)
    expect(report.feedback).toEqual(feedback)
  })

  it('marks twice-invalid judge results unjudged and still completes a degraded report', async () => {
    const llm = llmForResponses(async ({ temperature }) => temperature === 0 ? { results: [] } : feedback)
    const ai = createGeminiAi({ config, llm })
    const { report } = await buildSessionReport({ session: sessionFor(goodLines), scenario, ai })
    expect(llm.generateJSON.mock.calls.filter(([params]) => params.temperature === 0)).toHaveLength(2)
    expect(report.degraded).toBe(true)
    expect(report.checkpoints.filter(item => item.method === 'ai').map(item => item.status)).toEqual(['unjudged', 'unjudged'])
    expect(report.feedback).toEqual(feedback)
  })

  it('uses fixed fallback feedback when the real writer throws', async () => {
    const llm = llmForResponses(async ({ temperature }) => {
      if (temperature === 0) return { results: [
        { id: 'verify_caller', passed: true, evidence: 'Who are you?' },
        { id: 'resist_urgency', passed: true, evidence: null },
      ] }
      throw new Error('provider unavailable')
    })
    const ai = createGeminiAi({ config, llm })
    const { report } = await buildSessionReport({ session: sessionFor(goodLines), scenario, ai })
    expect(report.feedback).toEqual(buildFallbackFeedback({ scenario, language: 'en', results: report.checkpoints, band: report.band }))
  })

  it('drops evidence that is not copied from a learner line', async () => {
    const llm = llmForResponses(async ({ temperature }) => temperature === 0
      ? { results: [
          { id: 'verify_caller', passed: true, evidence: 'invented quote' },
          { id: 'resist_urgency', passed: true, evidence: null },
        ] }
      : feedback)
    const ai = createGeminiAi({ config, llm })
    const { report } = await buildSessionReport({ session: sessionFor(goodLines), scenario, ai })
    expect(report.checkpoints.find(item => item.id === 'verify_caller').evidence).toBeNull()
  })
})
