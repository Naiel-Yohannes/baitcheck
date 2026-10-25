# BaitCheck server

The BaitCheck API provides authentication, scenario sessions, and reports for the web client.

## Requirements and setup

Use Node.js 20 or later. From this directory, run `npm install`, copy `.env.example` to `.env`, and fill in every variable. `PORT` is the local listening port; `NODE_ENV` selects development or production behavior; `MONGO_URI` comes from your MongoDB deployment; `JWT_SECRET` is a strong secret you generate; `GEMINI_API_KEY` comes from Google AI Studio; `LLM_MODEL` is the model identifier supported by your API key; and `CLIENT_URL` is the frontend origin or comma-separated origins. Never commit `.env` or publish secrets.

## Scripts

- `npm start` — start the server.
- `npm run dev` — start the server with the development watcher.
- `npm test` — run the automated test suite.
- `npm run seed` — create the demo organization and accounts.
- `npm run seed:remove` — remove the demo seed data.
- `npm run demo:engine` — run the attacker engine demonstration.
- `npm run smoke` — run HTTP checks against a running server; optionally pass its URL or set `SMOKE_URL`.

The seed script prints the demo account emails. Use password `DemoPass123` and organization join code `BEAT42` with those printed accounts.

## Deploying on Render

Set the root directory to `server`, build command to `npm install`, start command to `npm start`, and health check path to `/api/health`. Configure `PORT` as provided by Render, `NODE_ENV=production`, `MONGO_URI`, a generated `JWT_SECRET`, `GEMINI_API_KEY`, `LLM_MODEL`, and `CLIENT_URL`. `CLIENT_URL` may contain several comma-separated frontend origins. Production requires all three scenario files. The seed script refuses to run in production unless passed `--allow-production`.

## AI integration

The server currently uses a FAKE attacker. A real attacker integration must provide these async functions:

- `generateReply({ scenario, language, stageIndex, isFinal, history })` returns a string.
- `judgeCheckpoints({ scenario, language, checkpoints, userMessages })` returns `[{ id, passed, evidence }]`, with every checkpoint id represented once.
- `generateFeedback({ scenario, language, results, score, band, userMessages })` returns `{ summary, didWell, improve, nextTime }`.

Each function should throw `llmBusy()` or `llmFailed()` from `utils/errors.js` when it cannot complete.


## AI configuration

Set `GEMINI_API_KEY` and `LLM_MODEL` in `.env`. Copy the exact model ID from `npm run ai:models`; optional settings are `LLM_MODEL_JUDGE`, `LLM_MAX_RPM`, `LLM_TIMEOUT_MS`, and `LLM_THINKING_LEVEL`. Run `npm run ai:models` to list available models and `npm run ai:ping` to make a small connectivity check. AI quota is counted per Google Cloud project, so other apps using the same project share that quota. The installed GenAI SDK version does not expose model listing, so `npm run ai:models` reports that capability as unavailable until the SDK adds it.
