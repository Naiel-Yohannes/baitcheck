# BaitCheck client: CONTEXT

## Client rules
- JavaScript (no TypeScript). React + Vite + React Router + Tailwind v4. No other libraries.
- Pages NEVER call fetch. All network calls go through `src/api/index.js`.
- All fixed UI text comes from `strings` in `src/i18n.js` (en/am). Text from the server (scenario titles, attacker messages, report text) is already in the session language: display it as-is.
- Render server/AI text as plain text. Never use dangerouslySetInnerHTML.
- Every page needs loading, error and empty states. Layout must work at 375px width.
- Core rule: code controls, AI talks. The client never computes scores.

## API conventions
- Base URL: VITE_API_URL. Header: `Authorization: Bearer <token>`. All dates are ISO strings.
- Errors: non-2xx response with body `{ "error": { "code": "...", "message": "..." } }`
  - 400 VALIDATION_ERROR (empty/too long message, bad fields), 400 INVALID_JOIN_CODE
  - 401 UNAUTHORIZED (also wrong login), 403 FORBIDDEN, 404 NOT_FOUND
  - 409 EMAIL_TAKEN, 409 SESSION_FINISHED
  - 429 RATE_LIMITED, 503 LLM_BUSY (AI provider overloaded), 500 SERVER_ERROR
- A safety-filter block is NOT an error: it is a 200 with `reply: null` and a `warning` code (see message endpoint). The client translates warning codes into UI text.
- Roles: "individual" | "employee" | "orgAdmin". Languages: "en" | "am".

## Endpoints

POST /api/auth/register
  body: { name, email, password, joinCode?, orgName? }
  (orgName => new org, user becomes orgAdmin. valid joinCode => employee. neither => individual)
  200: { token, user: { id, name, email, role, orgId, orgName }, joinCode? }   // joinCode only when orgName was given

POST /api/auth/login
  body: { email, password }
  200: { token, user }

GET /api/scenarios
  200: [ { id, title: {en, am}, description: {en, am}, languages: ["en","am"] } ]

POST /api/sessions
  body: { scenarioId, language }
  200: { sessionId, persona: { userRole: "text in session language",
         fakeData: { pin: "4821", otp: "739204" } },
         firstMessage: "attacker opening line", maxTurns: 10, maxMessageLength: 500 }

GET /api/sessions/:id            (ADDED, needed so refresh works)
  200: { sessionId, scenarioId, scenarioTitle, language, status: "active"|"finished",
         persona, maxTurns, maxMessageLength, turnCount, stageIndex,
         messages: [ { role: "attacker"|"user", text } ],
         report: null | <report> }

POST /api/sessions/:id/message
  body: { text }
  200: { reply: "attacker text", stageIndex: 1, turnCount: 3, ended: false, warning: null }
  safety block: { reply: null, stageIndex, turnCount (unchanged), ended: false, warning: "REAL_DATA_SUSPECTED" }
  (a blocked message is neither sent to the AI nor stored)

POST /api/sessions/:id/finish
  200: { report }
  report = {
    sessionId, scenarioId, scenarioTitle, language, finishedAt,
    score: 62,                       // integer 0-100, computed by server code
    isFallback: false,               // true if the AI evaluation failed and a generic report was used
    checkpoints: [ { id, description, weight, passed, evidence } ],   // evidence: short quote or null
    techniques: [ { stage: 1, technique: "Authority", explanation } ], // from the scenario stage list
    feedback: { summary, didWell: ["..."], nextTime: ["..."] }
  }

GET /api/sessions/mine
  200: [ { sessionId, scenarioId, scenarioTitle, language, status, score, startedAt, finishedAt } ]  // score null if active

GET /api/org/summary             (orgAdmin only, else 403)
  200: { org: { name, joinCode }, averageScore, completedSessions,
         employees: [ { id, name, completedSessions, averageScore, lastSessionAt } ],
         sessions: [ { employeeName, scenarioTitle, score, finishedAt } ] }
  Admins never receive transcripts or feedback text.

## Scenario ids
mobile-money-call, telegram-job-offer, boss-favor