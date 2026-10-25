export function getStageIndex(turnCount, scenario) {
  const turnsPerStage = scenario?.turnsPerStage ?? 2
  const stageCount = Array.isArray(scenario?.stages) ? scenario.stages.length : 0
  return Math.min(Math.floor(turnCount / turnsPerStage), stageCount - 1)
}

export function getEndReason({ text, turnCount, scenario, language }) {
  const body = typeof text === 'string' ? text.toLowerCase() : ''
  const signals = scenario?.endSignals?.[language]
  if (Array.isArray(signals) && signals.some(phrase => typeof phrase === 'string' && phrase && body.includes(phrase.toLowerCase()))) {
    return 'end_signal'
  }

  if (turnCount >= scenario?.maxTurns) return 'max_turns'
  const turnsPerStage = scenario?.turnsPerStage ?? 2
  const stageCount = Array.isArray(scenario?.stages) ? scenario.stages.length : 0
  if (turnCount >= turnsPerStage * (stageCount - 1) + 1) return 'scenario_complete'
  return null
}

export function stagePosition(scenario, stageId) {
  if (!Array.isArray(scenario?.stages)) return -1
  return scenario.stages.findIndex(stage => stage?.id === stageId)
}
