import { request } from './http'

export { ApiError, clearToken, getToken, setToken, setUnauthorizedHandler } from './http'

export function health() {
  return request('GET', '/api/health')
}

export function register(data) {
  return request('POST', '/api/auth/register', data)
}

export function login(data) {
  return request('POST', '/api/auth/login', data)
}

export function getMe() {
  return request('GET', '/api/auth/me')
}

export function getScenarios() {
  return request('GET', '/api/scenarios')
}

export function startSession(scenarioId, language) {
  return request('POST', '/api/sessions', { scenarioId, language })
}

export function getSession(id) {
  return request('GET', `/api/sessions/${encodeURIComponent(id)}`)
}

export function sendMessage(id, text) {
  return request('POST', `/api/sessions/${encodeURIComponent(id)}/message`, { text })
}

export function finishSession(id) {
  return request('POST', `/api/sessions/${encodeURIComponent(id)}/finish`)
}

export function getMySessions() {
  return request('GET', '/api/sessions/mine')
}

export function getOrgSummary() {
  return request('GET', '/api/org/summary')
}
