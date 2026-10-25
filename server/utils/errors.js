
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name    = 'AppError'
    this.status  = status
    this.code    = code
    this.details = details
  }
}

export function validationError(message, details) {
  return new AppError(400, 'VALIDATION_ERROR', message, details)
}

export function unauthorized() {
  return new AppError(401, 'UNAUTHORIZED', 'Authentication required.')
}

export function invalidCredentials() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')
}

export function forbidden() {
  return new AppError(403, 'FORBIDDEN', 'Access denied.')
}

export function notFound() {
  return new AppError(404, 'NOT_FOUND', 'The requested resource was not found.')
}

export function emailTaken() {
  return new AppError(409, 'EMAIL_TAKEN', 'An account with that email address already exists.')
}

export function sessionFinished() {
  return new AppError(409, 'SESSION_FINISHED', 'This session has already been finished.')
}

export function rateLimited() {
  return new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')
}

export function llmFailed() {
  return new AppError(502, 'LLM_FAILED', 'The AI service encountered an error.')
}

export function llmBusy() {
  return new AppError(503, 'LLM_BUSY', 'The AI service is currently busy.')
}

export function serverError() {
  return new AppError(500, 'SERVER_ERROR', 'An unexpected error occurred.')
}
