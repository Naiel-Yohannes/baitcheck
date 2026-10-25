import { strings } from './i18n'

export function errorText(err, t) {
  const code = err?.code
  if (!code) return t('errorGeneric')

  const key = `error_${code}`
  if (key in strings.en) return t(key)
  return t('errorGeneric')
}
