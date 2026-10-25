import { GoogleGenAI } from '@google/genai'
import { llmBusy, llmFailed } from '../utils/errors.js'

const sleepDefault = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function statusOf(error) {
  const value = error?.statusCode ?? error?.status ?? error?.response?.status
  const status = Number(value)
  return Number.isInteger(status) ? status : null
}

function isQuotaError(error, status) {
  if (status === 429) return true
  const marker = `${error?.code ?? ''} ${error?.status ?? ''} ${error?.message ?? ''}`.toLowerCase()
  return /resource[_ -]?exhausted|quota/.test(marker)
}

function isTransient(error, status) {
  if (error?.code === 'LLM_TIMEOUT') return true
  if (status !== null) return [500, 502, 503, 504].includes(status)
  return true // Errors without an HTTP status are network or transport failures.
}

function parseJsonText(value) {
  const text = String(value ?? '').trim()
  if (!text) throw new SyntaxError('Empty JSON output')
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  if (!unfenced) throw new SyntaxError('Empty JSON output')
  return JSON.parse(unfenced)
}

function withCause(mappedError, cause) {
  mappedError.cause = cause
  return mappedError
}

export function createLlm({ config, client, now = Date.now, sleep = sleepDefault, maxCalls = Infinity }) {
  let sdkClient = client
  const callTimestamps = []
  let totalCalls = 0

  function getClient() {
    if (!sdkClient) sdkClient = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY })
    return sdkClient
  }

  function pruneTimestamps() {
    const cutoff = now() - 60000
    while (callTimestamps.length && callTimestamps[0] <= cutoff) callTimestamps.shift()
  }

  function getCallCountLastMinute() {
    pruneTimestamps()
    return callTimestamps.length
  }

  async function providerAttempt({ model, prompt, system, temperature, maxOutputTokens, json }) {
    pruneTimestamps()
    if (callTimestamps.length >= config.LLM_MAX_RPM || totalCalls >= maxCalls) throw llmBusy()
    totalCalls += 1
    callTimestamps.push(now())

    const requestConfig = { systemInstruction: system, temperature, maxOutputTokens }
    if (json) requestConfig.responseMimeType = 'application/json'
    const thinkingLevels = { minimal: 'minimal', low: 'low', medium: 'medium', high: 'high' }
    // A legacy injected test client may not implement the SDK v2 models surface.
    const supportsSdkV2 = !client || typeof getClient().models?.list === 'function'
    if (supportsSdkV2 && thinkingLevels[config.LLM_THINKING_LEVEL]) {
      requestConfig.thinkingConfig = { thinkingLevel: thinkingLevels[config.LLM_THINKING_LEVEL] }
    }
    const params = { model, contents: prompt, config: requestConfig }

    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Provider request timed out')
        error.code = 'LLM_TIMEOUT'
        reject(error)
      }, config.LLM_TIMEOUT_MS)
      timer.unref?.()
    })
    try {
      return await Promise.race([getClient().models.generateContent(params), timeout])
    } finally {
      clearTimeout(timer)
    }
  }

  function reportConfigurationProblem(error) {
    const status = statusOf(error)
    if ([400, 401, 403, 404].includes(status)) {
      console.error(`LLM configuration problem (status ${status}): check GEMINI_API_KEY and LLM_MODEL`)
    }
  }

  async function getResponse({ model, prompt, system, temperature, maxOutputTokens, json, retryState }) {
    let retryUsedForQuota = false
    while (true) {
      try {
        return await providerAttempt({ model, prompt, system, temperature, maxOutputTokens, json })
      } catch (error) {
        if (error?.code === 'LLM_BUSY' || error?.code === 'LLM_FAILED') throw error
        const status = statusOf(error)
        if (isQuotaError(error, status)) throw withCause(llmBusy(), error)
        reportConfigurationProblem(error)
        if (!isTransient(error, status) || retryState.remaining <= 0) {
          if (status === 503 || retryUsedForQuota) throw withCause(llmBusy(), error)
          throw withCause(llmFailed(), error)
        }
        retryState.remaining -= 1
        retryUsedForQuota = status === 503
        await sleep(500)
      }
    }
  }

  function getTextResult(response) {
    const text = typeof response?.text === 'string' ? response.text : ''
    const blockReason = response?.promptFeedback?.blockReason
      ? String(response.promptFeedback.blockReason)
      : (text ? null : 'NO_TEXT')
    return {
      text,
      blockReason,
      finishReason: response?.candidates?.[0]?.finishReason ?? null,
    }
  }

  function logCall(model, result, startedAt) {
    const durationMs = Math.max(0, now() - startedAt)
    console.info(`LLM call model=${model} result=${result} durationMs=${durationMs}`)
  }

  async function generateText({ system, prompt, temperature = 1, maxOutputTokens = 300, model = config.LLM_MODEL }) {
    const startedAt = now()
    try {
      const response = await getResponse({
        model, prompt, system, temperature, maxOutputTokens, json: false, retryState: { remaining: 1 },
      })
      const result = getTextResult(response)
      logCall(model, result.blockReason ? 'blocked' : 'ok', startedAt)
      return result
    } catch (error) {
      logCall(model, 'error', startedAt)
      throw error?.code === 'LLM_BUSY' || error?.code === 'LLM_FAILED' ? error : llmFailed()
    }
  }

  async function generateJSON({ system, prompt, temperature = 0, maxOutputTokens = 800, model = config.LLM_MODEL }) {
    const startedAt = now()
    const retryState = { remaining: 1 }
    try {
      while (true) {
        const response = await getResponse({ model, prompt, system, temperature, maxOutputTokens, json: true, retryState })
        const result = getTextResult(response)
        if (result.blockReason && !result.text) {
          if (retryState.remaining <= 0) throw llmFailed()
          retryState.remaining -= 1
          await sleep(500)
          continue
        }
        try {
          const parsed = parseJsonText(result.text)
          logCall(model, 'ok', startedAt)
          return parsed
        } catch {
          if (retryState.remaining <= 0) throw llmFailed()
          retryState.remaining -= 1
          await sleep(500)
        }
      }
    } catch (error) {
      logCall(model, 'error', startedAt)
      throw error?.code === 'LLM_BUSY' || error?.code === 'LLM_FAILED' ? error : llmFailed()
    }
  }

  async function listModelIds() {
    const models = getClient().models
    if (typeof models?.list !== 'function') {
      const error = new Error('The installed SDK does not expose models.list().')
      error.code = 'MODEL_LIST_UNSUPPORTED'
      throw error
    }
    const pager = await models.list()
    const ids = []
    for await (const model of pager) {
      if (!Array.isArray(model?.supportedActions) || !model.supportedActions.includes('generateContent')) continue
      if (typeof model.name !== 'string' || !model.name) continue
      ids.push(model.name.replace(/^models\//, ''))
    }
    return [...new Set(ids)].sort()
  }

  return { generateText, generateJSON, listModelIds, getCallCountLastMinute }
}
