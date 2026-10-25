import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { bandForScore, computeScore, evaluateCodeCheckpoints, isCheckpointApplicable } from '../engine/scoring.js'

const scenarioPath = fileURLToPath(new URL('../scenarios/mobile-money-call.json', import.meta.url))
const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'))

const result = (id, status) => ({ id, status })

describe('score bands and calculation', () => {
  it.each([
    [0, 'vulnerable'], [39, 'vulnerable'], [40, 'partial'], [69, 'partial'],
    [70, 'resilient'], [89, 'resilient'], [90, 'strong'], [100, 'strong'],
  ])('maps %i to %s', (score, band) => {
    expect(bandForScore(score)).toBe(band)
  })

  it('scores only applicable, judged checkpoints using their scenario weights', () => {
    expect(computeScore([
      result('verify_caller', 'passed'), result('refuse_code', 'passed'),
      result('resist_urgency', 'passed'), result('end_conversation', 'passed'),
    ], scenario)).toBe(100)
    expect(computeScore([
      result('verify_caller', 'passed'), result('refuse_code', 'failed'),
      result('resist_urgency', 'failed'), result('end_conversation', 'failed'),
    ], scenario)).toBe(20)
    expect(computeScore([
      result('verify_caller', 'failed'), result('refuse_code', 'passed'),
      result('resist_urgency', 'passed'), result('end_conversation', 'failed'),
    ], scenario)).toBe(60)
    expect(computeScore([
      result('verify_caller', 'passed'), result('refuse_code', 'passed'),
      result('resist_urgency', 'passed'), result('end_conversation', 'na'),
    ], scenario)).toBe(100)
    expect(computeScore([
      result('verify_caller', 'unjudged'), result('refuse_code', 'passed'),
      result('resist_urgency', 'passed'), result('end_conversation', 'failed'),
    ], scenario)).toBe(75)
    expect(computeScore([], scenario)).toBe(0)
    expect(computeScore([result('verify_caller', 'unjudged')], scenario)).toBe(0)
  })
})

describe('code checkpoint evaluation', () => {
  it('detects fake PIN and OTP disclosures with separator-insensitive matching', () => {
    for (const text of ['739204', '739 204', '7-3-9-2-0-4', '4821']) {
      const results = evaluateCodeCheckpoints({ scenario, messages: [{ role: 'user', text }], stageIndex: 0, endReason: null, language: 'en' })
      expect(results.find(item => item.id === 'refuse_code')).toEqual({ id: 'refuse_code', status: 'failed', evidence: text })
    }
    const longMessage = 'x'.repeat(200) + ' 739204'
    const result = evaluateCodeCheckpoints({ scenario, messages: [{ role: 'user', text: longMessage }], stageIndex: 0, endReason: null, language: 'en' })
      .find(item => item.id === 'refuse_code')
    expect(result.evidence).toBe(longMessage.slice(0, 120).trim())
    expect(result.evidence).toHaveLength(120)
  })

  it('passes when no fake value is disclosed and ignores attacker messages', () => {
    const results = evaluateCodeCheckpoints({
      scenario,
      messages: [
        { role: 'attacker', text: 'The code is 739204' },
        { role: 'user', text: 'I will verify independently.' },
      ],
      stageIndex: 0,
      endReason: null,
      language: 'en',
    })
    expect(results.find(item => item.id === 'refuse_code')).toEqual({ id: 'refuse_code', status: 'passed', evidence: null })
  })

  it('evaluates endConversation outcomes from the end reason', () => {
    for (const endReason of ['user_button', 'end_signal']) {
      expect(evaluateCodeCheckpoints({ scenario, messages: [], stageIndex: 0, endReason, language: 'en' })
        .find(item => item.id === 'end_conversation').status).toBe('passed')
    }
    for (const endReason of ['max_turns', 'scenario_complete', null]) {
      expect(evaluateCodeCheckpoints({ scenario, messages: [], stageIndex: 0, endReason, language: 'en' })
        .find(item => item.id === 'end_conversation').status).toBe('failed')
    }
  })

  it('evaluates keyword rules and marks unreached stages not applicable without mutating input', () => {
    const modified = JSON.parse(JSON.stringify(scenario))
    modified.checkpoints.push({
      id: 'reported', weight: 1, detection: 'code', rule: 'keyword',
      keywords: { en: ['report'], am: ['አሳውቃለሁ'] },
    })
    modified.checkpoints.push({
      id: 'stage_four_check', weight: 1, detection: 'code', rule: 'endedBy', requiresStage: 'stage_4',
    })
    const before = JSON.stringify(modified)
    expect(isCheckpointApplicable(modified.checkpoints.at(-1), modified, 1)).toBe(false)
    const early = evaluateCodeCheckpoints({
      scenario: modified, messages: [{ role: 'user', text: 'I will report this.' }], stageIndex: 1, endReason: 'user_button', language: 'en',
    })
    expect(early.find(item => item.id === 'reported')).toMatchObject({ status: 'passed' })
    expect(early.find(item => item.id === 'stage_four_check')).toMatchObject({ status: 'na', evidence: null })
    const late = evaluateCodeCheckpoints({
      scenario: modified, messages: [], stageIndex: 3, endReason: 'user_button', language: 'en',
    })
    expect(late.find(item => item.id === 'stage_four_check')).toMatchObject({ status: 'passed' })
    expect(JSON.stringify(modified)).toBe(before)
  })
})
