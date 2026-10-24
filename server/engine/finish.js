import { evaluateCodeCheckpoints, computeScore, bandForScore, isCheckpointApplicable } from './scoring.js'
import { runJudge } from './judge.js'
import { buildFallbackFeedback, cleanFeedback } from './feedback.js'

export async function buildSessionReport({ session, scenario, ai, now = new Date() }) {
  const language = session.language
  const endReason = session.endReason ?? 'user_button'
  const messages = Array.isArray(session.messages) ? session.messages : []
  const userMessages = messages
    .filter(message => message?.role === 'user')
    .map(message => ({ text: message.text }))

  const codeResults = evaluateCodeCheckpoints({
    scenario,
    messages,
    stageIndex: session.stageIndex,
    endReason,
    language,
  })
  const codeResultsById = new Map(codeResults.map(result => [result.id, result]))
  const applicableAiCheckpoints = scenario.checkpoints
    .filter(checkpoint => checkpoint.detection === 'ai' && isCheckpointApplicable(checkpoint, scenario, session.stageIndex))

  let judged = { ok: true, results: [] }
  if (applicableAiCheckpoints.length > 0) {
    judged = await runJudge({
      judge: ai?.judgeCheckpoints,
      scenario: JSON.parse(JSON.stringify(scenario)),
      language,
      checkpoints: applicableAiCheckpoints.map(checkpoint => ({
        id: checkpoint.id,
        description: checkpoint.description[language],
      })),
      userMessages: JSON.parse(JSON.stringify(userMessages)),
    })
  }
  const aiResultsById = new Map((judged.results ?? []).map(result => [result.id, result]))

  let degraded = false
  const merged = scenario.checkpoints.map(checkpoint => {
    let status
    let evidence = null
    if (checkpoint.detection === 'code') {
      const result = codeResultsById.get(checkpoint.id)
      status = result?.status ?? 'unjudged'
      evidence = result?.evidence ?? null
    } else if (!isCheckpointApplicable(checkpoint, scenario, session.stageIndex)) {
      status = 'na'
    } else if (!judged.ok) {
      status = 'unjudged'
      degraded = true
    } else {
      const result = aiResultsById.get(checkpoint.id)
      status = result ? (result.passed ? 'passed' : 'failed') : 'unjudged'
      if (!result) degraded = true
      else if (result.passed) evidence = result.evidence
    }
    return {
      id: checkpoint.id,
      weight: checkpoint.weight,
      method: checkpoint.detection,
      status,
      description: checkpoint.description[language],
      evidence,
    }
  })

  const score = computeScore(merged, scenario)
  const band = bandForScore(score)
  let feedback = null
  try {
    const rawFeedback = await ai.generateFeedback({
      scenario: JSON.parse(JSON.stringify(scenario)),
      language,
      results: JSON.parse(JSON.stringify(merged)),
      score,
      band,
      userMessages: JSON.parse(JSON.stringify(userMessages)),
    })
    feedback = cleanFeedback(rawFeedback, { scenario })
  } catch {
    feedback = null
  }
  if (!feedback) feedback = buildFallbackFeedback({ scenario, language, results: merged, band })

  const turnsPerStage = scenario.turnsPerStage ?? 2
  const timeline = []
  for (let index = 0; index <= session.stageIndex && index < scenario.stages.length; index += 1) {
    const stage = scenario.stages[index]
    timeline.push({
      stageId: stage.id,
      technique: stage.technique[language],
      explanation: stage.explanation[language],
      startedAtTurn: index * turnsPerStage,
    })
  }

  return {
    report: {
      score,
      band,
      degraded,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title[language],
      language,
      endReason,
      turnCount: session.turnCount,
      checkpoints: merged,
      timeline,
      feedback,
      createdAt: now.toISOString(),
    },
    endReason,
  }
}
