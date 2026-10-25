import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../config.js'
import { loadScenarios } from '../scenarios/loadScenarios.js'
import { createLlm } from '../ai/llm.js'
import { createGeminiAi } from '../ai/geminiAi.js'
import { buildSessionReport } from '../engine/finish.js'

const [scenarioId, language] = process.argv.slice(2)
if (!scenarioId || !['en', 'am'].includes(language)) {
  process.stderr.write('Usage: npm run ai:report -- <scenarioId> <en|am>\n')
  process.exit(1)
}

process.stdout.write('This run makes at most 8 provider calls across both reports.\n')

if (scenarioId !== 'mobile-money-call') {
  process.stdout.write('Only mobile-money-call has built-in transcripts.\n')
  process.exit(0)
}

const transcripts = {
  en: {
    good: [
      'Who are you? I will verify with the official app',
      'I will not share anything',
      'I will hang up now',
    ],
    bad: ['ok who is this', 'ok fine', 'my pin is 4821', 'the code is 739204'],
  },
  am: {
    good: [
      'ማን ነህ? በይፋዊው መተግበሪያ አረጋግጣለሁ።',
      'ምንም አላጋራም።',
      'ስልኩን እዘጋለሁ።',
    ],
    bad: ['እሺ', 'ፒኑ 4821 ነው', 'ኮዱ 739204 ነው'],
  },
}

function makeSession(lines, lang, endReason) {
  const messages = [{ role: 'attacker', text: 'Opening line.' }]
  for (const text of lines) {
    messages.push({ role: 'user', text })
    messages.push({ role: 'attacker', text: 'Character reply.' })
  }
  return {
    id: `trial-${lang}-${endReason}`,
    scenarioId: 'mobile-money-call',
    language: lang,
    messages,
    stageIndex: 3,
    turnCount: lines.length,
    endReason,
  }
}

function printReport(label, report) {
  process.stdout.write(`\n${label}\nscore: ${report.score}\nband: ${report.band}\ndegraded: ${report.degraded}\n`)
  for (const item of report.checkpoints) {
    process.stdout.write(`checkpoint ${item.id} (${item.method}): ${item.status}; evidence: ${item.evidence ?? 'null'}\n`)
  }
  process.stdout.write(`feedback summary: ${report.feedback.summary}\n`)
  process.stdout.write(`didWell: ${JSON.stringify(report.feedback.didWell)}\n`)
  process.stdout.write(`improve: ${JSON.stringify(report.feedback.improve)}\n`)
  process.stdout.write(`nextTime: ${JSON.stringify(report.feedback.nextTime)}\n`)
}

try {
  const config = loadConfig()
  const store = await loadScenarios(fileURLToPath(new URL('../scenarios/', import.meta.url)))
  const scenario = store.getById(scenarioId)
  const llm = createLlm({ config, maxCalls: 8 })
  const ai = createGeminiAi({ config, llm })
  const samples = transcripts[language]
  for (const [label, lines] of Object.entries(samples)) {
    const session = makeSession(lines, language, label === 'good' ? 'user_button' : 'scenario_complete')
    const { report } = await buildSessionReport({ session, scenario, ai })
    printReport(label, report)
  }
} catch (error) {
  process.stderr.write(`Could not build example report (${error?.code ?? 'setup error'}). API key and provider details are omitted.\n`)
  process.exitCode = 1
}
