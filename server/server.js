/**
 * server/server.js
 * Entry point: loads config, connects to MongoDB, starts Express.
 * Prints no secrets.
 */
import 'dotenv/config'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { loadConfig } from './config.js'
import { createApp } from './app.js'
import User from './models/User.js'
import Org from './models/Org.js'
import Session from './models/Session.js'
import { loadScenarios } from './scenarios/loadScenarios.js'

// ── Config ────────────────────────────────────────────────────────
let config
try {
  config = loadConfig()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

// ── Scenario data ────────────────────────────────────────────────
let scenarios
try {
  const scenariosDir = fileURLToPath(new URL('./scenarios/', import.meta.url))
  scenarios = await loadScenarios(scenariosDir, {
    expectedCount: config.NODE_ENV === 'production' ? 3 : null,
  })
  if (config.NODE_ENV !== 'production' && scenarios.getAll().length < 3) {
    console.warn(`Only ${scenarios.getAll().length} of 3 scenarios found (allowed outside production)`)
  }
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

// ── Database ──────────────────────────────────────────────────────
try {
  await mongoose.connect(config.MONGO_URI)
  console.log('MongoDB connected')
  await Promise.all([User.init(), Org.init(), Session.init()])
} catch {
  // Never print the URI
  console.error('Could not connect to MongoDB')
  process.exit(1)
}

// ── HTTP server ───────────────────────────────────────────────────
const app = createApp(config, { scenarios })
app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`)
})
