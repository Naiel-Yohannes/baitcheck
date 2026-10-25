import { AppError } from '../utils/errors.js'
import { pickScriptedLine } from '../engine/fakeAi.js'
import { cleanSpokenLine, containsFakeValue, isWrongScript, looksLikeRefusal, mentionsMeta } from './script.js'
import { buildAttackerPrompt } from './prompts.js'

function unusableReason(result, language, scenario) {
  if (result?.blockReason) return 'blocked'
  const text = cleanSpokenLine(result?.text)
  if (!text) return 'empty'
  if (mentionsMeta(text)) return 'meta_language'
  if (containsFakeValue(text, scenario)) return 'leaked_value'
  if (looksLikeRefusal(text)) return 'refusal'
  if (isWrongScript(text, language)) return 'wrong_script'
  return null
}

function reportEvent(onEvent, type, reason) {
  if (typeof onEvent === 'function') onEvent({ type, reason })
}

export async function generateAttackerReply(input, { llm, onEvent } = {}) {
  let retryReason = 'empty'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { system, prompt } = buildAttackerPrompt({ ...input, firm: attempt === 1 })
    let result
    try {
      result = await llm.generateText({
        system, prompt, temperature: attempt === 0 ? 0.9 : 0.6, maxOutputTokens: 300,
      })
    } catch (error) {
      if (error instanceof AppError && ['LLM_BUSY', 'LLM_FAILED'].includes(error.code)) throw error
      throw error
    }
    const reason = unusableReason(result, input.language, input.scenario)
    if (!reason) {
      return { text: cleanSpokenLine(result.text), source: attempt === 0 ? 'model' : 'retry' }
    }
    retryReason = reason
    if (attempt === 0) reportEvent(onEvent, 'retry', reason)
  }

  reportEvent(onEvent, 'scripted', retryReason)
  return {
    text: pickScriptedLine(input),
    source: 'scripted',
  }
}

export async function generateReply(input, deps) {
  return (await generateAttackerReply(input, deps)).text
}
