/**
 * src/api/index.js
 * One function per API endpoint. Returns the exact JSON body the server sends.
 * No unwrapping, no renaming.
 * Pages import from here — never from http.js directly.
 */
import { request } from './http'

// Re-export everything consumers may need
export { ApiError, clearToken, getToken, setToken, setUnauthorizedHandler } from './http'

// ── Health ───────────────────────────────────────────────────────
/** GET /api/health → { ok: true } */
export function health() {
  return request('GET', '/api/health')
}

// ── Auth ─────────────────────────────────────────────────────────
/**
 * POST /auth/register → 201 { token, user, joinCode? }
 * @param {{ name, email, password, joinCode?, orgName? }} data
 */
export function register(data) {
  return request('POST', '/api/auth/register', data)
}

/**
 * POST /auth/login → 200 { token, user }
 * @param {{ email, password }} data
 */
export function login(data) {
  return request('POST', '/api/auth/login', data)
}

/** GET /auth/me (auth) → { user } */
export function getMe() {
  return request('GET', '/api/auth/me')
}

// ── Scenarios ────────────────────────────────────────────────────
/**
 * GET /scenarios (auth)
 * → { scenarios: [ { id, title:{en,am}, description:{en,am}, languages, channel, estimatedMinutes } ] }
 */
export function getScenarios() {
  return request('GET', '/api/scenarios')
}

// ── Sessions ─────────────────────────────────────────────────────
/**
 * POST /sessions (auth) → 201 { sessionId, scenarioId, scenarioTitle, language, channel, persona, firstMessage, maxTurns, turnCount }
 * @param {string} scenarioId
 * @param {'en'|'am'} language
 */
export function startSession(scenarioId, language) {
  return request('POST', '/api/sessions', { scenarioId, language })
}

/**
 * GET /sessions/:id (auth, owner)
 * → { session: { id, scenarioId, scenarioTitle, language, channel, status, turnCount, maxTurns, stageIndex, persona, messages, report } }
 * @param {string} id
 */
export function getSession(id) {
  return request('GET', `/api/sessions/${encodeURIComponent(id)}`)
}

/**
 * POST /sessions/:id/message (auth, owner) → { reply, stageIndex, turnCount, ended, warning }
 * @param {string} id
 * @param {string} text  1-500 chars (trimmed by server)
 */
export function sendMessage(id, text) {
  return request('POST', `/api/sessions/${encodeURIComponent(id)}/message`, { text })
}

/**
 * POST /sessions/:id/finish (auth, owner) → { report }
 * @param {string} id
 */
export function finishSession(id) {
  return request('POST', `/api/sessions/${encodeURIComponent(id)}/finish`)
}

/**
 * GET /sessions/mine (auth)
 * → { sessions: [ { id, scenarioId, scenarioTitle, language, status, score, band, createdAt, finishedAt } ] }
 */
export function getMySessions() {
  return request('GET', '/api/sessions/mine')
}

// ── Org ──────────────────────────────────────────────────────────
/**
 * GET /org/summary (auth, orgAdmin only)
 * → { org:{name,joinCode}, averageScore, completedSessions, employeeCount, employees:[...] }
 */
export function getOrgSummary() {
  return request('GET', '/api/org/summary')
}
