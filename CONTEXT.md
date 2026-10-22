# BaitCheck client: CONTEXT
Digest of "BaitCheck: Software Requirements and Build Specification v2.0" (22 Oct 2026). If this file and the spec disagree, the spec wins; fix this file.

## Client rules
- JavaScript only. React + Vite + React Router + Tailwind v4. No other libraries.
- Pages NEVER call fetch. All network calls go through src/api/index.js, which returns the exact JSON body the server sends (no unwrapping).
- Fixed UI text, validation text, error text (looked up by error code) and band labels live in src/i18n.js (en/am). Text that comes from the server (scenario titles, persona, attacker messages, checkpoint descriptions, technique names, feedback, warning.message) is already in the session language: show it as-is.
- Render server text as plain text. Never dangerouslySetInnerHTML.
- Every page has loading, error and empty states and works at 375px width.
- The client never computes or changes score, band, stage or end conditions.
- Language codes: "en" and "am" only. Token in localStorage key "baitcheck_token".
- On any 401 with code UNAUTHORIZED: clear the token and go to /login. INVALID_CREDENTIALS (wrong email/password) is NOT a session expiry.
- On app load: call GET /api/health once (wakes the sleeping backend); if a token exists call GET /api/auth/me to restore the user.

## Errors
Every non-2xx body: { error: { code, message, details? } }. message is English; the client shows its own translated text chosen by code.
400 VALIDATION_ERROR (details: [{field, issue}]) | 400 INVALID_JOIN_CODE | 401 UNAUTHORIZED | 401 INVALID_CREDENTIALS | 403 FORBIDDEN | 404 NOT_FOUND (also for someone else's session) | 409 EMAIL_TAKEN | 409 SESSION_FINISHED | 429 RATE_LIMITED | 502 LLM_FAILED | 503 LLM_BUSY | 500 SERVER_ERROR
Client-only: status 0, code NETWORK_ERROR.

## Types
user = { id, name, email, role: "individual"|"employee"|"orgAdmin", orgId, orgName }   // orgId/orgName null for individuals
persona = { userRole, fakeData: [ { key, label, value } ] }   // text already in session language
band keys: "vulnerable" (0-39) | "partial" (40-69) | "resilient" (70-89) | "strong" (90-100)

## Endpoints (all under /api; "auth" = Bearer token)
GET  /health -> { ok: true }
POST /auth/register  body { name, email, password, joinCode?, orgName? } -> 201 { token, user, joinCode? }
     (name 2-60 chars, password 8-72; joinCode AND orgName together = 400 VALIDATION_ERROR; orgName => orgAdmin and joinCode returned; joinCode => employee; neither => individual)
POST /auth/login  body { email, password } -> 200 { token, user }
GET  /auth/me (auth) -> { user }
GET  /scenarios (auth) -> { scenarios: [ { id, title:{en,am}, description:{en,am}, languages:["en","am"], channel:"call"|"telegram"|"message", estimatedMinutes } ] }
POST /sessions (auth) body { scenarioId, language } -> 201 { sessionId, scenarioId, scenarioTitle, language, channel, persona, firstMessage, maxTurns, turnCount: 0 }
GET  /sessions/:id (auth, owner) -> { session: { id, scenarioId, scenarioTitle, language, channel, status:"active"|"finished", turnCount, maxTurns, stageIndex, persona, messages:[{role:"user"|"attacker", text}], report: null|report } }
POST /sessions/:id/message (auth, owner) body { text }   // trimmed, 1-500 chars
     success -> { reply, stageIndex, turnCount, ended, warning: null }
     blocked by input filter -> 200 { reply: null, stageIndex, turnCount, ended: false, warning: { code, message } }   // not saved, not counted; message already in session language
     when ended is true: show the final attacker reply, then call finish automatically
POST /sessions/:id/finish (auth, owner) -> { report }   // idempotent; turnCount 0 => 400 VALIDATION_ERROR
GET  /sessions/mine (auth) -> { sessions: [ { id, scenarioId, scenarioTitle, language, status, score, band, createdAt, finishedAt } ] }   // newest first, max 50, score/band null while active
GET  /org/summary (auth, orgAdmin only) -> { org:{name,joinCode}, averageScore, completedSessions, employeeCount, employees:[ { id, name, sessionsCompleted, averageScore, lastActivity, sessions:[ { scenarioId, scenarioTitle, score, band, finishedAt } ] } ] }
     averageScore can be null (no data). Employees with 0 sessions are included. No transcripts, no feedback text.

## Report
report = { score (int 0-100), band (key), degraded (bool), scenarioId, scenarioTitle, language, endReason: "user_button"|"end_signal"|"max_turns"|"scenario_complete", turnCount,
  checkpoints: [ { id, weight, method:"code"|"ai", status:"passed"|"failed"|"na"|"unjudged", description, evidence: string|null } ],
  timeline: [ { stageId, technique, explanation, startedAtTurn } ],
  feedback: { summary, didWell:[], improve:[], nextTime:[] },   // max 3 strings per array
  createdAt }
na and unjudged are NOT failures: show them distinctly. If degraded is true, show a short notice that some evaluations were unavailable and the score may be incomplete.

## Fixed English texts (Amharic versions need native review)
Banner (always visible in chat, not dismissible): "This is a simulation. Never type your real passwords, codes or ID numbers. Use only the fake data on your card."
Notice (register page + chat footer): "Demo notice: chats may be processed and reviewed by the AI provider. Do not share anything private."