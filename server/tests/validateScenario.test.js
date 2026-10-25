import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { validateScenario, validateScenarioSet } from '../scenarios/validateScenario.js'

const scenarioFile = fileURLToPath(new URL('../scenarios/mobile-money-call.json', import.meta.url))

async function validScenario() {
  return JSON.parse(await readFile(scenarioFile, 'utf8'))
}

async function problemsAfter(change) {
  const scenario = await validScenario()
  change(scenario)
  return validateScenario(scenario)
}

describe('validateScenario', () => {
  it('accepts the real mobile-money-call scenario', async () => {
    expect(validateScenario(await validScenario())).toEqual([])
  })

  it('requires both localized title values', async () => {
    expect(await problemsAfter(s => { delete s.title.am })).toContain('mobile-money-call: title.am must be a non-empty string')
  })

  it('requires three to five stages', async () => {
    expect((await problemsAfter(s => { s.stages = s.stages.slice(0, 2) })).some(p => p.includes('stages must contain 3 to 5'))).toBe(true)
    expect((await problemsAfter(s => { s.stages = [...s.stages, ...s.stages.slice(0, 2), ...s.stages.slice(0, 1)] })).some(p => p.includes('stages must contain 3 to 5'))).toBe(true)
  })

  it('requires positive integer checkpoint weights and supported channels', async () => {
    expect((await problemsAfter(s => { s.checkpoints[0].weight = 0 })).some(p => p.includes('weight must be a positive integer'))).toBe(true)
    expect((await problemsAfter(s => { s.checkpoints[0].weight = 1.5 })).some(p => p.includes('weight must be a positive integer'))).toBe(true)
    expect((await problemsAfter(s => { s.channel = 'sms' })).some(p => p.includes('channel must be'))).toBe(true)
  })

  it('requires at least one checkpoint without a stage and validates stage references', async () => {
    expect((await problemsAfter(s => { s.checkpoints.forEach(checkpoint => { checkpoint.requiresStage = 'stage_1' }) }))
      .some(p => p.includes('at least one checkpoint'))).toBe(true)
    expect((await problemsAfter(s => { s.checkpoints[0].requiresStage = 'missing_stage' }))
      .some(p => p.includes('requiresStage must match'))).toBe(true)
  })

  it('validates leak keys, keyword languages, and ai rules', async () => {
    expect((await problemsAfter(s => { s.checkpoints[1].keys = ['unknown'] }))
      .some(p => p.includes('leak keys must exist'))).toBe(true)
    expect((await problemsAfter(s => {
      s.checkpoints[0].detection = 'code'
      s.checkpoints[0].rule = 'keyword'
      s.checkpoints[0].keywords = { en: ['verify'] }
    })).some(p => p.includes('needs a non-empty am array'))).toBe(true)
    expect((await problemsAfter(s => { s.checkpoints[0].rule = 'leak' }))
      .some(p => p.includes('ai detection must not have a rule'))).toBe(true)
  })

  it('rejects duplicate checkpoint and fake data keys', async () => {
    expect((await problemsAfter(s => { s.checkpoints[1].id = s.checkpoints[0].id }))
      .some(p => p.includes('checkpoints ids must be unique'))).toBe(true)
    expect((await problemsAfter(s => { s.persona.fakeData[1].key = s.persona.fakeData[0].key }))
      .some(p => p.includes('persona.fakeData keys must be unique'))).toBe(true)
  })

  it('requires both supported languages and both end signal lists', async () => {
    expect((await problemsAfter(s => { s.languages = ['en'] })).some(p => p.includes('languages must include am'))).toBe(true)
    expect((await problemsAfter(s => { delete s.endSignals.am })).some(p => p.includes('endSignals.am'))).toBe(true)
  })

  it('does not throw for null input and validates scenario sets', async () => {
    expect(() => validateScenario(null)).not.toThrow()
    expect(validateScenario(null)[0]).toContain('unknown:')
    const scenario = await validScenario()
    expect(validateScenarioSet([scenario, scenario]).some(problem => problem.includes('duplicate scenario id'))).toBe(true)
  })
})
