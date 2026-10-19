# BaitCheck Project Contract

## 4. Repo Structure

- `/client`: React app with Vite
  - `/src/pages`: Login, Register, Scenarios, Chat, Report, Admin
  - `/src/i18n.js`: Simple `{ en: {...}, am: {...} }` UI strings
- `/server`:
  - `/routes`: `auth.js`, `org.js`, `sessions.js`
  - `/models`: `User.js`, `Org.js`, `Session.js`
  - `/ai`: `llm.js`, `prompts.js`, `stages.js`, `evaluator.js`, `safety.js`
  - `/scenarios`: `scenario1.json`, `scenario2.json`, `scenario3.json`
  - `server.js`
- `.env`: `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `LLM_MODEL`

## 5. Data Models

- **User**: `name`, `email`, `passwordHash`, `role` (`individual`, `employee`, `orgAdmin`), `orgId` (optional)
- **Org**: `name`, `joinCode` (6 characters, unique)
- **Session**: `userId`, `scenarioId`, `language`, `stageIndex`, `turnCount`, `status` (`active`, `finished`), `messages[]` (`role`, `text`), `report` (`checkpoint results`, `score`, `feedback`)
- _Note:_ Scenarios live as JSON files in the repo, not in MongoDB.

## 6. API Contract (Frozen)

- `POST /api/auth/register` -> `{name, email, password, joinCode?, orgName?}`
- `POST /api/auth/login` -> `{email, password}` -> `{token, user}`
- `GET /api/scenarios` -> list `(id, title, description, language support)`
- `POST /api/sessions` -> `{scenarioId, language}` -> `{sessionId, persona, firstMessage}`
- `POST /api/sessions/:id/message` -> `{text}` -> `{reply, stageIndex, ended, warning?}`
- `POST /api/sessions/:id/finish` -> `{report}`
- `GET /api/sessions/mine` -> history with scores
- `GET /api/org/summary` -> [orgAdmin] average score, completions, per-employee scores

Registration rules: `orgName` creates org & makes user `orgAdmin`. Valid `joinCode` sets role `employee`. Neither sets role `individual`.
Privacy rule: Admins see names, scenario names, scores, and dates. They never see transcripts or written feedback.

## 7. Safety by Design

1. **Persona card**: Every session gives user fake character data (e.g. fake PIN, fake phone).
2. **Simulation banner**: Permanent warning to never input real passwords or IDs.
3. **Attacker prompt rules**: Attacker only requests fake persona data; never asks for real credentials or gives real payment instructions.
4. **Input filter (`safety.js`)**: Scan user input for patterns looking like real data (long digit strings, real email patterns, etc.). Warn and drop if matched.
5. **Output check**: Scan attacker replies for URLs and phone numbers; block or replace with fake placeholders.
6. **Prompt injection**: Server controls stage and rules. User text is treated strictly as conversational data, never as system instructions.
7. **Abuse limits**: Hard cap turns per session (`maxTurns`), message length, and request rates.
8. **Data minimization**: Store only necessary metadata. Never store real credentials or phone numbers.

## 8. How a Session Works

- **Start**: Server loads scenario JSON, creates Session, returns persona card and attacker's opening line.
- **Each message**:
  1. Run `safety.js` on user text. If it fails, return a warning and stop.
  2. Save message, increment `turnCount`.
  3. Advance stage in code (advance every 2 user turns; end at last stage + 1 turn or at `maxTurns`).
  4. Build prompt (persona, goal, rules, language, current stage instruction only, recent messages).
  5. Call LLM via `llm.js`, validate output, save and return reply.
- **Finish (Report)**:
  1. Send transcript + scenario checkpoints to LLM requesting JSON: `[{"checkpointId": "...", "passed": boolean, "evidence": "..."}]`.
  2. Validate JSON structure (retry once, then fallback).
  3. Compute score in server code: `score = sum(weights of passed checkpoints) / sum(all weights) * 100`.
  4. Generate feedback text describing techniques, strengths, and improvement areas.

## 9. Scenario File Format

JSON files containing: `id`, `title` (en/am), `description` (en/am), `persona` (`userRole`, `fakeData`), `attacker` (`identity`, `goal`, `openingLine`, `style`), `stages` (`id`, `technique`, `instruction`), `checkpoints` (`id`, `weight`, `description`), `maxTurns`.
