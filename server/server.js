import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { loadConfig } from './config.js'
import { createApp } from './app.js'
import User from './models/User.js'
import Org from './models/Org.js'
import Session from './models/Session.js'
import { loadScenarios } from './scenarios/loadScenarios.js'
import { createFakeAi } from './engine/fakeAi.js'
import { createLlm } from './ai/llm.js'
import { createGeminiAi } from './ai/geminiAi.js'

if (String(process.env.AI_PROVIDER ?? '').trim() === 'gemini'
  && (!String(process.env.GEMINI_API_KEY ?? '').trim() || String(process.env.GEMINI_API_KEY).trim().toLowerCase() === 'placeholder')) {
  console.error('AI_PROVIDER=gemini requires a non-empty GEMINI_API_KEY that is not "placeholder"')
  process.exit(1)
}
let config
try {
  config = loadConfig()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

let store
try {
  const scenariosDir = fileURLToPath(new URL('./scenarios/', import.meta.url))
  store = await loadScenarios(scenariosDir, {
    expectedCount: config.NODE_ENV === 'production' ? 3 : null,
  })
  if (config.NODE_ENV !== 'production' && store.getAll().length < 3) {
    console.warn(`Only ${store.getAll().length} of 3 scenarios found (allowed outside production)`)
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

try {
  await mongoose.connect(config.MONGO_URI)
  console.log('MongoDB connected')
  await Promise.all([User.init(), Org.init(), Session.init()])
} catch {
  console.error('Could not connect to MongoDB')
  process.exit(1)
}

let ai
if (config.AI_PROVIDER === 'gemini') {
  const fallbackAi = createFakeAi()
  ai = createGeminiAi({ config, llm: createLlm({ config }), fallbackAi })
  console.log(`AI provider: gemini (model ${config.LLM_MODEL}) - attacker, judge and feedback`)
  console.log(`AI fallback to script: ${config.AI_FALLBACK_TO_SCRIPT ? 'on' : 'off'}`)
} else {
  ai = createFakeAi()
  console.log('WARNING: using the FAKE attacker (no real AI connected)')
  console.log('AI provider: fake')
}
const app = createApp(config, { scenarios: store, ai })
app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`)
})
