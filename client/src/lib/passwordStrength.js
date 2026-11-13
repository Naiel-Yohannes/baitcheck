// client/src/lib/passwordStrength.js
/**
 * Pure password strength evaluator.
 * Returns an object with:
 *   passed: {RULE_ID: boolean} for each rule,
 *   allRequiredMet: boolean (all five base rules met),
 *   score: 0-100 integer,
 *   level: 'empty'|'weak'|'fair'|'good'|'strong',
 *   problems: array of problem codes (common, containsEmail, repeated).
 */

export const RULES = {
  LENGTH: 'PASSWORD_TOO_SHORT',
  LOWERCASE: 'PASSWORD_NEEDS_LOWERCASE',
  UPPERCASE: 'PASSWORD_NEEDS_UPPERCASE',
  DIGIT: 'PASSWORD_NEEDS_DIGIT',
  SYMBOL: 'PASSWORD_NEEDS_SYMBOL',
  COMMON: 'PASSWORD_TOO_COMMON',
  CONTAINS_EMAIL: 'PASSWORD_CONTAINS_EMAIL',
  REPEATED: 'PASSWORD_REPEATED_OR_SEQUENCE',
}

// simple list of very common passwords (non‑exhaustive)
const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  '111111',
  '123123',
])

function hasSequence(pw) {
  // detect 4‑char ascending sequences like 1234, abcd, etc.
  const seq = pw.toLowerCase()
  for (let i = 0; i <= seq.length - 4; i++) {
    const sub = seq.slice(i, i + 4)
    const asc = sub
      .split('')
      .map(c => c.charCodeAt(0))
      .every((v, idx, arr) => idx === 0 || v === arr[idx - 1] + 1)
    const desc = sub
      .split('')
      .map(c => c.charCodeAt(0))
      .every((v, idx, arr) => idx === 0 || v === arr[idx - 1] - 1)
    if (asc || desc) return true
  }
  return false
}

function hasRepeatedChars(pw) {
  // 4+ identical characters in a row
  return /(.)\1{3,}/.test(pw)
}

export function evaluatePassword(pw, { email = '', name = '' } = {}) {
  const passed = {}
  const length = pw.length
  passed[RULES.LENGTH] = length >= 8
  passed[RULES.LOWERCASE] = /[a-z]/.test(pw)
  passed[RULES.UPPERCASE] = /[A-Z]/.test(pw)
  passed[RULES.DIGIT] = /[0-9]/.test(pw)
  passed[RULES.SYMBOL] = /[^A-Za-z0-9]/.test(pw)

  const allRequiredMet = Object.values(passed).every(v => v)

  // score base 0 + 20 per rule satisfied
  let score = 0
  for (const rule of [RULES.LENGTH, RULES.LOWERCASE, RULES.UPPERCASE, RULES.DIGIT, RULES.SYMBOL]) {
    if (passed[rule]) score += 20
  }
  if (length >= 12) score += 8
  if (length >= 16) score += 8

  const problems = []
  const lowered = pw.toLowerCase()
  if (COMMON_PASSWORDS.has(lowered)) {
    score -= 25
    problems.push(RULES.COMMON)
  }
  if (hasSequence(pw) || hasRepeatedChars(pw)) {
    score -= 15
    problems.push(RULES.REPEATED)
  }
  const emailLocal = email.split('@')[0]
  if (emailLocal && lowered.includes(emailLocal.toLowerCase())) {
    score -= 20
    problems.push(RULES.CONTAINS_EMAIL)
  }

  // clamp
  if (score < 0) score = 0
  if (score > 100) score = 100

  let level = 'empty'
  if (pw.length === 0) {
    level = 'empty'
  } else if (score < 40) {
    level = 'weak'
  } else if (score < 60) {
    level = 'fair'
  } else if (score < 80) {
    level = 'good'
  } else {
    // 80+
    level = allRequiredMet ? 'strong' : 'good'
  }

  return { passed, allRequiredMet, score, level, problems }
}
