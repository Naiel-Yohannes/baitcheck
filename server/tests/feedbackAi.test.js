import { describe, expect, it, vi } from 'vitest'
import { createFeedbackWriter } from '../ai/feedbackAi.js'
import { llmFailed } from '../utils/errors.js'

const config = { LLM_MODEL_JUDGE: 'review-model' }
const results = [
  { id: 'passed', status: 'passed', description: 'You checked carefully.' },
  { id: 'failed', status: 'failed', description: 'You shared a code.' },
  { id: 'na', status: 'na', description: 'Not reached.' },
  { id: 'unjudged', status: 'unjudged', description: 'Not evaluated.' },
]
const validEnglish = { summary: 'You checked carefully. Keep using official channels.', didWell: ['You paused.'], improve: ['Do not share codes.'], nextTime: ['Verify independently.', 'End suspicious calls.'] }

describe('Gemini feedback writer', () => {
  it('omits na and unjudged results, includes score and band, and applies the English directive', async () => {
    const llm = { generateJSON: vi.fn(async () => validEnglish) }
    const writer = createFeedbackWriter({ llm, config })
    await expect(writer({ scenario: { persona: { fakeData: [{ value: '739204' }] } }, language: 'en', results, score: 71, band: 'resilient', userMessages: [{ text: 'I will verify.' }] })).resolves.toBe(validEnglish)
    const { system, prompt } = llm.generateJSON.mock.calls[0][0]
    expect(prompt).toContain('Band key: resilient')
    expect(prompt).toContain('Score: 71')
    expect(prompt).toContain('passed: You checked carefully.')
    expect(prompt).toContain('failed: You shared a code.')
    expect(prompt).not.toContain('Not reached')
    expect(prompt).not.toContain('Not evaluated')
    expect(prompt).not.toContain('739204')
    expect(system).toContain('For "en", write ONLY in English.')
    expect(llm.generateJSON).toHaveBeenCalledWith(expect.objectContaining({
      temperature: 0.4, maxOutputTokens: 800, model: 'review-model',
    }))
  })

  it('uses the Amharic directive and rejects a wrong-script summary', async () => {
    const llm = { generateJSON: vi.fn().mockResolvedValue({
      summary: 'This is English.', didWell: ['ጥሩ ምርጫ ነው።'], improve: [], nextTime: ['ይፋዊ መንገድ ይጠቀሙ።'],
    }) }
    const writer = createFeedbackWriter({ llm, config })
    await expect(writer({ language: 'am', results: [], score: 50, band: 'partial', userMessages: [] }))
      .rejects.toMatchObject({ code: 'LLM_FAILED' })
    expect(llm.generateJSON.mock.calls[0][0].system).toContain('For "am", write ONLY Amharic in Ge\'ez script.')
  })

  it('rejects non-string list items and wrong-script Amharic feedback', async () => {
    const llm = { generateJSON: vi.fn()
      .mockResolvedValueOnce({ ...validEnglish, didWell: ['good', 7] })
      .mockResolvedValueOnce({ summary: 'ጥሩ ምርጫ ነው።', didWell: ['ጥሩ ምርጫ ነው።'], improve: [], nextTime: ['ይፋዊ መንገድ ይጠቀሙ።'] }) }
    const writer = createFeedbackWriter({ llm, config })
    await expect(writer({ language: 'en', results: [], score: 5, band: 'vulnerable', userMessages: [] })).rejects.toMatchObject({ code: 'LLM_FAILED' })
    await expect(writer({ language: 'am', results: [], score: 80, band: 'resilient', userMessages: [] })).resolves.toMatchObject({ didWell: ['ጥሩ ምርጫ ነው።'] })
  })

  it('propagates provider failures', async () => {
    const llm = { generateJSON: vi.fn().mockRejectedValue(llmFailed()) }
    const writer = createFeedbackWriter({ llm, config })
    await expect(writer({ language: 'en', results: [], score: 0, band: 'vulnerable', userMessages: [] }))
      .rejects.toMatchObject({ code: 'LLM_FAILED' })
  })
})
