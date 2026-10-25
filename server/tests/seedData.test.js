import { describe, expect, it } from 'vitest'
import {
  buildDemoData,
  bandForScore,
  computeScore,
  DEMO_PLAN,
} from '../scripts/seedData.js'

const reportKeys = [
  'score', 'band', 'degraded', 'scenarioId', 'scenarioTitle', 'language', 'endReason', 'turnCount',
  'checkpoints', 'timeline', 'feedback', 'createdAt',
]

function fixture() {
  return buildDemoData(new Date('2026-10-24T12:00:00.000Z'), 'fake-password-hash')
}

describe('demo seed data', () => {
  it('keeps each finished score, report score, band, and planned target aligned', () => {
    const data = fixture()
    const targetsByUser = new Map([
      ['admin', [20]],
      ['hana', [100, 60, 20]],
      ['selam', [80, 60]],
      ['dawit', []],
      ['meron', [80, 40, 100]],
    ])
    for (const session of data.sessions.filter(item => item.status === 'finished')) {
      const target = targetsByUser.get(session.userKey).shift()
      expect(computeScore(session.report.checkpoints)).toBe(session.score)
      expect(session.report.score).toBe(session.score)
      expect(bandForScore(session.score)).toBe(session.band)
      expect(bandForScore(session.score)).toBe(session.report.band)
      expect(session.score).toBe(target)
    }
  })

  it('has the planned session counts and an employee average score of 64', () => {
    const data = fixture()
    const counts = Object.fromEntries(data.users.map(user => [user.key, {
      finished: data.sessions.filter(session => session.userKey === user.key && session.status === 'finished').length,
      active: data.sessions.filter(session => session.userKey === user.key && session.status === 'active').length,
    }]))
    expect(counts).toEqual({
      admin: { finished: 1, active: 0 },
      hana: { finished: 3, active: 0 },
      selam: { finished: 2, active: 0 },
      dawit: { finished: 0, active: 0 },
      meron: { finished: 3, active: 1 },
    })

    const employeeScores = data.sessions
      .filter(session => ['hana', 'selam'].includes(session.userKey) && session.status === 'finished')
      .map(session => session.score)
    expect(employeeScores.reduce((sum, score) => sum + score, 0) / employeeScores.length).toBe(64)
    expect(employeeScores).toHaveLength(5)
  })

  it('includes all bands and keeps report shape and feedback bounded', () => {
    const data = fixture()
    expect(new Set(data.sessions.filter(session => session.status === 'finished').map(session => session.band)))
      .toEqual(new Set(['vulnerable', 'partial', 'resilient', 'strong']))
    for (const session of data.sessions.filter(item => item.report)) {
      expect(Object.keys(session.report)).toEqual(reportKeys)
      expect(session.report.feedback.didWell.length).toBeLessThanOrEqual(3)
      expect(session.report.feedback.improve.length).toBeLessThanOrEqual(3)
      expect(session.report.feedback.nextTime.length).toBeLessThanOrEqual(3)
    }
  })

  it('has the expected active session and unique demo-domain emails', () => {
    const data = fixture()
    const active = data.sessions.find(session => session.status === 'active')
    expect(active).toMatchObject({ report: null, score: null, band: null, status: 'active', endReason: null })
    expect(active.messages).toHaveLength(3)
    expect(new Set(data.users.map(user => user.email)).size).toBe(data.users.length)
    expect(data.users.every(user => user.email.endsWith('@demo.example.com'))).toBe(true)
    expect(DEMO_PLAN.employees.find(user => user.key === 'dawit').sessions).toHaveLength(0)
  })

  it('alternates messages, keeps stage indexes ordered, and uses only safe demo digit strings', () => {
    const data = fixture()
    for (const session of data.sessions) {
      let previousStage = 0
      session.messages.forEach((message, index) => {
        expect(message.role).toBe(index % 2 === 0 ? 'attacker' : 'user')
        expect(message.stageIndex).toBeGreaterThanOrEqual(0)
        expect(message.stageIndex).toBeLessThanOrEqual(3)
        expect(message.stageIndex).toBeGreaterThanOrEqual(previousStage)
        previousStage = message.stageIndex
      })
      const digitRuns = JSON.stringify(session.messages).match(/\d{6,}/g) ?? []
      expect(digitRuns.every(run => run === '739204')).toBe(true)
    }
  })

  it('is deterministic for equal inputs', () => {
    const now = new Date('2026-10-24T12:00:00.000Z')
    expect(buildDemoData(now, 'fake-password-hash')).toEqual(buildDemoData(now, 'fake-password-hash'))
  })
})
