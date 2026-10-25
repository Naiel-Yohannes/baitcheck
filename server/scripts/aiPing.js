import 'dotenv/config'
import { loadConfig } from '../config.js'
import { createLlm } from '../ai/llm.js'

const args = process.argv.slice(2)
let model
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--model' && args[index + 1]) model = args[index + 1]
}

function errorLabel(error) {
  return String(error?.statusCode ?? error?.status ?? error?.code ?? 'unknown')
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
    process.stdout.write(`FAIL text: ${errorLabel(error)}\n`)
  }

  const jsonStarted = Date.now()
  try {
    await llm.generateJSON({ prompt: 'Return this JSON object: {"ok": true}', maxOutputTokens: 20, model: selectedModel })
    process.stdout.write(`PASS json (${Date.now() - jsonStarted} ms, model ${selectedModel})\n`)
  } catch (error) {
    failed = true
    process.stdout.write(`FAIL json: ${errorLabel(error)}\n`)
  }
  process.stdout.write('Reminder: this used 2 requests of the daily quota.\n')
  if (failed) process.exitCode = 1
} catch (error) {
  process.stderr.write(`FAIL setup: ${errorLabel(error)}\n`)
  process.exitCode = 1
}
