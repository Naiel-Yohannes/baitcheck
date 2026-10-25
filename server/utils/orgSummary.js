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

export function buildOrgSummary({ org, employees, sessions, getScenarioTitle }) {
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

  const allScores = employeeSummaries.flatMap(employee => employee.sessions.map(session => session.score))

  return {
    org: { name: org.name, joinCode: org.joinCode },
    averageScore: meanRounded(allScores),
    completedSessions: allScores.length,
    employeeCount: employees.length,
    employees: employeeSummaries,
  }
}
