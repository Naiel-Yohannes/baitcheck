# BaitCheck: guide for AI coding agents
Read this whole file before changing anything and follow it. If the code differs from what is written here, or a task contradicts it, stop and ask (the code wins; tell the human so this file gets fixed).

## What the product is
BaitCheck trains people to resist social engineering. A user plays a fictional character in a chat, an AI plays the scammer following a scripted escalation, and at the end the user gets a private report with a score. Organisations have employees and an admin page with aggregate scores only. Languages: English (en) and Amharic (am).

## Golden rules
1. **Code controls, AI talks.** Stages, safety checks, checkpoint rules, the score and bands are plain code. The AI only writes the attacker's lines, judges checkpoints marked "ai", and writes feedback. React never computes a session score, band or stage.
2. **Privacy.** Admins never see transcripts, messages, report text, feedback or evidence quotes. Org queries must never select `messages` or `report`.
3. **Safety.** Users type only the fake data on their persona card. `engine/safety.js` has the input filter (checkUserInput) and the output sanitizer (sanitizeOutput). The attacker prompt gets fake-data LABELS, never the values.
4. **Errors.** Every non-2xx body is `{ error: { code, message, details? } }`. Wrong login = 401 INVALID_CREDENTIALS; 401 UNAUTHORIZED only for a bad or expired token (the client logs the user out on it). Someone else's session = 404.
5. JavaScript only, ES modules, no new dependencies unless the task says so.
6. `@google/genai` is imported only in `server/ai/llm.js`. The model name comes only from env LLM_MODEL; never hardcode one.
7. Never log or print message text, prompts, passwords, tokens or keys. Never commit `.env`.
8. **UI text.** Every visible string comes from `t()` in `client/src/i18n.js` with an `en` and an `am` value. AI-written Amharic is a draft: add a comment that it needs native review. Text from the server (scenario titles, attacker lines, report text) is already in the session language: show it as plain text, never with dangerouslySetInnerHTML.
9. **Tests.** Server tests are vitest with no database and no network (fake models, repos and llm). Add or update tests for every logic change. The client has no test runner: keep logic out of components and verify with `npm run build`.
10. Keep changes small and inside the files the task names. Do not refactor unrelated code.

## Layout
Monorepo: `client/` (React 19, Vite, React Router, Tailwind v4) and `server/` (Node 20+, Express 4, Mongoose, zod). MongoDB Atlas. Backend on Render (root `server`), frontend on Vercel (root `client`).

### server/
- `server.js` startup: loadConfig, loadScenarios, mongoose connect, pick AI provider (fake or gemini), createApp, listen.
- `app.js` createApp(config, deps): helmet, cors, global rate limit, json 10kb, logger (no bodies), /api/health, routers for /api/auth, /api/org, /api/scenarios, /api/sessions, 404, one central error handler.
- `config.js` loadConfig (required and optional env vars).
- `utils/` errors.js (AppError + helpers), asyncHandler.js, token.js (JWT), joinCode.js, userResponse.js, orgSummary.js (pure buildOrgSummary).
- `middleware/` auth.js (createRequireAuth reloads the user on every request; requireRole), rateLimits.js.
- `models/` User, Org, Session. `repos/sessionRepo.js` is the only Session DB access (create, findOwned, listMine, appendTurn atomic, finalize).
- `routes/` auth.js (zod schemas), org.js, scenarios.js, sessions.js (order matters: /mine before /:id).
- `engine/` pure, unit-tested logic: stages.js, safety.js, scoring.js, judge.js (2 attempts, validation, evidence verified against user messages), feedback.js, finish.js (buildSessionReport), fakeAi.js (scripted attacker, fake judge and feedback), text.js.
- `ai/` Gemini: llm.js (call cap, timeout, one retry, error mapping), prompts.js, script.js, attacker.js (retry once, then a scripted line), judge.js, feedbackAi.js, geminiAi.js.
- `scenarios/` one JSON per scenario plus validateScenario.js, scenarioStore.js, loadScenarios.js. `mobile-money-call.json` and `boss-favor.json` are the templates. Fields starting with `_` (like `_fakeLines`, `_reviewNote`) are ignored by the validator.
- `scripts/` seed.js + seedData.js (deterministic demo data), smoke.js (20 live API checks), ai*.js (manual Gemini checks), amharic*.js (review sheet export/import).
- `tests/` vitest.

### client/src/
`main.jsx` (ErrorBoundary > LanguageProvider > AuthProvider > App), `App.jsx` (routes; RequireAuth and RequireRole guards), `api/http.js` (fetch, token, ApiError, 401 handler) and `api/index.js` (one function per endpoint returning the exact body), `context/` (AuthContext, LanguageContext with t()), `components/` (Layout, RequireAuth, RequireRole, ErrorBoundary), `errorText.js`, `i18n.js`, `pages/` (Login, Register, Scenarios, Chat, Report, History, Admin). Pages follow one pattern: a useEffect with a local `cancelled` flag, loading/error/empty states, errorText(err, t), and a ref guard against double submits.

## Flows
Message: validate, findOwned, reject finished, checkUserInput (blocked = 200 with reply null and a warning, nothing saved), t = turnCount + 1, stage = getStageIndex (advance every turnsPerStage user turns), endReason = getEndReason, ai.generateReply, sanitizeOutput, repo.appendTurn (atomic, expects turnCount), respond. On any LLM error nothing is saved.
Finish: buildSessionReport = code checkpoints + ONE batched AI judge + feedback. Judge failure gives "unjudged" and degraded true. The score comes only from computeScore; the report is stored once and returned unchanged.

## API (all under /api)
```
POST /auth/register {name,email,password,joinCode?,orgName?} -> 201 {token,user,joinCode?}
POST /auth/login -> {token,user}   GET /auth/me -> {user}   GET /health -> {ok:true}
GET /scenarios -> {scenarios:[{id,title:{en,am},description:{en,am},languages,channel,estimatedMinutes}]}
POST /sessions {scenarioId,language} -> 201 {sessionId,scenarioId,scenarioTitle,language,channel,persona:{userRole,fakeData:[{key,label,value}]},firstMessage,maxTurns,turnCount}
GET /sessions/:id -> {session:{id,scenarioId,scenarioTitle,language,channel,status,turnCount,maxTurns,stageIndex,endReason,persona,messages:[{role,text,stageIndex}],report}}
POST /sessions/:id/message {text<=500} -> {reply,stageIndex,turnCount,ended,warning}
POST /sessions/:id/finish -> {report}   GET /sessions/mine -> {sessions:[{id,scenarioId,scenarioTitle,language,status,score,band,createdAt,finishedAt}]}
GET /org/summary (orgAdmin) -> {org:{name,joinCode},averageScore,completedSessions,employeeCount,employees:[{id,name,sessionsCompleted,averageScore,lastActivity,sessions:[...]}]}
report = {score,band,degraded,scenarioId,scenarioTitle,language,endReason,turnCount,checkpoints:[{id,weight,method,status,description,evidence}],timeline:[{stageId,technique,explanation,startedAtTurn}],feedback:{summary,didWell,improve,nextTime},createdAt}
```
Bands: vulnerable 0-39, partial 40-69, resilient 70-89, strong 90-100. Checkpoint status: passed | failed | na | unjudged (na and unjudged are NOT failures).

## Scenario files
Localized fields are `{ en, am }`. 3 to 5 stages. Checkpoints: detection "ai", or "code" with rule leak (keys of fakeData that must never appear in user messages), endedBy, or keyword (keywords per language); optional requiresStage; weights are positive integers and sum to 10 by convention; at least one checkpoint without requiresStage. `_fakeLines` holds scripted attacker lines per stage for the fake AI and as the fallback. The validator is the authority.

## Env and commands
Server env names: PORT, MONGO_URI, JWT_SECRET, GEMINI_API_KEY, LLM_MODEL, CLIENT_URL, NODE_ENV, and optional LLM_MAX_RPM, LLM_TIMEOUT_MS, LLM_THINKING_LEVEL, LLM_MODEL_JUDGE, AI_PROVIDER (fake|gemini), AI_FALLBACK_TO_SCRIPT. Client: VITE_API_URL.
`cd server && npm test` | `npm start` | `npm run seed` | `npm run smoke -- <url>` | `cd client && npm run dev` | `npm run build`.
Dev triggers (fake AI): a message of exactly /503 or /502 simulates an LLM failure; /unjudged and /nofeedback break the judge or feedback.
Demo data: `npm run seed` creates users at demo.example.com (password DemoPass123), join code BEAT42.

## How to work
One task per branch. Read the files the task names before editing. After changes run the server tests and the client build. Reply briefly: files changed, deviations, check output.