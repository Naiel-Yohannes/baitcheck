import { describe, expect, it, vi } from 'vitest'
import { JUDGE_MAX_ATTEMPTS, runJudge, validateJudgeResults, verifyEvidence } from '../../engine/judge.js'

describe('judge result validation', () => {
  it('accepts arrays and the wrapped results shape, normalizing absent evidence', () => {
    expect(validateJudgeResults([
      { id: 'a', passed: true }, { id: 'b', passed: false, evidence: null },
    ], ['a', 'b'])).toEqual({
      ok: true,
      results: [{ id: 'a', passed: true, evidence: null }, { id: 'b', passed: false, evidence: null }],
    })
    expect(validateJudgeResults({ results: [{ id: 'a', passed: true, evidence: 'yes' }] }, ['a']))
      .toMatchObject({ ok: true, results: [{ evidence: 'yes' }] })
  })

  it('rejects missing, extra, duplicate, or invalid result fields', () => {
    const invalid = [
      [{ passed: true }],
      [{ id: 'a', passed: true }, { id: 'extra', passed: true }],
      [{ id: 'a', passed: true }, { id: 'a', passed: false }],
      [{ id: 'a', passed: 'true' }],
      [{ id: 'a', passed: true, evidence: 12 }],
    ]
    for (const raw of invalid) expect(validateJudgeResults(raw, ['a'])).toEqual({ ok: false })
  })

  it('verifies evidence against user text, case-insensitively, and cuts it to 120 characters', () => {
    expect(verifyEvidence('VERIFY', ['I will verify that independently'])).toBe('VERIFY')
    expect(verifyEvidence('absent', ['nothing to see'])).toBeNull()
    const evidence = 'x'.repeat(150)
    expect(verifyEvidence(evidence, [`prefix ${evidence}`])).toBe('x'.repeat(120))
    expect(verifyEvidence('   ', ['anything'])).toBeNull()
  })
})

describe('runJudge', () => {
  const args = {
    scenario: {}, language: 'en', checkpoints: [{ id: 'a' }], userMessages: [{ text: 'I will verify' }],
  }

  it('returns the first valid result without a second call', async () => {
    const judge = vi.fn().mockResolvedValue([{ id: 'a', passed: true, evidence: 'verify' }])
    expect(await runJudge({ ...args, judge })).toEqual({
      ok: true, results: [{ id: 'a', passed: true, evidence: 'verify' }],
    })
    expect(judge).toHaveBeenCalledTimes(1)
  })

  it('retries invalid output once and then returns valid output', async () => {
    const judge = vi.fn()
      .mockResolvedValueOnce([{ id: 'extra', passed: true }])
      .mockResolvedValueOnce([{ id: 'a', passed: true }])
    expect(await runJudge({ ...args, judge })).toEqual({ ok: true, results: [{ id: 'a', passed: true, evidence: null }] })
    expect(judge).toHaveBeenCalledTimes(2)
    expect(JUDGE_MAX_ATTEMPTS).toBe(2)
  })

  it('returns failure after two invalid results or thrown errors and never throws', async () => {
    const invalid = vi.fn().mockResolvedValue([{ id: 'a', passed: 'yes' }])
    await expect(runJudge({ ...args, judge: invalid })).resolves.toEqual({ ok: false })
    expect(invalid).toHaveBeenCalledTimes(2)
    const throwing = vi.fn().mockRejectedValue(new Error('failure'))
    await expect(runJudge({ ...args, judge: throwing })).resolves.toEqual({ ok: false })
    expect(throwing).toHaveBeenCalledTimes(2)
  })
})
