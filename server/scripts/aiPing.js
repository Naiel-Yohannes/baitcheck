import 'dotenv/config'
import { loadConfig } from '../config.js'
import { createLlm } from '../ai/llm.js'

const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
let model
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--model' && args[index + 1]) model = args[index + 1]
}

function errorLabel(error) {
  return String(error?.statusCode ?? error?.status ?? error?.code ?? 'unknown')
}

function verboseError(error, apiKey) {
  const detail = error?.cause ?? error
  let message = String(detail?.message ?? '')
  if (apiKey) message = message.replaceAll(apiKey, '[redacted]')
  message = message.slice(0, 300)
  return `name=${String(detail?.name ?? 'Error')} status=${String(detail?.statusCode ?? detail?.status ?? 'unknown')} message=${message}`
}

try {
  const config = loadConfig()
  const selectedModel = model ?? config.LLM_MODEL
  const llm = createLlm({ config })
  let failed = false
  const textStarted = Date.now()
  try {
    await llm.generateText({ prompt: 'Reply with the single word: ready', maxOutputTokens: 20, model: selectedModel })
    process.stdout.write(`PASS text (${Date.now() - textStarted} ms, model ${selectedModel})\n`)
  } catch (error) {
    failed = true
    process.stdout.write(`FAIL text: ${errorLabel(error)}${verbose ? ` ${verboseError(error, config.GEMINI_API_KEY)}` : ''}\n`)
  }

  const jsonStarted = Date.now()
  try {
    await llm.generateJSON({ prompt: 'Return this JSON object: {"ok": true}', maxOutputTokens: 20, model: selectedModel })
    process.stdout.write(`PASS json (${Date.now() - jsonStarted} ms, model ${selectedModel})\n`)
  } catch (error) {
    failed = true
    process.stdout.write(`FAIL json: ${errorLabel(error)}${verbose ? ` ${verboseError(error, config.GEMINI_API_KEY)}` : ''}\n`)
  }
  process.stdout.write('Reminder: this used 2 requests of the daily quota.\n')
  if (failed) process.exitCode = 1
} catch (error) {
  process.stderr.write(`FAIL setup: ${errorLabel(error)}${verbose ? ` ${verboseError(error, process.env.GEMINI_API_KEY ?? '')}` : ''}\n`)
  process.exitCode = 1
}
