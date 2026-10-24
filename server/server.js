/**
 * server/server.js
 * Entry point: loads config, connects to MongoDB, starts Express.
 * Prints no secrets.
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import { loadConfig } from './config.js'
import { createApp } from './app.js'

// ── Config ────────────────────────────────────────────────────────
let config
try {
  config = loadConfig()
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

// ── Database ──────────────────────────────────────────────────────
try {
  await mongoose.connect(config.MONGO_URI)
  console.log('MongoDB connected')
} catch {
  // Never print the URI
  console.error('Could not connect to MongoDB')
  process.exit(1)
}

// ── HTTP server ───────────────────────────────────────────────────
const app = createApp(config)
app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT}`)
})
