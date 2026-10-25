import { cut, isDigitsOnly } from './text.js'
import { stagePosition } from './stages.js'

export const BAND_THRESHOLDS = Object.freeze({ partial: 40, resilient: 70, strong: 90 })

export function bandForScore(score) {
  if (score < BAND_THRESHOLDS.partial) return 'vulnerable'
  if (score < BAND_THRESHOLDS.resilient) return 'partial'
  if (score < BAND_THRESHOLDS.strong) return 'resilient'
  return 'strong'
}

export function isCheckpointApplicable(checkpoint, scenario, stageIndex) {
  if (!checkpoint?.requiresStage) return true
  const position = stagePosition(scenario, checkpoint.requiresStage)
  return position !== -1 && stageIndex >= position
}

export function evaluateCodeCheckpoints({ scenario, messages, stageIndex, endReason, language }) {
  const fakeDataByKey = new Map((scenario?.persona?.fakeData ?? [])
    .filter(item => item && typeof item.key === 'string')
    .map(item => [item.key, item.value]))
  const userMessages = (Array.isArray(messages) ? messages : [])
    .filter(message => message?.role === 'user' && typeof message.text === 'string')

  return (Array.isArray(scenario?.checkpoints) ? scenario.checkpoints : [])
    .filter(checkpoint => checkpoint?.detection === 'code')
    .map(checkpoint => {
      if (!isCheckpointApplicable(checkpoint, scenario, stageIndex)) {
        return { id: checkpoint.id, status: 'na', evidence: null }
      }

      if (checkpoint.rule === 'leak') {
        const fakeValues = (Array.isArray(checkpoint.keys) ? checkpoint.keys : [])
          .map(key => fakeDataByKey.get(key))
          .filter(value => typeof value === 'string' && value.length > 0)
        for (const message of userMessages) {
          for (const value of fakeValues) {
            if (isDigitsOnly(value)) {
              const digits = value.replace(/[\s.\-]/g, '')
              const normalizedMessage = message.text.replace(/[\s.\-]/g, '')
              if (normalizedMessage.includes(digits)) {
                return { id: checkpoint.id, status: 'failed', evidence: cut(message.text, 120) }
              }
            } else if (message.text.toLowerCase().includes(value.toLowerCase())) {
              return { id: checkpoint.id, status: 'failed', evidence: cut(message.text, 120) }
            }
          }
        }
        return { id: checkpoint.id, status: 'passed', evidence: null }
      }

      if (checkpoint.rule === 'endedBy') {
        return {
          id: checkpoint.id,
          status: ['user_button', 'end_signal'].includes(endReason) ? 'passed' : 'failed',
          evidence: null,
        }
      }

      if (checkpoint.rule === 'keyword') {
        const keywords = checkpoint.keywords?.[language]
        for (const message of userMessages) {
          if (Array.isArray(keywords) && keywords.some(keyword =>
            typeof keyword === 'string' && keyword && message.text.toLowerCase().includes(keyword.toLowerCase()))) {
            return { id: checkpoint.id, status: 'passed', evidence: cut(message.text, 120) }
          }
        }
        return { id: checkpoint.id, status: 'failed', evidence: null }
      }

      return { id: checkpoint.id, status: 'failed', evidence: null }
    })
}

export function computeScore(results, scenario) {
  const weights = new Map((scenario?.checkpoints ?? []).map(checkpoint => [checkpoint.id, checkpoint.weight]))
  const applicable = (Array.isArray(results) ? results : [])
    .filter(result => result?.status === 'passed' || result?.status === 'failed')
  const totalWeight = applicable.reduce((sum, result) => sum + (weights.get(result.id) ?? 0), 0)
  if (totalWeight === 0) return 0
  const passedWeight = applicable
    .filter(result => result.status === 'passed')
    .reduce((sum, result) => sum + (weights.get(result.id) ?? 0), 0)
  return Math.round(100 * passedWeight / totalWeight)
}
