
export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message)
    this.name    = 'ApiError'
    this.status  = status
    this.code    = code
    this.details = details
  }
}

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
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
  }
}

let _unauthorizedHandler = null

export function setUnauthorizedHandler(fn) {
  _unauthorizedHandler = fn
}

const BASE_URL = import.meta.env.VITE_API_URL ?? ''
const API_BASE_URL = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL

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
    if (response.status === 204) return null
    try {
      return await response.json()
    } catch {
      return null
    }
  }

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

  if (response.status === 401 && err.code === 'UNAUTHORIZED') {
    _unauthorizedHandler?.()
  }

  throw apiErr
}
