/**
 * Fake attacker used until Gemini is connected.
 *
 * generateReply({ scenario, language, stageIndex, isFinal, history })
 * is the interface the real Gemini adapter must implement later:
 *   - history is the last 10 messages [{ role, text }], including the newest user message
 *   - on failure the function must throw llmBusy() or llmFailed() from utils/errors.js
 *   - the function must NOT save anything
 *
 * Dev triggers (not saved by the route on failure): if the last user message
 * in history is exactly "/503" throw llmBusy(); exactly "/502" throw llmFailed().
 *
 * Amharic lines are a temporary draft and need review by a native speaker.
 */
import { llmBusy, llmFailed } from '../utils/errors.js'
import { buildFallbackFeedback } from './feedback.js'

const CLOSING = {
  en: 'Alright, I will end the call here. Take care.',
  am: 'እሺ፣ ጥሪውን እዚህ አቆማለሁ። ደህና ይበሉ።',
}

// At least two canned lines per stageIndex (0–3). Stage 2 (stage-3) asks
// the user to read out the code just sent to the phone. No links, phone
// numbers, or real personal data.
const LINES = {
  en: {
    0: [
      'This is the security desk. I need to confirm you are the wallet holder.',
      'We opened a review on the wallet and I must verify it with you now.',
    ],
    1: [
      'If we wait, the wallet can be frozen in the next few minutes.',
      'Please stay on the line so we can finish this check quickly.',
    ],
    2: [
      'I just sent a short code to the phone. Please read out the code just sent to the phone.',
      'Read out the code just sent to the phone so I can complete the check.',
    ],
    3: [
      'If you refuse now, the wallet may stay blocked.',
      'I need an answer immediately so we can close this case.',
    ],
  },
  am: {
    0: [
      'ከደህንነት ክፍል ነው። የቦርሳው ባለቤት መሆንዎን ማረጋገጥ አለብኝ።',
      'ስለ ቦርሳው ግምገማ ከፍተናልና አሁን ማረጋገጥ አለብኝ።',
    ],
    1: [
      'ካቆምን ቦርሳው በጥቂት ደቂቃዎች ውስጥ ሊታገድ ይችላል።',
      'እባክዎ መስመሩ ላይ ይቆዩ ይህን ምርመራ በፍጥነት እንድንጨርስ።',
    ],
    2: [
      'አሁን ወደ ስልኩ አጭር ኮድ ልከናል። እባክዎ ወደ ስልኩ የተላከውን ኮድ ያንብቡ።',
      'ወደ ስልኩ የተላከውን ኮድ በድምፅ ያንብቡ ምርመራውን ለመጨረስ።',
    ],
    3: [
      'አሁን ከእምቢ ካሉ ቦርሳው ታግዶ ሊቀር ይችላል።',
      'ጉዳዩን ለመዝጋት ወዲያውኑ መልስ እፈልጋለሁ።',
    ],
  },
}

function lastUserText(history) {
  const messages = Array.isArray(history) ? history : []
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') return messages[index].text
  }
  return undefined
}

export function createFakeAi() {
  return {
    async generateReply({ scenario, language, stageIndex, isFinal, history }) {
      const last = lastUserText(history)
      if (last === '/503') throw llmBusy()
      if (last === '/502') throw llmFailed()

      const lang = language === 'am' ? 'am' : 'en'
      const customLines = scenario?._fakeLines?.[lang]
      if (isFinal) {
        return typeof customLines?.final === 'string' && customLines.final.trim()
          ? customLines.final
          : CLOSING[lang]
      }

      const userCount = (Array.isArray(history) ? history : []).filter(message => message?.role === 'user').length
      const customPack = customLines?.stages?.[stageIndex]
      if (Array.isArray(customPack) && customPack.length > 0 && customPack.every(line => typeof line === 'string')) {
        return customPack[userCount % customPack.length]
      }

      const pack = LINES[lang][stageIndex] ?? LINES[lang][0]
      return pack[userCount % pack.length]
    },

    async judgeCheckpoints({ scenario, language, checkpoints, userMessages }) {
      // This is a stand-in for the real Gemini judge.
      const messages = Array.isArray(userMessages) ? userMessages : []
      if (messages.some(message => (typeof message === 'string' ? message : message?.text) === '/unjudged')) {
        throw llmFailed()
      }
      const lang = language === 'am' ? 'am' : 'en'
      // Amharic examples below are temporary drafts that need native review.
      const complianceWords = lang === 'am'
        ? ['እሺ', 'አዎ', 'አሁን']
        : ['ok', 'okay', 'fine', 'sure', 'alright', 'hurry']
      const suspicionMarkers = lang === 'am'
        ? ['ማን', 'አረጋግጥ', 'ይፋዊ', 'ማስረጃ', 'አጠራጣሪ', 'ለምን', 'ሪፖርት']
        : ['who', 'verify', 'official', 'prove', 'proof', 'confirm', 'scam', 'suspicious', 'why', 'call back', '?']
      const textOf = message => typeof message === 'string' ? message : (typeof message?.text === 'string' ? message.text : '')
      return (Array.isArray(checkpoints) ? checkpoints : []).map(checkpoint => {
        const texts = messages.map(textOf)
        if (/urgen|rush|pressure|deadline/i.test(checkpoint.id)) {
          const compliant = lang === 'am'
            ? texts.some(text => complianceWords.some(word => text.includes(word)))
            : texts.some(text => complianceWords.some(word => new RegExp(`\\b${word}\\b`, 'i').test(text)))
          return { id: checkpoint.id, passed: !compliant, evidence: null }
        }
        const evidence = messages.find(message => {
          const text = textOf(message)
          return lang === 'am'
            ? suspicionMarkers.some(marker => text.includes(marker))
            : suspicionMarkers.some(marker => marker === '?'
              ? text.includes(marker)
              : new RegExp(`\\b${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text))
        })
        return { id: checkpoint.id, passed: evidence !== undefined, evidence: evidence === undefined ? null : textOf(evidence) }
      })
    },

    async generateFeedback({ scenario, language, results, band, userMessages }) {
      const messages = Array.isArray(userMessages) ? userMessages : []
      if (messages.some(message => (typeof message === 'string' ? message : message?.text) === '/nofeedback')) {
        throw llmFailed()
      }
      return buildFallbackFeedback({ scenario, language, results, band })
    },
  }
}
