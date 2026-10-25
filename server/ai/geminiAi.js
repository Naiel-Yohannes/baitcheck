// Gemini-backed adapters provide the attacker, checkpoint judge, and feedback writer. fallbackAi is an optional compatibility argument and is not used by the judge or feedback writer.
import { generateReply } from './attacker.js'
import { createJudge } from './judge.js'
import { createFeedbackWriter } from './feedbackAi.js'

export function createGeminiAi({ config, llm, fallbackAi: _fallbackAi } = {}) {
  const judgeCheckpoints = createJudge({ llm, config })
  const generateFeedback = createFeedbackWriter({ llm, config })
  return {
    generateReply: input => generateReply(input, { llm }),
    judgeCheckpoints,
    generateFeedback,
  }
}
