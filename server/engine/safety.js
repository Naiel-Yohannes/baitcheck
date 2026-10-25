import { cut, escapeRegExp, isDigitsOnly, stripDigitSeparators } from './text.js'

export const WARNING_MESSAGES = {
  en: {
    LONG_DIGITS: 'That looks like a real number. Please use only the fake data on your card.',
    EMAIL: 'That looks like a real email address. Please do not type real personal data.',
    PASSWORD_WORD: 'That looks like a real password. Please use only the fake data on your card.',
  },
  am: {
    LONG_DIGITS: 'ይህ እውነተኛ ቁጥር ይመስላል። እባክዎ በካርድዎ ላይ ያለውን ሐሰተኛ መረጃ ብቻ ይጠቀሙ።',
    EMAIL: 'ይህ እውነተኛ የኢሜይል አድራሻ ይመስላል። እባክዎ እውነተኛ የግል መረጃ አይጻፉ።',
    PASSWORD_WORD: 'ይህ እውነተኛ የይለፍ ቃል ይመስላል። እባክዎ በካርድዎ ላይ ያለውን ሐሰተኛ መረጃ ብቻ ይጠቀሙ።',
  },
}

function fallbackFor(scenario, language) {
  const fallback = scenario?.fallbackLine
  if (typeof fallback === 'string') return fallback
  if (fallback && typeof fallback === 'object') {
    if (typeof fallback[language] === 'string') return fallback[language]
    if (typeof fallback.en === 'string') return fallback.en
  }
  return ''
}

function fakeDataItems(scenario) {
  return Array.isArray(scenario?.persona?.fakeData) ? scenario.persona.fakeData : []
}

function replaceFakeValues(text, scenario) {
  let working = text
  const items = fakeDataItems(scenario)
    .filter(item => typeof item?.value === 'string' && item.value.length > 0)
    .slice()
    .sort((left, right) => right.value.length - left.value.length)

  for (const item of items) {
    const value = item.value
    if (isDigitsOnly(value)) {
      const digitsPattern = [...value].map(escapeRegExp).join('[\\s.\\-]*')
      const pattern = new RegExp(`(?<![0-9])${digitsPattern}(?![0-9])`, 'g')
      working = working.replace(pattern, ' ')
    } else {
      working = working.replace(new RegExp(escapeRegExp(value), 'gi'), ' ')
    }
  }
  return working
}

export function checkUserInput(text, scenario, language) {
  if (typeof text !== 'string') return { ok: true }
  const normalized = stripDigitSeparators(replaceFakeValues(text, scenario))
  let code = null
  if (/\d{6,}/.test(normalized)) code = 'LONG_DIGITS'
  else {
    const emailPattern = /[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})\b/gi
    for (const match of normalized.matchAll(emailPattern)) {
      if (!['example.com', 'example.org'].includes(match[1].toLowerCase())) {
        code = 'EMAIL'
        break
      }
    }
    if (!code && /\b(?:password|passcode|passwd|pwd)\b\s*(?:is|:|=)\s*\S+/i.test(normalized)) {
      code = 'PASSWORD_WORD'
    }
  }

  if (!code) return { ok: true }
  const messages = WARNING_MESSAGES[language] ?? WARNING_MESSAGES.en
  return { ok: false, code, message: messages[code] ?? WARNING_MESSAGES.en[code] }
}

function replaceUrlWithMarker(match) {
  const punctuation = match.match(/[.,;:!?)]*$/)?.[0] ?? ''
  return `[link removed]${punctuation}`
}

function truncateAtSentence(text, max) {
  if (text.length <= max) return text.trim()
  const shortened = text.slice(0, max)
  const sentenceEnds = ['.', '!', '?', '።']
  const lastEnd = Math.max(...sentenceEnds.map(mark => shortened.lastIndexOf(mark)))
  return (lastEnd > 0 ? shortened.slice(0, lastEnd + 1) : shortened).trim()
}

export function redactUnsafeText(text, scenario) {
  let safe = typeof text === 'string' ? text : ''
  safe = safe.replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email removed]')
  safe = safe.replace(/(?<!\w)@[A-Za-z0-9_]{4,}/g, '[username removed]')
  safe = safe.replace(/\b(?:https?:\/\/|www\.)\S+/gi, replaceUrlWithMarker)
  safe = safe.replace(/\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|et|io|me|co)(?:\/[^\s]*)?/gi, replaceUrlWithMarker)
  safe = safe.replace(/\+251(?:[\d.\-\s]*\d)/g, '[number removed]')

  const fakeDigits = new Set(fakeDataItems(scenario)
    .map(item => item?.value)
    .filter(isDigitsOnly))
  safe = safe.replace(/\d(?:[\s.\-]?\d){5,}/g, match => {
    const digits = match.replace(/[\s.\-]/g, '')
    return fakeDigits.has(digits) ? match : '[number removed]'
  })

  return safe
}

export function sanitizeOutput(text, scenario, language) {
  const original = typeof text === 'string' ? text : ''
  const fallback = fallbackFor(scenario, language)
  const goal = scenario?.attacker?.goal
  if (
    original.includes('###') ||
    /\b(?:RULES|SYSTEM)\b/.test(original) ||
    (typeof goal === 'string' && goal.length > 0 && original.toLowerCase().includes(goal.toLowerCase()))
  ) return fallback

  let safe = redactUnsafeText(original, scenario)

  safe = safe.trim()
  if (!safe) return fallback
  return truncateAtSentence(safe, 600)
}
