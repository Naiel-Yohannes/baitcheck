import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getOrgSummary } from '../api'
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

function StatCard({ label, value }) {
  return (
    <article className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 shadow-lg sm:p-5">
      <h2 className="text-sm font-medium text-slate-400">{label}</h2>
      <p className="mt-2 break-words text-2xl font-bold text-white">{value}</p>
    </article>
  )
}

function EmployeeSessions({ employee, locale, t }) {
  const sessions = employee.sessions ?? []
  if (sessions.length === 0) return <p className="py-3 text-sm text-slate-400">{t('adminNoCompletedSessions')}</p>

  return (
    <ul className="divide-y divide-slate-800">
      {sessions.map((session, index) => (
        <li key={`${session.scenarioId}-${index}`} className="grid grid-cols-1 gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
          <span className="break-words text-slate-200">{session.scenarioTitle}</span>
          <span className="font-semibold text-white">{session.score} {t('reportScoreOutOf')} <span className="ml-1 text-violet-200">{bandLabel(session.band, t)}</span></span>
          <span className="text-slate-400">{formatDate(session.finishedAt, locale)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Admin() {
  const { lang, t } = useLang()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [expandedEmployees, setExpandedEmployees] = useState({})
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef(null)

  const loadSummary = useCallback(async (isCancelled = () => false) => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getOrgSummary()
      if (isCancelled()) return
      setSummary(res ?? null)
    } catch (err) {
      if (isCancelled()) return
      setLoadError(err)
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadSummary(() => cancelled)
    return () => { cancelled = true }
  }, [loadSummary, retryKey])

  useEffect(() => () => {
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
  }, [])

  const copyJoinCode = async () => {
    try {
      await navigator.clipboard.writeText(summary.org.joinCode)
      setCopied(true)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const toggleEmployee = (employeeId) => {
    setExpandedEmployees((current) => ({ ...current, [employeeId]: !current[employeeId] }))
  }

  if (loading) {
    return <p className="py-12 text-center text-slate-300" role="status">{t('adminLoading')}</p>
  }

  if (loadError) {
    const forbidden = loadError instanceof ApiError && loadError.code === 'FORBIDDEN'
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center gap-4 px-2 text-center">
        <p className="text-rose-200" role="alert">{forbidden ? t('adminNoPermission') : errorText(loadError, t)}</p>
        <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="min-h-11 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">{t('actionRetry')}</button>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
        <p className="text-slate-300">{t('adminEmpty')}</p>
        <button type="button" onClick={() => setRetryKey((key) => key + 1)} className="min-h-11 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">{t('actionRetry')}</button>
      </div>
    )
  }

  const employees = Array.isArray(summary.employees) ? summary.employees : []
  const score = summary.averageScore == null ? t('adminNoData') : `${summary.averageScore} ${t('reportScoreOutOf')}`

  return (
    <main className="mx-auto w-full max-w-6xl px-2 py-4 sm:px-0 sm:py-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-white">{t('headingAdmin')}</h1>

      <section className="mb-6 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/70 to-slate-900 p-5 shadow-lg sm:p-6">
        <h2 className="break-words font-mono text-2xl font-bold text-white">{summary.org?.name}</h2>
        <p className="mt-2 text-sm text-slate-300">{t('adminJoinCodeHelp')}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 select-text break-all rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 font-mono text-2xl font-bold tracking-widest text-violet-200 sm:text-3xl">{summary.org?.joinCode}</p>
          <button type="button" onClick={copyJoinCode} className="min-h-11 shrink-0 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">{copied ? t('adminCopied') : t('adminCopyCode')}</button>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label={t('adminOrganizationStats')}>
        <StatCard label={t('adminAverageScore')} value={score} />
        <StatCard label={t('adminCompletedSessions')} value={summary.completedSessions} />
        <StatCard label={t('adminEmployeeCount')} value={summary.employeeCount} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-white">{t('adminEmployees')}</h2>
        {employees.length === 0 ? (
          <p className="rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-8 text-center text-slate-300">{t('adminNoEmployees')}</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {employees.map((employee) => (
                <article key={employee.id} className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80">
                  <button type="button" onClick={() => toggleEmployee(employee.id)} aria-expanded={Boolean(expandedEmployees[employee.id])} className="grid min-h-11 w-full grid-cols-2 gap-x-3 gap-y-3 p-4 text-left hover:bg-slate-800/80">
                    <span className="col-span-2 break-words text-base font-semibold text-white">{employee.name}</span>
                    <span><span className="block text-xs text-slate-400">{t('adminSessionsCompleted')}</span><span className="mt-1 block text-sm text-slate-200">{employee.sessionsCompleted}</span></span>
                    <span><span className="block text-xs text-slate-400">{t('adminAverageScore')}</span><span className="mt-1 block text-sm text-slate-200">{employee.averageScore == null ? '-' : `${employee.averageScore} ${t('reportScoreOutOf')}`}</span></span>
                    <span className="col-span-2"><span className="block text-xs text-slate-400">{t('adminLastActivity')}</span><span className="mt-1 block text-sm text-slate-200">{formatDate(employee.lastActivity, lang)}</span></span>
                  </button>
                  {expandedEmployees[employee.id] && <div className="border-t border-slate-800 px-4 py-2"><EmployeeSessions employee={employee} locale={lang} t={t} /></div>}
                </article>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-slate-700 md:block">
              <table className="w-full table-fixed text-left">
                <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">{t('adminEmployeeName')}</th>
                    <th className="px-4 py-3">{t('adminSessionsCompleted')}</th>
                    <th className="px-4 py-3">{t('adminAverageScore')}</th>
                    <th className="px-4 py-3">{t('adminLastActivity')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-950/70">
                  {employees.map((employee) => (
                    <Fragment key={employee.id}>
                      <tr>
                        <td colSpan={4} className="p-0">
                          <button type="button" onClick={() => toggleEmployee(employee.id)} aria-expanded={Boolean(expandedEmployees[employee.id])} className="grid min-h-11 w-full grid-cols-4 items-center text-left text-sm text-slate-200 hover:bg-slate-900">
                            <span className="break-words px-4 py-3 font-medium text-white">{employee.name}</span>
                            <span className="px-4 py-3">{employee.sessionsCompleted}</span>
                            <span className="px-4 py-3">{employee.averageScore == null ? '-' : `${employee.averageScore} ${t('reportScoreOutOf')}`}</span>
                            <span className="px-4 py-3">{formatDate(employee.lastActivity, lang)}</span>
                          </button>
                        </td>
                      </tr>
                      {expandedEmployees[employee.id] && (
                        <tr><td colSpan={4} className="bg-slate-900/70 px-5 py-2"><EmployeeSessions employee={employee} locale={lang} t={t} /></td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
