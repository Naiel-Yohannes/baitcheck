import { describe, expect, it } from 'vitest'
import { createFakeAi } from '../engine/fakeAi.js'

const scenario = { id: 'mobile-money-call' }
const ai = createFakeAi()

function historyWithUsers(count, text = 'hello') {
  const history = []
  for (let index = 0; index < count; index += 1) {
    history.push({ role: 'user', text: index === count - 1 ? text : `turn-${index}` })
    history.push({ role: 'attacker', text: 'ok' })
  }
  history.pop()
  return history
}

describe('createFakeAi', () => {
  it('is deterministic for the same history', async () => {
    const args = {
      scenario,
      language: 'en',
      stageIndex: 0,
      isFinal: false,
      history: historyWithUsers(1),
    }
    expect(await ai.generateReply(args)).toBe(await ai.generateReply(args))
  })

  it('picks canned lines from the user-message count', async () => {
    const first = await ai.generateReply({
      scenario, language: 'en', stageIndex: 0, isFinal: false, history: historyWithUsers(1),
    })
    const second = await ai.generateReply({
      scenario, language: 'en', stageIndex: 0, isFinal: false, history: historyWithUsers(2),
    })
    expect(first).not.toBe(second)
  })

  it('throws LLM_BUSY for /503 and LLM_FAILED for /502', async () => {
    await expect(ai.generateReply({
      scenario, language: 'en', stageIndex: 0, isFinal: false,
      history: [{ role: 'user', text: '/503' }],
    })).rejects.toMatchObject({ status: 503, code: 'LLM_BUSY' })

    await expect(ai.generateReply({
      scenario, language: 'en', stageIndex: 0, isFinal: false,
      history: [{ role: 'user', text: '/502' }],
    })).rejects.toMatchObject({ status: 502, code: 'LLM_FAILED' })
  })

  it('returns a short closing line when isFinal is true', async () => {
    const line = await ai.generateReply({
      scenario, language: 'en', stageIndex: 2, isFinal: true,
      history: [{ role: 'user', text: 'I will hang up now' }],
    })
    expect(line).toBeTruthy()
    expect(line.toLowerCase()).not.toMatch(/read out|code|wallet may stay blocked/)
  })

  it('returns Amharic lines for language am', async () => {
    const line = await ai.generateReply({
      scenario, language: 'am', stageIndex: 0, isFinal: false,
      history: [{ role: 'user', text: 'ሰላም' }],
    })
    expect(/[\u1200-\u137F]/.test(line)).toBe(true)

    const closing = await ai.generateReply({
      scenario, language: 'am', stageIndex: 0, isFinal: true,
      history: [{ role: 'user', text: 'ስልኩን እዘጋለሁ' }],
    })
    expect(/[\u1200-\u137F]/.test(closing)).toBe(true)
  })

  it('never emits links, emails, or long digit runs', async () => {
    const lines = []
    for (const language of ['en', 'am']) {
      lines.push(await ai.generateReply({
        scenario, language, stageIndex: 0, isFinal: true, history: [{ role: 'user', text: 'bye' }],
      }))
      for (const stageIndex of [0, 1, 2, 3]) {
        for (const count of [1, 2]) {
          lines.push(await ai.generateReply({
            scenario, language, stageIndex, isFinal: false, history: historyWithUsers(count),
          }))
        }
      }
    }

    expect(lines.some(line => line.includes('code') && line.includes('phone'))).toBe(true)
    for (const line of lines) {
      expect(line).not.toMatch(/\d{6,}/)
      expect(line.toLowerCase()).not.toContain('http')
      expect(line.toLowerCase()).not.toContain('www')
      expect(line).not.toContain('@')
    }
  })
})
