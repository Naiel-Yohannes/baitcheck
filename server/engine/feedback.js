import { isDigitsOnly } from './text.js'
import { redactUnsafeText } from './safety.js'

// Amharic feedback is a temporary draft and needs review by a native speaker.
const SUMMARIES = {
  en: {
    vulnerable: 'You may be at risk when a caller creates pressure or asks for private information.',
    partial: 'You noticed some risks, and a few careful steps can make you safer.',
    resilient: 'You handled the suspicious request carefully and protected yourself well.',
    strong: 'You made safe choices and resisted the suspicious request.',
  },
  am: {
    vulnerable: 'ደዋይ ጫና ሲፈጥር ወይም የግል መረጃ ሲጠይቅ አደጋ ሊኖር ይችላል።',
    partial: 'አንዳንድ አደጋዎችን አስተውለዋል፤ ጥቂት ተጨማሪ ጥንቃቄዎች ደህንነትዎን ያጠናክራሉ።',
    resilient: 'አጠራጣሪውን ጥያቄ በጥንቃቄ አስተናግደው ራስዎን ጠብቀዋል።',
    strong: 'ደህንነታቸውን የሚጠብቁ ምርጫዎችን አድርገው አጠራጣሪውን ጥያቄ ተቋቁመዋል።',
  },
}

const TIPS = {
  en: [
    'Verify unexpected requests through an official channel you find yourself.',
    'Pause and take time, even when someone gives you a deadline.',
    'Never share a PIN or one-time code; end the conversation and report it if it feels suspicious.',
  ],
  am: [
    'ያልጠበቁትን ጥያቄ በራስዎ በሚያገኙት ይፋዊ መንገድ ያረጋግጡ።',
    'አንድ ሰው የጊዜ ገደብ ቢሰጥም ቆም ብለው ለማሰብ ጊዜ ይውሰዱ።',
    'ፒን ወይም አንድ ጊዜ ኮድ ፈጽሞ አያጋሩ፤ አጠራጣሪ ከሆነ ውይይቱን ያቋርጡና ሪፖርት ያድርጉ።',
  ],
}

const IMPROVE_PREFIX = {
  en: 'Work on this: ',
  am: 'በዚህ ላይ ይለማመዱ፦ ',
}

export function buildFallbackFeedback({ scenario: _scenario, language, results, band }) {
  const lang = language === 'am' ? 'am' : 'en'
  const items = Array.isArray(results) ? results : []
  return {
    summary: SUMMARIES[lang][band] ?? SUMMARIES[lang].partial,
    didWell: items.filter(result => result?.status === 'passed' && typeof result.description === 'string')
      .slice(0, 3)
      .map(result => result.description),
    improve: items.filter(result => result?.status === 'failed' && typeof result.description === 'string')
      .slice(0, 3)
      .map(result => `${IMPROVE_PREFIX[lang]}${result.description}`),
    nextTime: TIPS[lang].slice(),
  }
}

function hasFakeValue(text, scenario) {
  const fakeValues = (scenario?.persona?.fakeData ?? [])
    .map(item => item?.value)
    .filter(value => typeof value === 'string' && value.length > 0)
  for (const value of fakeValues) {
    if (isDigitsOnly(value)) {
      const normalizedText = text.replace(/[\s.\-]/g, '')
      if (normalizedText.includes(value)) return true
    } else if (text.toLowerCase().includes(value.toLowerCase())) {
      return true
    }
  }
  return false
}

export function cleanFeedback(raw, { scenario }) {
  if (
    !raw || typeof raw !== 'object' || Array.isArray(raw) ||
    typeof raw.summary !== 'string' || !raw.summary.trim() ||
    !Array.isArray(raw.didWell) || !Array.isArray(raw.improve) || !Array.isArray(raw.nextTime)
  ) return null

  const summary = redactUnsafeText(raw.summary.trim(), scenario).trim().slice(0, 600).trim()
  if (!summary) return null

  const cleanList = list => list
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim())
    .filter(value => !hasFakeValue(value, scenario))
    .map(value => redactUnsafeText(value, scenario).trim())
    .filter(Boolean)
    .slice(0, 3)
    .map(value => value.slice(0, 300).trim())

  return {
    summary,
    didWell: cleanList(raw.didWell),
    improve: cleanList(raw.improve),
    nextTime: cleanList(raw.nextTime),
  }
}
