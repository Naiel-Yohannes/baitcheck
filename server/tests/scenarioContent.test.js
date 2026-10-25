import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { loadScenarios } from '../scenarios/loadScenarios.js'
import { checkUserInput, sanitizeOutput } from '../engine/safety.js'
import { evaluateCodeCheckpoints } from '../engine/scoring.js'

const scenariosDir = fileURLToPath(new URL('../scenarios/', import.meta.url))
const scenariosPromise = loadScenarios(scenariosDir, { expectedCount: 3 })
const getScenarios = async () => (await scenariosPromise).getAll()
const languages = ['en', 'am']

function localized(value, language) {
  return typeof value === 'string' ? value : value[language]
}

describe('scenario content', () => {
  it('loads all three scenarios without validation problems', async () => {
    await expect(getScenarios()).resolves.toHaveLength(3)
  })

  it.each(languages)('keeps fake data safe and canned text sanitized for %s', async language => {
    const scenarios = await getScenarios()
    for (const scenario of scenarios) {
      for (const item of scenario.persona.fakeData) {
        expect(checkUserInput(item.value, scenario, language).ok).toBe(true)
        expect(checkUserInput(`Please use ${item.value} for this`, scenario, language).ok).toBe(true)
      }

      expect(sanitizeOutput(scenario.openingLine[language], scenario, language)).toBe(scenario.openingLine[language])
      expect(sanitizeOutput(scenario.fallbackLine[language], scenario, language)).toBe(scenario.fallbackLine[language])
      for (const line of [
        ...(scenario._fakeLines?.[language]?.stages.flat() ?? []),
        ...(scenario._fakeLines?.[language]?.final ? [scenario._fakeLines[language].final] : []),
      ]) {
        expect(sanitizeOutput(line, scenario, language)).toBe(line)
      }
    }
  })

  it('contains no links, handles, or long digit runs in attacker-facing content', async () => {
    const scenarios = await getScenarios()
    const unsafePattern = /http|www\.|@|\d{6,}/i
    for (const scenario of scenarios) {
      for (const language of languages) {
        const text = [
          scenario.openingLine[language],
          ...scenario.stages.map(stage => localized(stage.instruction, language)),
          ...(scenario._fakeLines?.[language]?.stages.flat() ?? []),
          ...(scenario._fakeLines?.[language]?.final ? [scenario._fakeLines[language].final] : []),
        ]
        for (const line of text) expect(line).not.toMatch(unsafePattern)
      }
      expect(scenario.checkpoints.reduce((sum, checkpoint) => sum + checkpoint.weight, 0)).toBe(10)
    }
  })

  it.each(languages)('evaluates leak and staged keyword checkpoints for %s', async language => {
    const scenarios = await getScenarios()
    for (const scenario of scenarios) {
      const leakCheckpoints = scenario.checkpoints.filter(checkpoint => checkpoint.rule === 'leak')
      for (const checkpoint of leakCheckpoints) {
        const item = scenario.persona.fakeData.find(data => checkpoint.keys.includes(data.key))
        const base = { scenario, stageIndex: 0, endReason: null, language }
        const leaked = evaluateCodeCheckpoints({
          ...base,
          messages: [{ role: 'user', text: `I sent ${item.value}` }],
        }).find(result => result.id === checkpoint.id)
        const protectedValue = evaluateCodeCheckpoints({
          ...base,
          messages: [{ role: 'user', text: 'I will keep that private' }],
        }).find(result => result.id === checkpoint.id)
        expect(leaked.status).toBe('failed')
        expect(protectedValue.status).toBe('passed')
      }

      for (const checkpoint of scenario.checkpoints.filter(item => item.rule === 'keyword')) {
        const notYetApplicable = evaluateCodeCheckpoints({
          scenario, messages: [], stageIndex: 1, endReason: null, language,
        }).find(result => result.id === checkpoint.id)
        const applicable = evaluateCodeCheckpoints({
          scenario, messages: [], stageIndex: 2, endReason: null, language,
        }).find(result => result.id === checkpoint.id)
        expect(notYetApplicable.status).toBe('na')
        expect(applicable.status).toBe('failed')
      }
    }
  })

  it('does not expose private scenario fields in the public list', async () => {
    const scenarios = await getScenarios()
    const publicScenarios = (await import('../scenarios/scenarioStore.js')).createScenarioStore(scenarios).listPublic()
    for (const scenario of publicScenarios) {
      expect(scenario).not.toHaveProperty('_fakeLines')
      for (const field of ['_reviewNote', 'persona', 'attacker', 'stages', 'checkpoints', 'fallbackLine', 'endSignals']) {
        expect(scenario).not.toHaveProperty(field)
      }
    }
  })
})
