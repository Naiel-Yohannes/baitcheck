import { bandForScore } from '../engine/scoring.js'

const BANDS = ['vulnerable', 'partial', 'resilient', 'strong']

function toIsoString(value) {
  if (value instanceof Date) return value.toISOString()
  return new Date(value).toISOString()
}

function resolveScenarioTitle(getScenarioTitle, scenarioId, language) {
  try {
    return getScenarioTitle(scenarioId, language) || scenarioId
  } catch {
    return scenarioId
  }
}

function meanRounded(scores) {
  if (scores.length === 0) return null
  const sum = scores.reduce((total, score) => total + score, 0)
  return Math.round(sum / scores.length)
}

function utcMonday(value) {
  const date = value instanceof Date ? value : new Date(value)
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const weekday = monday.getUTCDay()
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday)
  return monday
}

function weekStartKey(value) {
  return utcMonday(value).toISOString().slice(0, 10)
}

function lastEightWeekStarts(now) {
  const current = utcMonday(now)
  const starts = []
  for (let offset = 7; offset >= 0; offset -= 1) {
    const start = new Date(current)
    start.setUTCDate(start.getUTCDate() - offset * 7)
    starts.push(start.toISOString().slice(0, 10))
  }
  return starts
}

function checkpointDescription(getCheckpointDescription, scenarioId, checkpointId) {
  try {
    const description = getCheckpointDescription(scenarioId, checkpointId)
    if (description && typeof description.en === 'string' && typeof description.am === 'string') {
      return { en: description.en, am: description.am }
    }
  } catch {
    // Fall through to the id so a missing scenario cannot break the summary.
  }
  return { en: checkpointId, am: checkpointId }
}

function countedBand(session) {
  if (BANDS.includes(session.band)) return session.band
  return bandForScore(session.score)
}

export function buildOrgSummary({
  org,
  employees,
  sessions,
  getScenarioTitle,
  getCheckpointDescription = () => null,
  now = new Date(),
}) {
  const employeeIds = new Set(employees.map(employee => employee.id))
  const countedByUser = new Map(employees.map(employee => [employee.id, []]))

  for (const session of sessions) {
    if (!employeeIds.has(session.userId)) continue
    if (!Number.isFinite(session.score)) continue
    countedByUser.get(session.userId).push(session)
  }

  const employeeSummaries = employees.map(employee => {
    const theirs = countedByUser.get(employee.id)
    const scores = theirs.map(session => session.score)
    const sorted = theirs
      .slice()
      .sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))

    return {
      id: employee.id,
      name: employee.name,
      sessionsCompleted: theirs.length,
      averageScore: meanRounded(scores),
      lastActivity: sorted.length === 0 ? null : toIsoString(sorted[0].finishedAt),
      sessions: sorted.map(session => ({
        scenarioId: session.scenarioId,
        scenarioTitle: resolveScenarioTitle(getScenarioTitle, session.scenarioId, session.language),
        score: session.score,
        band: session.band,
        finishedAt: toIsoString(session.finishedAt),
      })),
    }
  })

  employeeSummaries.sort((a, b) => a.name.localeCompare(b.name))

  const counted = [...countedByUser.values()].flat()
  const allScores = counted.map(session => session.score)

  const scoreDistribution = { vulnerable: 0, partial: 0, resilient: 0, strong: 0 }
  for (const session of counted) scoreDistribution[countedBand(session)] += 1

  const byScenarioGroups = new Map()
  for (const session of counted) {
    if (!byScenarioGroups.has(session.scenarioId)) byScenarioGroups.set(session.scenarioId, [])
    byScenarioGroups.get(session.scenarioId).push(session)
  }
  const byScenario = [...byScenarioGroups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([scenarioId, group]) => {
      const newest = group.slice().sort((a, b) => new Date(b.finishedAt) - new Date(a.finishedAt))[0]
      return {
        scenarioId,
        scenarioTitle: resolveScenarioTitle(getScenarioTitle, scenarioId, newest.language),
        completed: group.length,
        averageScore: meanRounded(group.map(session => session.score)),
      }
    })

  const trendBuckets = new Map(lastEightWeekStarts(now).map(weekStart => [weekStart, []]))
  for (const session of counted) {
    const weekStart = weekStartKey(session.finishedAt)
    if (trendBuckets.has(weekStart)) trendBuckets.get(weekStart).push(session.score)
  }
  const trend = [...trendBuckets.entries()].map(([weekStart, scores]) => ({
    weekStart,
    completed: scores.length,
    averageScore: meanRounded(scores),
  }))

  const checkpointGroups = new Map()
  for (const session of counted) {
    const items = Array.isArray(session.checkpointSummary) ? session.checkpointSummary : []
    const statusByCheckpoint = new Map()
    for (const item of items) {
      if (item?.status !== 'passed' && item?.status !== 'failed') continue
      if (statusByCheckpoint.get(item.id) === 'failed') continue
      statusByCheckpoint.set(item.id, item.status)
    }
    for (const [checkpointId, status] of statusByCheckpoint) {
      const key = `${session.scenarioId}\0${checkpointId}`
      if (!checkpointGroups.has(key)) {
        checkpointGroups.set(key, {
          scenarioId: session.scenarioId,
          checkpointId,
          language: session.language,
          finishedAt: session.finishedAt,
          passed: 0,
          failed: 0,
        })
      }
      const group = checkpointGroups.get(key)
      group[status] += 1
      if (new Date(session.finishedAt) > new Date(group.finishedAt)) {
        group.finishedAt = session.finishedAt
        group.language = session.language
      }
    }
  }
  const weakSpots = [...checkpointGroups.values()]
    .map(group => {
      const sample = group.passed + group.failed
      return {
        scenarioId: group.scenarioId,
        scenarioTitle: resolveScenarioTitle(getScenarioTitle, group.scenarioId, group.language),
        checkpointId: group.checkpointId,
        description: checkpointDescription(getCheckpointDescription, group.scenarioId, group.checkpointId),
        passRate: Math.round((group.passed / sample) * 100),
        sample,
      }
    })
    .filter(spot => spot.sample >= 3)
    .sort((a, b) => a.passRate - b.passRate || a.scenarioId.localeCompare(b.scenarioId) || a.checkpointId.localeCompare(b.checkpointId))
    .slice(0, 6)

  const pairs = new Map()
  for (const session of counted) {
    const key = `${session.userId}\0${session.scenarioId}`
    if (!pairs.has(key)) pairs.set(key, [])
    pairs.get(key).push(session)
  }
  const deltas = []
  for (const group of pairs.values()) {
    if (group.length < 2) continue
    const ordered = group.slice().sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt))
    deltas.push(ordered[ordered.length - 1].score - ordered[0].score)
  }
  const improvement = deltas.length === 0
    ? null
    : {
      learners: deltas.length,
      averageDelta: Math.round(deltas.reduce((total, delta) => total + delta, 0) / deltas.length),
    }

  return {
    org: { name: org.name, joinCode: org.joinCode },
    averageScore: meanRounded(allScores),
    completedSessions: allScores.length,
    employeeCount: employees.length,
    employees: employeeSummaries,
    scoreDistribution,
    byScenario,
    trend,
    weakSpots,
    improvement,
  }
}
