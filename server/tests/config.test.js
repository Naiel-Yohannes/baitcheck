import { describe, expect, it } from 'vitest'
import { loadConfig } from '../config.js'

function validEnv(overrides = {}) {
  return {
    PORT:           '5000',
    MONGO_URI:      'mongodb://localhost:27017/baitcheck',
    JWT_SECRET:     'a-very-long-secret-at-least-32-chars-yes',
    GEMINI_API_KEY: 'fake-gemini-key',
    LLM_MODEL:      'gemini-2.0-flash',
    CLIENT_URL:     'http://localhost:5173',
    NODE_ENV:       'test',
    ...overrides,
  }
}

describe('loadConfig — missing required variable', () => {
  it('names the missing variable in the error message', () => {
    const env = validEnv()
    delete env.MONGO_URI

    let err
    try { loadConfig(env) } catch (e) { err = e }

    expect(err).toBeDefined()
    expect(err.message).toContain('MONGO_URI')
  })

  it('does not include the variable value in the error message', () => {
    const env = validEnv()
    env.JWT_SECRET = 'tooshort'

    let err
    try { loadConfig(env) } catch (e) { err = e }

    expect(err).toBeDefined()
    expect(err.message).not.toContain('tooshort')
  })
})

describe('loadConfig — JWT_SECRET length', () => {
  it('rejects a secret shorter than 32 characters', () => {
    const env = validEnv({ JWT_SECRET: '31-chars-is-not-enough-xxxxxxxxx' })
    const short = 'a'.repeat(31)
    const env2 = validEnv({ JWT_SECRET: short })
    expect(() => loadConfig(env2)).toThrow()
  })

  it('accepts a secret of exactly 32 characters', () => {
    const env = validEnv({ JWT_SECRET: 'a'.repeat(32) })
    expect(() => loadConfig(env)).not.toThrow()
  })

  it('error message names JWT_SECRET but not its value', () => {
    const shortSecret = 'short'
    const env = validEnv({ JWT_SECRET: shortSecret })

    let err
    try { loadConfig(env) } catch (e) { err = e }

    expect(err).toBeDefined()
    expect(err.message).toContain('JWT_SECRET')
    expect(err.message).not.toContain(shortSecret)
  })
})

describe('loadConfig — LLM_MAX_RPM', () => {
  it('defaults to 10 when not set', () => {
    const env = validEnv()
    delete env.LLM_MAX_RPM
    const config = loadConfig(env)
    expect(config.LLM_MAX_RPM).toBe(10)
  })

  it('parses a provided positive integer', () => {
    const env = validEnv({ LLM_MAX_RPM: '25' })
    const config = loadConfig(env)
    expect(config.LLM_MAX_RPM).toBe(25)
  })

  it('rejects a non-positive value', () => {
    const env = validEnv({ LLM_MAX_RPM: '0' })
    expect(() => loadConfig(env)).toThrow()
  })

  it('rejects a non-integer string', () => {
    const env = validEnv({ LLM_MAX_RPM: 'abc' })
    expect(() => loadConfig(env)).toThrow()
  })
})

describe('loadConfig — clientOrigins', () => {
  it('splits CLIENT_URL on commas and trims each origin', () => {
    const env = validEnv({
      CLIENT_URL: 'http://localhost:5173 , https://app.example.com , https://staging.example.com',
    })
    const config = loadConfig(env)
    expect(config.clientOrigins).toEqual([
      'http://localhost:5173',
      'https://app.example.com',
      'https://staging.example.com',
    ])
  })
})

describe('loadConfig — returned object', () => {
  it('is frozen', () => {
    const config = loadConfig(validEnv())
    expect(Object.isFrozen(config)).toBe(true)
  })

  it('parses PORT as a number', () => {
    const config = loadConfig(validEnv({ PORT: '3000' }))
    expect(config.PORT).toBe(3000)
    expect(typeof config.PORT).toBe('number')
  })
})
