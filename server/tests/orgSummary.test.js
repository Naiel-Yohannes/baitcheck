import { describe, expect, it } from 'vitest'
import { buildOrgSummary } from '../utils/orgSummary.js'

const org = { name: 'Test Org', joinCode: 'ABC234' }
const title = (scenarioId) => `Title ${scenarioId}`

const NOW = '2026-03-04T12:00:00.000Z'
const EMPTY_TREND = [
  '2026-01-12', '2026-01-19', '2026-01-26', '2026-02-02',
  '2026-02-09', '2026-02-16', '2026-02-23', '2026-03-02',
].map(weekStart => ({ weekStart, completed: 0, averageScore: null }))

function summary(overrides = {}) {
  return buildOrgSummary({
    org,
    employees: [],
    sessions: [],
    getScenarioTitle: title,
    now: NOW,
    ...overrides,
  })
}

function keysOf(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found
  for (const key of Object.keys(value)) {
    found.add(key)
    keysOf(value[key], found)
  }
  return found
}

describe('buildOrgSummary', () => {
  it('returns empty totals when there are no employees', () => {
    expect(summary()).toEqual({
      org: { name: 'Test Org', joinCode: 'ABC234' },
      averageScore: null,
      completedSessions: 0,
      employeeCount: 0,
      employees: [],
      scoreDistribution: { vulnerable: 0, partial: 0, resilient: 0, strong: 0 },
      byScenario: [],
      trend: EMPTY_TREND,
      weakSpots: [],
      improvement: null,
    })
  })

  it('includes employees with no sessions', () => {
    const result = summary({
      employees: [{ id: 'e1', name: 'Ada' }],
    })
    expect(result.employees).toEqual([
      {
        id: 'e1',
        name: 'Ada',
        sessionsCompleted: 0,
        averageScore: null,
        lastActivity: null,
        sessions: [],
      },
    ])
    expect(result.averageScore).toBe(null)
    expect(result.completedSessions).toBe(0)
    expect(result.employeeCount).toBe(1)
  })

  it('rounds an employee average of 73.5 to 74', () => {
    const result = summary({
      employees: [{ id: 'e1', name: 'Ada' }],
      sessions: [
        { userId: 'e1', scenarioId: 's1', language: 'en', score: 85, band: 'strong', finishedAt: '2026-01-02T00:00:00.000Z' },
        { userId: 'e1', scenarioId: 's2', language: 'en', score: 62, band: 'fair', finishedAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    expect(result.employees[0].averageScore).toBe(74)
    expect(result.employees[0].sessionsCompleted).toBe(2)
    expect(result.averageScore).toBe(74)
    expect(result.completedSessions).toBe(2)
  })

  it('uses the mean of all sessions for the org average, not the mean of employee averages', () => {
    const result = summary({
      employees: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      sessions: [
        { userId: 'a', scenarioId: 's1', language: 'en', score: 100, band: 'strong', finishedAt: '2026-01-01T00:00:00.000Z' },
        { userId: 'a', scenarioId: 's2', language: 'en', score: 100, band: 'strong', finishedAt: '2026-01-02T00:00:00.000Z' },
        { userId: 'a', scenarioId: 's3', language: 'en', score: 100, band: 'strong', finishedAt: '2026-01-03T00:00:00.000Z' },
        { userId: 'b', scenarioId: 's4', language: 'en', score: 0, band: 'weak', finishedAt: '2026-01-04T00:00:00.000Z' },
      ],
    })
    expect(result.employees.find(e => e.id === 'a').averageScore).toBe(100)
    expect(result.employees.find(e => e.id === 'b').averageScore).toBe(0)
    expect(result.averageScore).toBe(75)
    expect(result.completedSessions).toBe(4)
  })

  it('sorts employees by name', () => {
    const result = summary({
      employees: [
        { id: '2', name: 'Zara' },
        { id: '1', name: 'Ada' },
      ],
    })
    expect(result.employees.map(e => e.name)).toEqual(['Ada', 'Zara'])
  })

  it('sets lastActivity to the latest finishedAt as an ISO string', () => {
    const result = summary({
      employees: [{ id: 'e1', name: 'Ada' }],
      sessions: [
        { userId: 'e1', scenarioId: 'old', language: 'en', score: 50, band: 'fair', finishedAt: new Date('2026-01-01T12:00:00.000Z') },
        { userId: 'e1', scenarioId: 'new', language: 'en', score: 70, band: 'fair', finishedAt: new Date('2026-03-15T08:30:00.000Z') },
      ],
    })
    expect(result.employees[0].lastActivity).toBe('2026-03-15T08:30:00.000Z')
  })

  it('orders an employee\'s sessions newest first', () => {
    const result = summary({
      employees: [{ id: 'e1', name: 'Ada' }],
      sessions: [
        { userId: 'e1', scenarioId: 'older', language: 'en', score: 40, band: 'fair', finishedAt: '2026-01-01T00:00:00.000Z' },
        { userId: 'e1', scenarioId: 'newer', language: 'en', score: 90, band: 'strong', finishedAt: '2026-06-01T00:00:00.000Z' },
      ],
    })
    expect(result.employees[0].sessions.map(s => s.scenarioId)).toEqual(['newer', 'older'])
  })

  it('ignores sessions whose userId is not in the employees array', () => {
    const result = summary({
      employees: [{ id: 'e1', name: 'Ada' }],
      sessions: [
        { userId: 'e1', scenarioId: 's1', language: 'en', score: 80, band: 'strong', finishedAt: '2026-01-01T00:00:00.000Z' },
        { userId: 'unknown', scenarioId: 's2', language: 'en', score: 10, band: 'weak', finishedAt: '2026-01-02T00:00:00.000Z' },
      ],
    })
    expect(result.completedSessions).toBe(1)
    expect(result.averageScore).toBe(80)
    expect(result.employees[0].sessionsCompleted).toBe(1)
  })

  it('ignores sessions with a null score', () => {
    const result = summary({
      employees: [{ id: 'e1', name: 'Ada' }],
      sessions: [
        { userId: 'e1', scenarioId: 's1', language: 'en', score: null, band: null, finishedAt: '2026-01-01T00:00:00.000Z' },
        { userId: 'e1', scenarioId: 's2', language: 'en', score: 90, band: 'strong', finishedAt: '2026-01-02T00:00:00.000Z' },
      ],
    })
    expect(result.employees[0].sessionsCompleted).toBe(1)
    expect(result.averageScore).toBe(90)
  })

  it('omits private fields from the serialized result', () => {
    const result = summary({
      employees: [{ id: 'e1', name: 'Ada' }],
      sessions: [
        {
          userId: 'e1',
          scenarioId: 's1',
          language: 'en',
          score: 80,
          band: 'resilient',
          finishedAt: '2026-02-10T00:00:00.000Z',
          checkpointSummary: [
            { id: 'leak', status: 'passed' },
            { id: 'leak', status: 'passed' },
            { id: 'leak', status: 'failed' },
          ],
          messages: [{ text: 'secret' }],
          report: { feedback: 'hidden' },
          email: 'ada@example.com',
        },
        {
          userId: 'e1',
          scenarioId: 's1',
          language: 'en',
          score: 70,
          band: 'resilient',
          finishedAt: '2026-02-11T00:00:00.000Z',
          checkpointSummary: [{ id: 'leak', status: 'passed' }],
        },
        {
          userId: 'e1',
          scenarioId: 's1',
          language: 'en',
          score: 60,
          band: 'partial',
          finishedAt: '2026-02-12T00:00:00.000Z',
          checkpointSummary: [{ id: 'leak', status: 'failed' }],
        },
      ],
      getCheckpointDescription: () => ({ en: 'The user can report the caller', am: 'ሪፖርት' }),
    })
    const names = keysOf(result)
    for (const forbidden of ['messages', 'report', 'feedback', 'evidence', 'transcript', 'email', 'userId']) {
      expect(names.has(forbidden)).toBe(false)
    }
    expect(JSON.stringify(result)).toContain('report the caller')
  })

  it('falls back to scenarioId when getScenarioTitle throws or returns undefined', () => {
    const result = summary({
      employees: [{ id: 'e1', name: 'Ada' }],
      sessions: [
        { userId: 'e1', scenarioId: 'throws', language: 'en', score: 10, band: 'weak', finishedAt: '2026-01-02T00:00:00.000Z' },
        { userId: 'e1', scenarioId: 'missing', language: 'am', score: 20, band: 'weak', finishedAt: '2026-01-01T00:00:00.000Z' },
      ],
      getScenarioTitle(scenarioId) {
        if (scenarioId === 'throws') throw new Error('no title')
        return undefined
      },
    })
    expect(result.employees[0].sessions.map(s => s.scenarioTitle)).toEqual(['throws', 'missing'])
  })

  it('aggregates distribution, scenarios, weeks, weak spots and improvement from counted sessions only', () => {
    const result = summary({
      employees: [
        { id: 'b', name: 'Bo' },
        { id: 'a', name: 'Ada' },
      ],
      getCheckpointDescription(scenarioId, checkpointId) {
        if (checkpointId === 'leak') return { en: 'Did not read the code', am: 'ኮዱን አላነበበም', extra: 'nope' }
        return null
      },
      sessions: [
        { userId: 'admin', scenarioId: 's1', language: 'en', score: 0, band: 'vulnerable', finishedAt: '2026-02-10T00:00:00.000Z' },
        { userId: 'a', scenarioId: 's1', language: 'en', score: null, band: null, finishedAt: '2026-02-01T00:00:00.000Z' },
        { userId: 'a', scenarioId: 's1', language: 'en', score: 20, band: 'vulnerable', finishedAt: '2026-01-20T00:00:00.000Z', checkpointSummary: [{ id: 'leak', status: 'passed' }, { id: 'rush', status: 'failed' }, { id: 'low', status: 'failed' }] },
        { userId: 'a', scenarioId: 's1', language: 'en', score: 50, band: 'partial', finishedAt: '2026-02-03T00:00:00.000Z', checkpointSummary: [{ id: 'leak', status: 'failed' }, { id: 'rush', status: 'na' }, { id: 'low', status: 'failed' }] },
        { userId: 'a', scenarioId: 's1', language: 'am', score: 80, band: 'resilient', finishedAt: '2026-02-10T00:00:00.000Z', checkpointSummary: [{ id: 'leak', status: 'passed' }, { id: 'rush', status: 'unjudged' }, { id: 'low', status: 'failed' }, { id: 'thin', status: 'passed' }] },
        { userId: 'a', scenarioId: 's2', language: 'en', score: 90, band: 'strong', finishedAt: '2026-02-17T00:00:00.000Z', checkpointSummary: [{ id: 'high', status: 'passed' }] },
        { userId: 'a', scenarioId: 's2', language: 'en', score: 60, band: 'partial', finishedAt: '2026-03-03T00:00:00.000Z', checkpointSummary: [{ id: 'high', status: 'passed' }] },
        { userId: 'b', scenarioId: 's1', language: 'en', score: 0, band: 'vulnerable', finishedAt: '2026-03-01T23:00:00.000Z', checkpointSummary: [{ id: 'leak', status: 'failed' }, { id: 'thin', status: 'passed' }] },
        { userId: 'b', scenarioId: 's2', language: 'en', score: 100, band: 'strong', finishedAt: '2026-01-11T00:00:00.000Z', checkpointSummary: [{ id: 'high', status: 'passed' }] },
      ],
    })

    expect(result.completedSessions).toBe(7)
    expect(result.averageScore).toBe(57)
    expect(result.employees.map(employee => employee.id)).toEqual(['a', 'b'])
    expect(result.scoreDistribution).toEqual({ vulnerable: 2, partial: 2, resilient: 1, strong: 2 })
    expect(result.byScenario).toEqual([
      { scenarioId: 's1', scenarioTitle: 'Title s1', completed: 4, averageScore: 38 },
      { scenarioId: 's2', scenarioTitle: 'Title s2', completed: 3, averageScore: 83 },
    ])
    expect(result.trend).toEqual([
      { weekStart: '2026-01-12', completed: 0, averageScore: null },
      { weekStart: '2026-01-19', completed: 1, averageScore: 20 },
      { weekStart: '2026-01-26', completed: 0, averageScore: null },
      { weekStart: '2026-02-02', completed: 1, averageScore: 50 },
      { weekStart: '2026-02-09', completed: 1, averageScore: 80 },
      { weekStart: '2026-02-16', completed: 1, averageScore: 90 },
      { weekStart: '2026-02-23', completed: 1, averageScore: 0 },
      { weekStart: '2026-03-02', completed: 1, averageScore: 60 },
    ])
    expect(result.weakSpots).toEqual([
      {
        scenarioId: 's1',
        scenarioTitle: 'Title s1',
        checkpointId: 'low',
        description: { en: 'low', am: 'low' },
        passRate: 0,
        sample: 3,
      },
      {
        scenarioId: 's1',
        scenarioTitle: 'Title s1',
        checkpointId: 'leak',
        description: { en: 'Did not read the code', am: 'ኮዱን አላነበበም' },
        passRate: 50,
        sample: 4,
      },
      {
        scenarioId: 's2',
        scenarioTitle: 'Title s2',
        checkpointId: 'high',
        description: { en: 'high', am: 'high' },
        passRate: 100,
        sample: 3,
      },
    ])
    expect(result.improvement).toEqual({ learners: 2, averageDelta: 15 })
  })

  it('puts a Monday session in the new week and a Sunday session in the previous week', () => {
    const result = summary({
      employees: [{ id: 'a', name: 'Ada' }],
      sessions: [
        { userId: 'a', scenarioId: 's1', language: 'en', score: 10, band: 'vulnerable', finishedAt: '2026-03-01T23:00:00.000Z' },
        { userId: 'a', scenarioId: 's1', language: 'en', score: 30, band: 'vulnerable', finishedAt: '2026-03-02T00:00:00.000Z' },
      ],
    })
    expect(result.trend.find(week => week.weekStart === '2026-02-23')).toEqual({ weekStart: '2026-02-23', completed: 1, averageScore: 10 })
    expect(result.trend.find(week => week.weekStart === '2026-03-02')).toEqual({ weekStart: '2026-03-02', completed: 1, averageScore: 30 })
  })

  it('rounds a two-thirds pass rate and a half-point improvement delta', () => {
    const result = summary({
      employees: [{ id: 'a', name: 'Ada' }, { id: 'b', name: 'Bo' }],
      sessions: [
        { userId: 'a', scenarioId: 's1', language: 'en', score: 0, band: 'vulnerable', finishedAt: '2026-02-01T00:00:00.000Z', checkpointSummary: [{ id: 'cp', status: 'passed' }] },
        { userId: 'a', scenarioId: 's1', language: 'en', score: 10, band: 'vulnerable', finishedAt: '2026-02-02T00:00:00.000Z', checkpointSummary: [{ id: 'cp', status: 'passed' }] },
        { userId: 'a', scenarioId: 's1', language: 'en', score: 10, band: 'vulnerable', finishedAt: '2026-02-03T00:00:00.000Z', checkpointSummary: [{ id: 'cp', status: 'failed' }] },
        { userId: 'b', scenarioId: 's1', language: 'en', score: 0, band: 'vulnerable', finishedAt: '2026-02-01T00:00:00.000Z' },
        { userId: 'b', scenarioId: 's1', language: 'en', score: 11, band: 'vulnerable', finishedAt: '2026-02-04T00:00:00.000Z' },
      ],
    })
    expect(result.weakSpots).toEqual([
      expect.objectContaining({ checkpointId: 'cp', passRate: 67, sample: 3 }),
    ])
    expect(result.improvement).toEqual({ learners: 2, averageDelta: 11 })
  })

  it('returns a negative improvement delta and hides checkpoints with fewer than 3 judged sessions', () => {
    const result = summary({
      employees: [{ id: 'a', name: 'Ada' }],
      sessions: [
        { userId: 'a', scenarioId: 's1', language: 'en', score: 80, band: 'resilient', finishedAt: '2026-02-01T00:00:00.000Z', checkpointSummary: [{ id: 'cp', status: 'passed' }] },
        { userId: 'a', scenarioId: 's1', language: 'en', score: 50, band: 'partial', finishedAt: '2026-02-08T00:00:00.000Z', checkpointSummary: [{ id: 'cp', status: 'failed' }] },
      ],
    })
    expect(result.weakSpots).toEqual([])
    expect(result.improvement).toEqual({ learners: 1, averageDelta: -30 })
  })

  it('keeps only the six weakest checkpoints', () => {
    const sessions = [0, 1, 2].map(index => ({
      userId: 'a',
      scenarioId: 's1',
      language: 'en',
      score: 40,
      band: 'partial',
      finishedAt: `2026-02-0${index + 1}T00:00:00.000Z`,
      checkpointSummary: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(id => ({
        id,
        status: id === 'a' || index === 0 ? 'failed' : 'passed',
      })),
    }))
    const result = summary({
      employees: [{ id: 'a', name: 'Ada' }],
      sessions,
    })
    expect(result.weakSpots).toHaveLength(6)
    expect(result.weakSpots.map(spot => spot.checkpointId)).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(result.weakSpots.some(spot => spot.checkpointId === 'g')).toBe(false)
  })
})
