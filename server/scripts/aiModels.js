import 'dotenv/config'
import { loadConfig } from '../config.js'
import { createLlm } from '../ai/llm.js'

try {
  const config = loadConfig()
  const models = await createLlm({ config }).listModelIds()
  for (const id of models) process.stdout.write(`${id}\n`)
  process.stdout.write('Set LLM_MODEL to one of these ids.\n')
} catch (error) {
  const status = error?.statusCode ?? error?.status ?? 'unavailable'
  process.stderr.write(`Could not list models (status ${status}).\n`)
  process.exitCode = 1
}
