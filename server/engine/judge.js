import { cut } from './text.js'

export const JUDGE_MAX_ATTEMPTS = 2

export function validateJudgeResults(raw, requestedIds) {
  const requested = Array.isArray(requestedIds) ? requestedIds : []
  const candidate = Array.isArray(raw) ? raw : raw && Array.isArray(raw.results) ? raw.results : null
  if (!candidate || candidate.length !== requested.length) return { ok: false }

  const requestedSet = new Set(requested)
  const seen = new Set()
  const results = []
  for (const item of candidate) {
    if (
      !item || typeof item !== 'object' || Array.isArray(item) ||
      typeof item.id !== 'string' || typeof item.passed !== 'boolean' ||
      !(item.evidence === undefined || item.evidence === null || typeof item.evidence === 'string') ||
      !requestedSet.has(item.id) || seen.has(item.id)
    ) return { ok: false }
    seen.add(item.id)
    results.push({ id: item.id, passed: item.passed, evidence: item.evidence ?? null })
  }

  if (seen.size !== requestedSet.size || requested.some(id => !seen.has(id))) return { ok: false }
  return { ok: true, results }
}

export function verifyEvidence(evidence, userMessageTexts) {
  if (typeof evidence !== 'string' || !evidence.trim()) return null
  const needle = evidence.trim()
  const messages = Array.isArray(userMessageTexts) ? userMessageTexts : []
  const found = messages.some(message => {
    const text = typeof message === 'string' ? message : message?.text
    return typeof text === 'string' && text.toLowerCase().includes(needle.toLowerCase())
  })
  return found ? cut(needle, 120) : null
}

export async function runJudge({ judge, scenario, language, checkpoints, userMessages }) {
  const requestedIds = (Array.isArray(checkpoints) ? checkpoints : []).map(checkpoint => checkpoint.id)
  for (let attempt = 0; attempt < JUDGE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const raw = await judge({ scenario, language, checkpoints, userMessages })
      const validated = validateJudgeResults(raw, requestedIds)
      if (!validated.ok) continue
      return {
        ok: true,
        results: validated.results.map(result => ({
          ...result,
          evidence: verifyEvidence(result.evidence, userMessages),
        })),
      }
    } catch {
    }
  }
  return { ok: false }
}
