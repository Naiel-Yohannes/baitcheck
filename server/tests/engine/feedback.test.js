import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { buildFallbackFeedback, cleanFeedback } from '../../engine/feedback.js'

const scenario = JSON.parse(await readFile(fileURLToPath(new URL('../../scenarios/mobile-money-call.json', import.meta.url)), 'utf8'))

const results = [
  { id: 'a', status: 'passed', description: 'You verified the caller.' },
  { id: 'b', status: 'failed', description: 'You shared a code.' },
  { id: 'c', status: 'na', description: 'Not reached.' },
  { id: 'd', status: 'unjudged', description: 'Not judged.' },
]

describe('fallback feedback', () => {
  it('returns localized summaries, bounded arrays, and separates passed/failed descriptions', () => {
    const en = buildFallbackFeedback({ scenario, language: 'en', results, band: 'partial' })
    const am = buildFallbackFeedback({ scenario, language: 'am', results, band: 'strong' })
    expect(Object.keys(en)).toEqual(['summary', 'didWell', 'improve', 'nextTime'])
    expect(en.didWell).toEqual(['You verified the caller.'])
    expect(en.improve).toEqual(['Work on this: You shared a code.'])
    expect(en.summary).not.toBe(am.summary)
    expect(en.nextTime.length).toBeGreaterThanOrEqual(2)
    for (const feedback of [en, am]) {
      expect(feedback.didWell.length).toBeLessThanOrEqual(3)
      expect(feedback.improve.length).toBeLessThanOrEqual(3)
      expect(feedback.nextTime.length).toBeLessThanOrEqual(3)
    }
  })

  it('omits na and unjudged checkpoint descriptions', () => {
    const feedback = buildFallbackFeedback({ scenario, language: 'en', results, band: 'strong' })
    expect(JSON.stringify(feedback)).not.toContain('Not reached')
    expect(JSON.stringify(feedback)).not.toContain('Not judged')
  })
})

describe('cleanFeedback', () => {
  it('trims, sanitizes, removes fake data, and caps lists and text lengths', () => {
    const clean = cleanFeedback({
      summary: '  Visit https://safe-looking.example.com for details.  ',
      didWell: ['  Good choice.  ', 'Code 739204 disclosed.', 'Masked 7392 04 value.', 'PIN 4821 shared.', 'Fourth retained item.'],
      improve: ['First', 'Second', 'Third', 'Fourth'],
      nextTime: ['Next step'],
    }, { scenario })
    expect(clean.summary).toBe('Visit [link removed] for details.')
    expect(clean.didWell).toEqual(['Good choice.', 'Fourth retained item.'])
    expect(clean.improve).toEqual(['First', 'Second', 'Third'])
    expect(clean.nextTime).toEqual(['Next step'])

    const long = cleanFeedback({ summary: 's'.repeat(700), didWell: ['x'.repeat(400)], improve: [], nextTime: [] }, { scenario })
    expect(long.summary).toHaveLength(600)
    expect(long.didWell[0]).toHaveLength(300)
  })

  it('returns null for a missing summary or invalid array types', () => {
    expect(cleanFeedback({ didWell: [], improve: [], nextTime: [] }, { scenario })).toBeNull()
    expect(cleanFeedback({ summary: 'Valid', didWell: {}, improve: [], nextTime: [] }, { scenario })).toBeNull()
  })
})
