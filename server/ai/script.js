const LETTER = /\p{L}/gu
const ETHIOPIC_LETTER = /[\u1200-\u137F]/u

export function mentionsMeta(text) {
  return /\b(fake|practice|simulat\w*|drill|training|role-?play)\b/i.test(String(text ?? ''))
}

export function ethiopicRatio(text) {
  const value = String(text ?? '')
  const letters = value.match(LETTER) ?? []
  if (!letters.length) return 0
  const ethiopicLetters = [...value].filter(character => ETHIOPIC_LETTER.test(character) && /\p{L}/u.test(character)).length
  return ethiopicLetters / letters.length
}

export function isWrongScript(text, language) {
  const ratio = ethiopicRatio(text)
  if (language === 'am') return ratio < 0.5
  if (language === 'en') return ratio > 0.1
  return false
}

export function containsFakeValue(text, scenario) {
  const value = String(text ?? '')
  const fakeValues = Array.isArray(scenario?.persona?.fakeData)
    ? scenario.persona.fakeData.map(item => item?.value).filter(item => typeof item === 'string' && item.length > 0)
    : []
  for (const fakeValue of fakeValues) {
    if (!/^\d+$/.test(fakeValue)) {
      if (value.toLocaleLowerCase().includes(fakeValue.toLocaleLowerCase())) return true
      continue
    }
    const normalized = fakeValue.replace(/[ .-]/g, '')
    const digitRuns = value.match(/\d+(?:[ .-]+\d+)*/g) ?? []
    if (digitRuns.some(run => run.replace(/[ .-]/g, '').includes(normalized))) return true
  }
  return false
}

const refusalPatterns = [
  /\bi (cannot|can't|can not) fulfill your request to role-?play\b/i,
  /\bi (cannot|can't|can not|am unable to|won't|will not) (help|assist|comply|fulfil+|roleplay|role-play|play|write|generate|provide|create|continue|engage|do that)/i,
  /\bas an ai\b/i,
  /language model/i,
  /\b(i'm|i am) sorry,? but\b/i,
  /\bi apologi[sz]e,? but\b/i,
  /against my (guidelines|policies|programming)/i,
  /\b(simulation|drill|training exercise|role-?play|fictional)\b/i,
]

export function looksLikeRefusal(text) {
  const value = String(text ?? '')
  if (!value.trim()) return true
  if (refusalPatterns.some(pattern => pattern.test(value))) return true
  return value.includes('አልችልም') && value.includes('ይቅርታ')
}

export function cleanSpokenLine(text) {
  let value = String(text ?? '').trim()
  value = value.replace(/[＊*`]/g, '').trim()
  value = value.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim()
  value = value.replace(/^(?:Daniel|Attacker|Caller)\s*:\s*/i, '')
  value = value.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/\s+/g, ' ').trim()
  const sentences = value.match(/[^.!?…。]+(?:[.!?…。]+|$)/g) ?? []
  value = sentences.slice(0, 3).join('').trim()
  return value.slice(0, 400).trim()
}
