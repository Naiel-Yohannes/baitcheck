import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { strings } from '../i18n'

const STORAGE_KEY = 'baitcheck_lang'
const SUPPORTED   = ['en', 'am']

function readStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && SUPPORTED.includes(stored)) return stored
  } catch {
  }
  return 'en'
}

function writeStoredLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
  }
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStoredLang)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next) => {
    if (!SUPPORTED.includes(next)) return
    writeStoredLang(next)
    setLangState(next)
  }, [])

  const t = useCallback(
    (key) =>
      strings[lang]?.[key] ??
      strings.en?.[key]    ??
      key,
    [lang],
  )

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>')
  return ctx
}
