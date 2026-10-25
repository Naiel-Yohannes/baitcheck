/**
 * server/config.js
 * Validates and returns a frozen configuration object from environment variables.
 * loadConfig must not read files or call process.exit.
 */

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {Readonly<{
 *   PORT: number,
 *   MONGO_URI: string,
 *   JWT_SECRET: string,
 *   GEMINI_API_KEY: string,
 *   LLM_MODEL: string,
 *   CLIENT_URL: string,
 *   NODE_ENV: string,
 *   LLM_MAX_RPM: number,
 *   LLM_TIMEOUT_MS: number,
 *   LLM_THINKING_LEVEL: string|null,
 *   LLM_MODEL_JUDGE: string|null,
 *   clientOrigins: string[],
 * }>}
 */
export function loadConfig(env = process.env) {
  const missing = []
  const invalid = []

  // ── Required string fields ─────────────────────────────────────
  const required = [
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
    'GEMINI_API_KEY',
    'LLM_MODEL',
    'CLIENT_URL',
    'NODE_ENV',
  ]

  const values = {}
  for (const key of required) {
    const val = typeof env[key] === 'string' ? env[key].trim() : ''
    if (!val) {
      missing.push(key)
    } else {
      values[key] = val
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`
    )
  }

  // ── PORT must be a positive integer ───────────────────────────
  const PORT = parseInt(values.PORT, 10)
  if (!Number.isInteger(PORT) || PORT <= 0) {
    invalid.push('PORT (must be a positive integer)')
  }

  // ── JWT_SECRET must be at least 32 characters ─────────────────
  if (values.JWT_SECRET.length < 32) {
    invalid.push('JWT_SECRET (must be at least 32 characters)')
  }

  // ── Optional LLM_MAX_RPM: positive integer, default 10 ────────
  let LLM_MAX_RPM = 10
  if (env.LLM_MAX_RPM !== undefined && env.LLM_MAX_RPM !== '') {
    const parsed = parseInt(env.LLM_MAX_RPM, 10)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      invalid.push('LLM_MAX_RPM (must be a positive integer)')
    } else {
      LLM_MAX_RPM = parsed
    }
  }

  let LLM_TIMEOUT_MS = 20000
  if (env.LLM_TIMEOUT_MS !== undefined && env.LLM_TIMEOUT_MS !== '') {
    const raw = String(env.LLM_TIMEOUT_MS).trim()
    const parsed = /^\d+$/.test(raw) ? Number(raw) : NaN
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      invalid.push('LLM_TIMEOUT_MS (must be a positive integer)')
    } else {
      LLM_TIMEOUT_MS = parsed
    }
  }

  const allowedThinkingLevels = ['minimal', 'low', 'medium', 'high']
  let LLM_THINKING_LEVEL = null
  if (env.LLM_THINKING_LEVEL !== undefined && String(env.LLM_THINKING_LEVEL).trim() !== '') {
    const level = String(env.LLM_THINKING_LEVEL).trim()
    if (!allowedThinkingLevels.includes(level)) {
      invalid.push('LLM_THINKING_LEVEL (must be minimal, low, medium, or high)')
    } else {
      LLM_THINKING_LEVEL = level
    }
  }

  let LLM_MODEL_JUDGE = null
  if (env.LLM_MODEL_JUDGE !== undefined && String(env.LLM_MODEL_JUDGE).trim() !== '') {
    LLM_MODEL_JUDGE = String(env.LLM_MODEL_JUDGE).trim()
  }

  if (invalid.length > 0) {
    throw new Error(
      `Invalid environment variable(s): ${invalid.join('; ')}`
    )
  }

  const clientOrigins = values.CLIENT_URL.split(',').map(s => s.trim()).filter(Boolean)

  return Object.freeze({
    PORT,
    MONGO_URI:       values.MONGO_URI,
    JWT_SECRET:      values.JWT_SECRET,
    GEMINI_API_KEY:  values.GEMINI_API_KEY,
    LLM_MODEL:       values.LLM_MODEL,
    CLIENT_URL:      values.CLIENT_URL,
    NODE_ENV:        values.NODE_ENV,
    LLM_MAX_RPM,
    LLM_TIMEOUT_MS,
    LLM_THINKING_LEVEL,
    LLM_MODEL_JUDGE,
    clientOrigins,
  })
}
