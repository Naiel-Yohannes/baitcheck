import { describe, expect, it } from 'vitest'
import { buildOrgSummary } from '../utils/orgSummary.js'

const org = { name: 'Test Org', joinCode: 'ABC234' }
const title = (scenarioId) => `Title ${scenarioId}`

function summary(overrides = {}) {
  return buildOrgSummary({
    org,
    employees: [],
    sessions: [],
    getScenarioTitle: title,
    ...overrides,
  })
}

describe('buildOrgSummary', () => {
  it('returns empty totals when there are no employees', () => {
    expect(summary()).toEqual({
      org: { name: 'Test Org', joinCode: 'ABC234' },
      averageScore: null,
      completedSessions: 0,
      employeeCount: 0,
      employees: [],
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
        { userId: 'e1', scenarioId: 's1', language: 'en', score: 80, band: 'strong', finishedAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const json = JSON.stringify(result)
    for (const forbidden of ['messages', 'report', 'feedback', 'transcript', 'userId', 'email']) {
      expect(json).not.toContain(forbidden)
    }
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
})
