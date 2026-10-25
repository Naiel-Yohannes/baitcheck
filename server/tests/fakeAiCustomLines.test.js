import { describe, expect, it } from 'vitest'
import { createFakeAi } from '../engine/fakeAi.js'

describe('fake AI custom scenario lines', () => {
  it('selects stage lines deterministically by language and user message count', async () => {
    const ai = createFakeAi()
    const scenario = {
      _fakeLines: {
        en: { stages: [['English first', 'English second']], final: 'English close' },
        am: { stages: [['አማርኛ አንድ', 'አማርኛ ሁለት']], final: 'የአማርኛ መዝጊያ' },
      },
    }
    const history = [
      { role: 'user', text: 'one' },
    ]

    await expect(ai.generateReply({ scenario, language: 'en', stageIndex: 0, isFinal: false, history }))
      .resolves.toBe('English second')
    await expect(ai.generateReply({ scenario, language: 'am', stageIndex: 0, isFinal: false, history }))
      .resolves.toBe('አማርኛ ሁለት')
  })

  it('uses the custom final line when available', async () => {
    const ai = createFakeAi()
    await expect(ai.generateReply({
      scenario: { _fakeLines: { en: { stages: [], final: 'Custom close' } } },
      language: 'en', stageIndex: 0, isFinal: true, history: [],
    })).resolves.toBe('Custom close')
  })

  it('preserves existing canned behavior when custom lines are absent', async () => {
    const ai = createFakeAi()
    await expect(ai.generateReply({
      scenario: {}, language: 'en', stageIndex: 0, isFinal: false,
      history: [{ role: 'user', text: 'hello' }],
    })).resolves.toBe('We opened a review on the wallet and I must verify it with you now.')
    await expect(ai.generateReply({
      scenario: {}, language: 'en', stageIndex: 0, isFinal: true, history: [],
    })).resolves.toBe('Alright, I will end the call here. Take care.')
  })
})
