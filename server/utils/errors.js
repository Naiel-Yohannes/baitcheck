/**
 * server/utils/errors.js
 * AppError class and helper constructors for every error code in the spec.
 */

export class AppError extends Error {
  /**
   * @param {number} status   HTTP status code
   * @param {string} code     Machine-readable error code
   * @param {string} message  Human-readable message (English)
   * @param {any}    [details] Optional structured details
   */
  constructor(status, code, message, details) {
    super(message)
    this.name    = 'AppError'
    this.status  = status
    this.code    = code
    this.details = details
  }
}

// ── 400 ──────────────────────────────────────────────────────────
/**
 * @param {string} message
 * @param {Array<{field: string, issue: string}>} [details]
 */
export function validationError(message, details) {
  return new AppError(400, 'VALIDATION_ERROR', message, details)
}

// ── 401 ──────────────────────────────────────────────────────────
export function unauthorized() {
  return new AppError(401, 'UNAUTHORIZED', 'Authentication required.')
}

export function invalidCredentials() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')
}

// ── 403 ──────────────────────────────────────────────────────────
export function forbidden() {
  return new AppError(403, 'FORBIDDEN', 'Access denied.')
}

// ── 404 ──────────────────────────────────────────────────────────
export function notFound() {
  return new AppError(404, 'NOT_FOUND', 'The requested resource was not found.')
}

// ── 409 ──────────────────────────────────────────────────────────
export function emailTaken() {
  return new AppError(409, 'EMAIL_TAKEN', 'An account with that email address already exists.')
}

export function sessionFinished() {
  return new AppError(409, 'SESSION_FINISHED', 'This session has already been finished.')
}

// ── 429 ──────────────────────────────────────────────────────────
export function rateLimited() {
  return new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')
}

// ── 502 ──────────────────────────────────────────────────────────
export function llmFailed() {
  return new AppError(502, 'LLM_FAILED', 'The AI service encountered an error.')
}

// ── 503 ──────────────────────────────────────────────────────────
export function llmBusy() {
  return new AppError(503, 'LLM_BUSY', 'The AI service is currently busy.')
}

// ── 500 ──────────────────────────────────────────────────────────
export function serverError() {
  return new AppError(500, 'SERVER_ERROR', 'An unexpected error occurred.')
}
