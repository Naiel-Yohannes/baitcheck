import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { getEndReason, getStageIndex, stagePosition } from '../engine/stages.js'

const scenarioPath = fileURLToPath(new URL('../scenarios/mobile-money-call.json', import.meta.url))
const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'))

describe('stage helpers', () => {
  it('maps turns to stage indexes and caps at the final stage', () => {
    expect(Array.from({ length: 9 }, (_, turnCount) => getStageIndex(turnCount, scenario)))
      .toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3])
    expect(getStageIndex(20, scenario)).toBe(3)
    expect(getStageIndex(20, { stages: [{ id: 'one' }, { id: 'two' }, { id: 'three' }] })).toBe(2)
    expect(stagePosition(scenario, 'stage_3')).toBe(2)
    expect(stagePosition(scenario, 'missing')).toBe(-1)
  })

  it('uses two turns per stage by default', () => {
    const shorter = { stages: scenario.stages }
    expect(getStageIndex(3, shorter)).toBe(1)
  })

  it('chooses end reasons in the specified priority order', () => {
    const reason = (text, turnCount, language = 'en') => getEndReason({ text, turnCount, scenario, language })
    expect(reason('hello', 1)).toBeNull()
    expect(reason('hello', 7)).toBe('scenario_complete')
    expect(reason('hello', 10)).toBe('max_turns')
    expect(reason('I will hang up now', 1)).toBe('end_signal')
    expect(reason('HANG UP', 1)).toBe('end_signal')
    expect(reason('ስልኩን እዘጋለሁ', 1, 'am')).toBe('end_signal')
    expect(reason('hang up', 10)).toBe('end_signal')
  })
})
