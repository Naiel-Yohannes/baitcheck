// Gemini powers attacker dialogue only for now; the judge and feedback remain the existing deterministic fake implementations.
import { generateReply } from './attacker.js'

export function createGeminiAi({ config, llm, fallbackAi }) {
  return {
    generateReply: input => generateReply(input, { llm }),
    judgeCheckpoints: input => fallbackAi.judgeCheckpoints(input),
    generateFeedback: input => fallbackAi.generateFeedback(input),
  }
}
