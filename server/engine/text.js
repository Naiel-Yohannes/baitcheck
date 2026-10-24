export function stripDigitSeparators(text) {
  return (typeof text === 'string' ? text : '').replace(/(?<=\d)[\s.\-]+(?=\d)/g, '')
}

export function isDigitsOnly(value) {
  return typeof value === 'string' && /^\d+$/.test(value)
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function cut(text, max) {
  const value = typeof text === 'string' ? text.trim() : ''
  const length = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : value.length
  return value.slice(0, length).trim()
}
