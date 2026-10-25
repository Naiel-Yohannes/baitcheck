import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createScenarioStore } from '../scenarios/scenarioStore.js'

const scenarioFile = fileURLToPath(new URL('../scenarios/mobile-money-call.json', import.meta.url))

describe('scenario store', () => {
  it('returns only public fields', async () => {
    const scenario = JSON.parse(await readFile(scenarioFile, 'utf8'))
    const store = createScenarioStore([scenario])
    const [publicScenario] = store.listPublic()
    expect(Object.keys(publicScenario)).toEqual(['id', 'title', 'description', 'languages', 'channel', 'estimatedMinutes', 'practiceTechniques'])
    expect(publicScenario.practiceTechniques).toEqual(scenario.stages.map(stage => stage.technique))
    const json = JSON.stringify(publicScenario)
    for (const privateField of ['instruction', 'checkpoints', 'stages', 'goal', 'fakeData', 'openingLine']) {
      expect(json).not.toContain(privateField)
    }
  })

  it('looks up scenarios and falls back from a missing language to English', async () => {
    const scenario = JSON.parse(await readFile(scenarioFile, 'utf8'))
    const store = createScenarioStore([scenario])
    expect(store.getTitle(scenario.id, 'am')).toBe(scenario.title.am)
    expect(store.getTitle(scenario.id, 'xx')).toBe(scenario.title.en)
    expect(store.getTitle('missing', 'en')).toBeNull()
    expect(store.getById('missing')).toBeUndefined()
  })

  it('returns deeply frozen data from getAll', async () => {
    const scenario = JSON.parse(await readFile(scenarioFile, 'utf8'))
    const store = createScenarioStore([scenario])
    const all = store.getAll()
    expect(Object.isFrozen(all)).toBe(true)
    expect(Object.isFrozen(all[0])).toBe(true)
    expect(Object.isFrozen(all[0].stages[0].instruction)).toBe(true)
  })
})
