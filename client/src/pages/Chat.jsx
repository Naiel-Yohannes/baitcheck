import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError, finishSession, getSession, sendMessage } from '../api'
import { useLang } from '../context/LanguageContext'
import { errorText } from '../errorText'

function channelTranslation(channel) {
  return {
    call: 'scenarioChannelCall',
    telegram: 'scenarioChannelTelegram',
    message: 'scenarioChannelMessage',
  }[channel] ?? 'scenarioChannelMessage'
}

export default function Chat() {
  const { sessionId } = useParams()
  const { t } = useLang()
  const tRef = useRef(t)
  tRef.current = t
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [turnCount, setTurnCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [warning, setWarning] = useState(null)
  const [sendError, setSendError] = useState(null)
  const [ended, setEnded] = useState(false)
  const [finishState, setFinishState] = useState('idle')
  const [finishError, setFinishError] = useState(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [personaExpanded, setPersonaExpanded] = useState(true)
  const messageAreaRef = useRef(null)
  const nextMessageId = useRef(0)
  const aliveRef = useRef(true)
  const generationRef = useRef(0)
  const currentSessionIdRef = useRef(sessionId)
  currentSessionIdRef.current = sessionId
  const finishingRef = useRef(false)
  const autoFinishStartedRef = useRef(null)
  const automaticEndRef = useRef(false)
  const finalReplyShownAtRef = useRef(null)

  const startFinish = useCallback(async () => {
    if (finishingRef.current) return
    finishingRef.current = true
    const requestGeneration = generationRef.current
    const requestSessionId = sessionId
    const waitForFinalReply = automaticEndRef.current
    setFinishState('finishing')
    setFinishError(null)
    try {
      await finishSession(requestSessionId)
      if (!aliveRef.current || currentSessionIdRef.current !== requestSessionId || generationRef.current !== requestGeneration) return
      if (waitForFinalReply) {
        const shownAt = finalReplyShownAtRef.current ?? Date.now()
        const remaining = 2500 - (Date.now() - shownAt)
        if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining))
      }
      if (!aliveRef.current || currentSessionIdRef.current !== requestSessionId || generationRef.current !== requestGeneration) return
      navigate(`/report/${encodeURIComponent(requestSessionId)}`, { replace: true })
    } catch (err) {
      if (!aliveRef.current || currentSessionIdRef.current !== requestSessionId || generationRef.current !== requestGeneration) return
      finishingRef.current = false
      setFinishState('failed')
      setFinishError(errorText(err, tRef.current))
      if (err instanceof ApiError && err.status === 404 && err.code === 'NOT_FOUND') setLoadError(err)
      else if (err instanceof ApiError && err.status === 409 && err.code === 'SESSION_FINISHED') {
        navigate(`/report/${encodeURIComponent(requestSessionId)}`, { replace: true })
      }
    }
  }, [navigate, sessionId])

  useEffect(() => {
    let active = true
    const requestGeneration = ++generationRef.current
    aliveRef.current = true
    setLoading(true)
    setLoadError(null)
    setSession(null)
    setMessages([])
    setTurnCount(0)
    setEnded(false)
    automaticEndRef.current = false
    finalReplyShownAtRef.current = null
    setFinishState('idle')
    setFinishError(null)
    setConfirmEnd(false)
    setSendError(null)
    setWarning(null)
    setDraft('')
    pendingRef.current = false
    setPending(false)
    getSession(sessionId)
      .then((res) => {
        if (!active) return
        const loaded = res?.session
        if (!loaded) throw new Error('Session response did not include a session')
        if (loaded.status === 'finished') {
          navigate(`/report/${encodeURIComponent(loaded.id)}`, { replace: true })
          return
        }
        setSession(loaded)
        setMessages((loaded.messages ?? []).map((message, index) => ({ ...message, localId: `initial-${index}` })))
        setTurnCount(loaded.turnCount)
        if (loaded.endReason || loaded.turnCount >= loaded.maxTurns) {
          setEnded(true)
          automaticEndRef.current = true
          finalReplyShownAtRef.current = null
          if (autoFinishStartedRef.current !== sessionId) {
            autoFinishStartedRef.current = sessionId
            void startFinish()
          }
        }
      })
      .catch((err) => {
        if (active) setLoadError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
      generationRef.current += 1
      aliveRef.current = false
    }
  }, [sessionId, retryKey, navigate, startFinish])

  useLayoutEffect(() => {
    if (ended && messages.at(-1)?.role === 'attacker') finalReplyShownAtRef.current = Date.now()
  }, [ended, messages])

  useEffect(() => {
    if (!session || loading || loadError) return
    const area = messageAreaRef.current
    if (area) area.scrollTop = area.scrollHeight
  }, [messages, pending, session, loading, loadError])

  const retryLoad = useCallback(() => setRetryKey((key) => key + 1), [])

  const handleSend = async (event) => {
    event?.preventDefault?.()
    const text = draft.trim()
    if (!text || pendingRef.current || finishingRef.current || ended || finishState === 'finishing' || session?.status === 'finished' || !session) return

    const requestGeneration = generationRef.current
    pendingRef.current = true
    setPending(true)
    const localId = `pending-${nextMessageId.current++}`
    setMessages((current) => [...current, { role: 'user', text, localId, pending: true }])
    setDraft('')
    setWarning(null)
    setSendError(null)
    setFinishState('idle')
    setFinishError(null)

    try {
      const response = await sendMessage(sessionId, text)
      if (!aliveRef.current || currentSessionIdRef.current !== sessionId || generationRef.current !== requestGeneration) return
      if (response?.reply === null && response?.warning) {
        setMessages((current) => current.filter((message) => message.localId !== localId))
        setDraft(text)
        setWarning(response.warning.message)
        return
      }
      setMessages((current) => [
        ...current.map((message) => message.localId === localId ? { ...message, pending: false } : message),
        ...(response?.reply != null ? [{ role: 'attacker', text: response.reply, localId: `reply-${nextMessageId.current++}` }] : []),
      ])
      setTurnCount(response.turnCount)
      setSession((current) => current ? { ...current, turnCount: response.turnCount, stageIndex: response.stageIndex } : current)
      if (response.ended) {
        setEnded(true)
        autoFinishStartedRef.current = sessionId
        automaticEndRef.current = true
        finalReplyShownAtRef.current = null
        void startFinish()
      }
    } catch (err) {
      if (!aliveRef.current || currentSessionIdRef.current !== sessionId || generationRef.current !== requestGeneration) return
      setMessages((current) => current.filter((message) => message.localId !== localId))
      setDraft(text)
      if (err instanceof ApiError && err.status === 409 && err.code === 'SESSION_FINISHED') {
        navigate(`/report/${encodeURIComponent(session.id)}`, { replace: true })
      } else if (err instanceof ApiError && err.status === 404 && err.code === 'NOT_FOUND') {
        setLoadError(err)
      } else {
        setSendError(errorText(err, t))
      }
    } finally {
      if (aliveRef.current && currentSessionIdRef.current === sessionId && generationRef.current === requestGeneration) {
        pendingRef.current = false
        setPending(false)
      }
    }
  }

  if (loading) {
    return <div className="flex min-h-[55dvh] items-center justify-center text-slate-300" role="status">{t('chatLoading')}</div>
  }

  if (loadError) {
    const notFound = loadError instanceof ApiError && loadError.status === 404 && loadError.code === 'NOT_FOUND'
    return (
      <div className="mx-auto flex min-h-[55dvh] max-w-lg flex-col items-center justify-center gap-4 px-2 text-center">
        <p className="text-rose-200" role="alert">{notFound ? t('chatSessionNotFound') : errorText(loadError, t)}</p>
        {notFound ? (
          <Link to="/scenarios" className="inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">{t('chatBackToScenarios')}</Link>
        ) : (
          <button type="button" onClick={retryLoad} className="min-h-11 rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500">{t('actionRetry')}</button>
        )}
      </div>
    )
  }

  if (!session || session.status === 'finished') return <Navigate to={`/report/${encodeURIComponent(session?.id ?? sessionId)}`} replace />

  return (
    <section className="-mx-2 flex h-[calc(100dvh-11rem)] min-h-[31rem] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950 sm:-mx-0" aria-label={t('headingChat')}>
      <header className="shrink-0 border-b border-slate-800 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-lg font-semibold leading-6 text-white">{session.scenarioTitle}</h1>
            <span className="mt-1 inline-flex rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-200">{t(channelTranslation(session.channel))}</span>
          </div>
          <p className="shrink-0 whitespace-nowrap rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200" aria-label={t('chatTurnCounter').replace('{current}', turnCount).replace('{maximum}', session.maxTurns)}>
            {turnCount} / {session.maxTurns}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={turnCount === 0 || pending || finishState === 'finishing' || ended}
            onClick={() => setConfirmEnd(true)}
            className="min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('chatEndSession')}
          </button>
          {turnCount === 0 && <span className="text-xs text-slate-400">{t('chatEndSessionHint')}</span>}
        </div>
        {confirmEnd && (
          <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900 p-3" role="group" aria-label={t('chatConfirmEnd')}>
            <p className="text-sm text-slate-200">{t('chatConfirmEnd')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setConfirmEnd(false); automaticEndRef.current = false; void startFinish() }} className="min-h-11 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">{t('chatConfirm')}</button>
              <button type="button" onClick={() => setConfirmEnd(false)} className="min-h-11 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">{t('chatCancel')}</button>
            </div>
          </div>
        )}
        {finishState === 'finishing' && (
          <p className="mt-2 flex items-center gap-2 text-sm text-violet-200" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300/30 border-t-violet-300" aria-hidden="true" />
            {t('chatPreparingReport')}
          </p>
        )}
      </header>

      <div className="sticky top-0 z-10 shrink-0 border-b border-amber-400/30 bg-amber-300 px-4 py-2.5 text-sm font-medium leading-5 text-amber-950" role="note">
        {t('simulationBanner')}
      </div>

      <div className="shrink-0 border-b border-slate-800 px-3 py-2 sm:px-4">
        <div className="rounded-xl border border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <h2 className="min-w-0 break-words text-sm font-semibold text-white">{session.persona?.userRole}</h2>
            <button type="button" onClick={() => setPersonaExpanded((expanded) => !expanded)} aria-expanded={personaExpanded} className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-medium text-sky-300 hover:bg-slate-800">
              {personaExpanded ? t('chatCollapsePersona') : t('chatExpandPersona')}
            </button>
          </div>
          {personaExpanded && (
            <div className="border-t border-slate-800 px-3 py-2">
              <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
                {(session.persona?.fakeData ?? []).map((item, index) => (
                  <div key={`${item.key}-${index}`} className="flex min-w-0 gap-1 text-xs leading-5 text-slate-300">
                    <dt className="shrink-0">{item.label}:</dt>
                    <dd className="min-w-0 break-all font-mono text-emerald-200">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs leading-5 text-amber-200">{t('chatFakeDataNote')}</p>
            </div>
          )}
        </div>
      </div>

      <div ref={messageAreaRef} lang={session.language} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5">
        {messages.map((message) => {
          const isUser = message.role === 'user'
          return (
            <div key={message.localId} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <p className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6 sm:max-w-[78%] ${
                isUser ? 'rounded-br-md bg-violet-700 text-white' : 'rounded-bl-md bg-slate-800 text-slate-100'
              } ${message.pending ? 'opacity-60' : ''}`}>
                {message.text}
              </p>
            </div>
          )
        })}
        {pending && <p className="text-xs italic text-slate-400" role="status">{t('chatTyping')}</p>}
      </div>

      <form onSubmit={handleSend} className="shrink-0 border-t border-slate-800 bg-slate-950 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-4">
        {warning && <p className="mb-2 rounded-lg border border-amber-400/40 bg-amber-950/60 px-3 py-2 text-sm text-amber-200" role="alert">{warning}</p>}
        {sendError && <p className="mb-2 rounded-lg border border-rose-400/40 bg-rose-950/60 px-3 py-2 text-sm text-rose-200" role="alert">{sendError}</p>}
        {finishError && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-400/40 bg-rose-950/60 px-3 py-2" role="alert">
            <p className="text-sm text-rose-200">{finishError}</p>
            {finishState === 'failed' && <button type="button" onClick={() => void startFinish()} className="min-h-11 rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">{t('chatTryAgain')}</button>}
          </div>
        )}
        {ended && <p className="mb-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200" role="status">{t('chatEnded')}</p>}
        <label htmlFor="chat-message" className="sr-only">{t('chatMessageLabel')}</label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-message"
            value={draft}
            maxLength={500}
            rows={2}
            disabled={ended || finishState === 'finishing'}
            onChange={(event) => {
              setDraft(event.target.value)
              setWarning(null)
              setSendError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                handleSend()
              }
            }}
            placeholder={t('chatMessagePlaceholder')}
            className="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-60"
          />
          <button type="submit" disabled={ended || finishState === 'finishing' || pending || !draft.trim()} className="min-h-11 shrink-0 rounded-xl bg-violet-600 px-4 py-2.5 font-semibold text-white hover:bg-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50">
            {t('chatSend')}
          </button>
        </div>
        <div className="mt-1 flex flex-col gap-1 text-xs text-slate-400">
          <span>{t('demoNotice')}</span>
          <span className="self-end tabular-nums">{draft.length} / 500</span>
        </div>
      </form>
    </section>
  )
}
