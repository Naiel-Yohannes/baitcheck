import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getScenarios, startSession } from '../api'
import { useLang } from '../context/LanguageContext'
import { errorText } from '../errorText'

const languageOptions = [
  { code: 'en', labelKey: 'scenarioLanguageEnglish' },
  { code: 'am', labelKey: 'scenarioLanguageAmharic' },
]

function ScenarioCard({ scenario, lang, t, selectedLanguage, onSelectLanguage, onStart, pending }) {
  const supports = (language) => scenario.languages?.includes(language)
  const effectiveLanguage = supports(selectedLanguage)
    ? selectedLanguage
    : supports(lang)
      ? lang
      : scenario.languages?.[0]
  const title = scenario.title?.[lang] ?? scenario.title?.en ?? ''
  const description = scenario.description?.[lang] ?? scenario.description?.en ?? ''
  const channelKey = {
    call: 'scenarioChannelCall',
    telegram: 'scenarioChannelTelegram',
    message: 'scenarioChannelMessage',
  }[scenario.channel] ?? 'scenarioChannelMessage'

  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-700 bg-slate-900/80 p-5 shadow-lg sm:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-3 py-1 text-sm font-medium text-violet-200">
          {t(channelKey)}
        </span>
        <span className="text-sm text-slate-400">{t('scenarioAboutMinutes').replace('{minutes}', scenario.estimatedMinutes)}</span>
      </div>
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-6 text-slate-300">{description}</p>

      <div className="mt-6">
        <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1" role="group" aria-label={t('scenarioChooseLanguage')}>
          {languageOptions.map(({ code, labelKey }) => {
            const available = supports(code)
            const selected = effectiveLanguage === code
            return (
              <button
                key={code}
                type="button"
                disabled={!available}
                aria-pressed={selected}
                onClick={() => onSelectLanguage(scenario.id, code)}
                className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
                  selected ? 'bg-violet-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                } disabled:cursor-not-allowed disabled:text-slate-600 disabled:hover:bg-transparent`}
              >
                {t(labelKey)}
              </button>
            )
          })}
        </div>
        {!supports(effectiveLanguage) && (
          <p className="mt-2 text-xs text-amber-300">{t('scenarioLanguageUnavailable')}</p>
        )}
        {languageOptions.some(({ code }) => !supports(code)) && (
          <p className="mt-2 text-xs text-slate-400">{t('scenarioLanguageUnavailable')}</p>
        )}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => onStart(scenario.id, effectiveLanguage)}
        className="mt-5 min-h-11 w-full rounded-xl bg-violet-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t('scenarioStarting') : t('scenarioStart')}
      </button>
    </article>
  )
}

export default function Scenarios() {
  const { lang, t } = useLang()
  const navigate = useNavigate()
  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [startError, setStartError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [selectedLanguages, setSelectedLanguages] = useState({})
  const [pendingScenarioId, setPendingScenarioId] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(null)
    getScenarios()
      .then((res) => {
        if (!active) return
        setScenarios(Array.isArray(res?.scenarios) ? res.scenarios : [])
      })
      .catch((err) => {
        if (active) setLoadError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [retryKey])

  const selectLanguage = useCallback((scenarioId, language) => {
    setSelectedLanguages((current) => ({ ...current, [scenarioId]: language }))
  }, [])

  const handleStart = async (scenarioId, language) => {
    if (pendingScenarioId) return
    setPendingScenarioId(scenarioId)
    setStartError(null)
    try {
      const response = await startSession(scenarioId, language)
      if (response?.sessionId) navigate(`/chat/${encodeURIComponent(response.sessionId)}`)
      else throw new Error('Session response did not include an id')
    } catch (err) {
      setStartError(errorText(err, t))
    } finally {
      setPendingScenarioId(null)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-white">{t('headingScenarios')}</h1>

      {startError && (
        <div role="alert" className="mb-6 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm text-rose-200">
          {startError}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-slate-300" role="status">{t('scenarioLoading')}</p>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-rose-500/30 bg-slate-900/70 px-5 py-8 text-center">
          <p className="text-rose-200" role="alert">{errorText(loadError, t)}</p>
          <button
            type="button"
            onClick={() => setRetryKey((key) => key + 1)}
            className="min-h-11 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            {t('actionRetry')}
          </button>
        </div>
      ) : scenarios.length === 0 ? (
        <p className="rounded-2xl border border-slate-700 bg-slate-900/70 px-5 py-8 text-center text-slate-300">{t('scenarioEmpty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              lang={lang}
              t={t}
              selectedLanguage={selectedLanguages[scenario.id]}
              onSelectLanguage={selectLanguage}
              onStart={handleStart}
              pending={pendingScenarioId !== null}
            />
          ))}
        </div>
      )}
    </main>
  )
}
