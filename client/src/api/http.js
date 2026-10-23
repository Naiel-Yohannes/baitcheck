/**
 * src/api/http.js
 * Low-level HTTP layer. All network calls flow through request().
 * Pages never import this directly — use src/api/index.js.
 */

// ── ApiError ────────────────────────────────────────────────────
export class ApiError extends Error {
  /**
   * @param {number} status  HTTP status (0 = network failure)
   * @param {string} code    Machine-readable code from server or 'NETWORK_ERROR' / 'SERVER_ERROR'
   * @param {string} message Human-readable (English, from server)
   * @param {any}    details Optional structured details (e.g. [{field, issue}])
   */
  constructor(status, code, message, details = undefined) {
    super(message)
    this.name    = 'ApiError'
    this.status  = status
    this.code    = code
    this.details = details
  }
}

// ── Token helpers ────────────────────────────────────────────────
const TOKEN_KEY = 'baitcheck_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // ignore (private browsing, storage full, etc.)
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

// ── Unauthorized handler ─────────────────────────────────────────
let _unauthorizedHandler = null

/**
 * Register a callback that fires ONLY on 401 + code UNAUTHORIZED.
 * INVALID_CREDENTIALS (wrong password) must NOT trigger it.
 */
export function setUnauthorizedHandler(fn) {
  _unauthorizedHandler = fn
}

// ── Core request ─────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const API_BASE_URL = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL

/**
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
 * @param {string} path   Must start with /
 * @param {object} [body] JSON-serialisable body (omit for GET)
 * @returns {Promise<any>} Parsed JSON body on success
 * @throws {ApiError}
 */
export async function request(method, path, body) {
  if (import.meta.env.PROD && !API_BASE_URL.trim()) {
    throw new ApiError(0, 'NETWORK_ERROR', 'API URL is not configured')
  }

  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let response
  try {
    response = await fetch(API_BASE_URL + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (networkErr) {
    throw new ApiError(0, 'NETWORK_ERROR', networkErr?.message ?? 'Network error')
  }

  if (response.ok) {
    // 204 No Content — return null
    if (response.status === 204) return null
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  // ── Non-2xx: parse error body ────────────────────────────────
  let errorPayload
  try {
    errorPayload = await response.json()
  } catch {
    throw new ApiError(response.status, 'SERVER_ERROR', 'Unexpected server response')
  }

  const err = errorPayload?.error
  if (!err || typeof err.code !== 'string') {
    throw new ApiError(response.status, 'SERVER_ERROR', 'Unexpected server response')
  }

  const apiErr = new ApiError(response.status, err.code, err.message ?? '', err.details)

  // Fire the unauthorized handler ONLY for true session expiry
  if (response.status === 401 && err.code === 'UNAUTHORIZED') {
    _unauthorizedHandler?.()
  }

  throw apiErr
}
