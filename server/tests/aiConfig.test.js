import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config.js'

function validEnv(overrides = {}) {
  return {
    PORT: '5000', MONGO_URI: 'mongodb://localhost:27017/baitcheck',
    JWT_SECRET: 'a-very-long-secret-at-least-32-chars-yes', GEMINI_API_KEY: 'test-key',
    LLM_MODEL: 'test-model', CLIENT_URL: 'http://localhost:5173', NODE_ENV: 'test',
    ...overrides,
  }
}

describe('optional AI configuration', () => {
  it('uses timeout and null defaults', () => {
    const config = loadConfig(validEnv())
    expect(config.LLM_TIMEOUT_MS).toBe(20000)
    expect(config.LLM_THINKING_LEVEL).toBeNull()
    expect(config.LLM_MODEL_JUDGE).toBeNull()
    expect(config.AI_FALLBACK_TO_SCRIPT).toBe(false)
  })

  it('parses optional values and trims the judge model', () => {
    const config = loadConfig(validEnv({
      LLM_TIMEOUT_MS: '4500', LLM_THINKING_LEVEL: 'medium', LLM_MODEL_JUDGE: ' judge-model ',
    }))
    expect(config.LLM_TIMEOUT_MS).toBe(4500)
    expect(config.LLM_THINKING_LEVEL).toBe('medium')
    expect(config.LLM_MODEL_JUDGE).toBe('judge-model')
  })

  it.each(['0', '-1', '2.5', '3seconds'])('rejects invalid timeout %s by variable name', value => {
    expect(() => loadConfig(validEnv({ LLM_TIMEOUT_MS: value }))).toThrow('LLM_TIMEOUT_MS')
  })

  it('rejects unsupported thinking levels by variable name', () => {
    expect(() => loadConfig(validEnv({ LLM_THINKING_LEVEL: 'ultra' }))).toThrow('LLM_THINKING_LEVEL')
  })

  it.each([['true', true], ['false', false]])('parses AI_FALLBACK_TO_SCRIPT=%s', (value, expected) => {
    expect(loadConfig(validEnv({ AI_FALLBACK_TO_SCRIPT: value })).AI_FALLBACK_TO_SCRIPT).toBe(expected)
  })

  it('rejects invalid AI_FALLBACK_TO_SCRIPT by variable name', () => {
    expect(() => loadConfig(validEnv({ AI_FALLBACK_TO_SCRIPT: 'yes' }))).toThrow('AI_FALLBACK_TO_SCRIPT')
  })
})
