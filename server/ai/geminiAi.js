import { AppError } from '../utils/errors.js'
import { pickScriptedLine } from '../engine/fakeAi.js'
import { generateReply } from './attacker.js'
import { createJudge } from './judge.js'
import { createFeedbackWriter } from './feedbackAi.js'

export function createGeminiAi({ config, llm, fallbackAi: _fallbackAi } = {}) {
  const judgeCheckpoints = createJudge({ llm, config })
  const generateFeedback = createFeedbackWriter({ llm, config })
  async function generateAttackerReply(input) {
    try {
      return await generateReply(input, { llm })
    } catch (error) {
      if (config?.AI_FALLBACK_TO_SCRIPT === true && error instanceof AppError && ['LLM_BUSY', 'LLM_FAILED'].includes(error.code)) {
        console.warn(`LLM unavailable, using scripted line (code ${error.code})`)
        return pickScriptedLine(input)
      }
      throw error
    }
  }
  return {
    generateReply: generateAttackerReply,
    judgeCheckpoints,
    generateFeedback,
  }
}
