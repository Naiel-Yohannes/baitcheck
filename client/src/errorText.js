import { strings } from './i18n'

/**
 * errorText(err, t) — return the translated message for an ApiError.
 * Looks up err.code in the active language via t(), falling back to
 * the generic error string if the code has no dedicated translation.
 *
 * @param {{ code?: string }} err  Any object with a .code string (typically ApiError)
 * @param {(key: string) => string} t  Translation function from useLang()
 * @returns {string}
 */
export function errorText(err, t) {
  const code = err?.code
  if (!code) return t('errorGeneric')

  const key = `error_${code}`
  // Check whether the key actually exists in the en strings
  // (t() falls back to the key itself if missing, which would expose raw key names)
  if (key in strings.en) return t(key)
  return t('errorGeneric')
}
