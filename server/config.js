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
    clientOrigins,
  })
}
