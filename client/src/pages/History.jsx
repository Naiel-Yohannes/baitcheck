import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMySessions } from '../api'
import { useLang } from '../context/LanguageContext'
import { errorText } from '../errorText'

function formatDate(value, locale) {
  if (value == null) return '-'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return String(value).slice(0, 10)
  }
}

function bandLabel(band, t) {
  const key = {
    vulnerable: 'bandVulnerable',
    partial: 'bandPartial',
    resilient: 'bandResilient',
    strong: 'bandStrong',
  }[band]
  return key ? t(key) : ''
}

export default function History() {
  const { lang, t } = useLang()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  const loadSessions = useCallback(async (isCancelled = () => false) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getMySessions()
      if (isCancelled()) return
      setSessions(Array.isArray(res?.sessions) ? res.sessions : [])
    } catch (err) {
      if (isCancelled()) return
      setLoadError(err)
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSessions(() => cancelled)
    return () => { cancelled = true }
  }, [loadSessions, retryKey])

  return (
    <main className="mx-auto w-full max-w-5xl px-2 py-4 sm:px-0 sm:py-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-white">{t('headingHistory')}</h1>

      {loading ? (
        <p className="py-12 text-center text-slate-300" role="status">{t('historyLoading')}</p>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-500/30 bg-slate-900/70 px-5 py-8 text-center">
          <p className="text-rose-200" role="alert">{errorText(loadError, t)}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="min-h-11 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">{t('actionRetry')}</button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-10 text-center">
          <p className="text-slate-300">{t('historyEmpty')}</p>
          <Link to="/scenarios" className="inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">{t('historyBrowseScenarios')}</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-lg sm:p-5">
              <h2 className="break-words text-lg font-semibold text-white">{item.scenarioTitle}</h2>
              <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('historyLanguage')}</dt>
                  <dd className="mt-1 text-slate-200">{item.language === 'am' ? t('reportLanguageAmharic') : t('reportLanguageEnglish')}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('historyCreated')}</dt>
                  <dd className="mt-1 text-slate-200">{formatDate(item.createdAt, lang)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{t('historyResult')}</dt>
                  <dd className="mt-1">
                    {item.status === 'finished' ? (
                      <span className="font-semibold text-white">{item.score} {t('reportScoreOutOf')} <span className="ml-1 text-violet-200">{bandLabel(item.band, t)}</span></span>
                    ) : (
                      <span className="text-slate-300">{t('historyNoFinalScore')}</span>
                    )}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                {item.status === 'finished' ? (
                  <Link to={`/report/${encodeURIComponent(item.id)}`} className="inline-flex min-h-11 items-center rounded-xl border border-violet-500/50 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/10">{t('historyViewReport')}</Link>
                ) : (
                  <Link to={`/chat/${encodeURIComponent(item.id)}`} className="inline-flex min-h-11 items-center rounded-xl border border-sky-500/50 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/10">{t('historyContinue')}</Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
