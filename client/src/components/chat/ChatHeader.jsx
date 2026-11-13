import { useEffect, useState } from 'react'

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

export default function ChatHeader({ session, t, channelLabel }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (session.channel !== 'call') return undefined
    const timer = window.setInterval(() => setElapsedSeconds(seconds => seconds + 1), 1000)
    return () => window.clearInterval(timer)
  }, [session.channel])

  if (session.channel === 'call') {
    return (
      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-emerald-950/70 px-3 py-2.5" aria-label={`${channelLabel}: ${session.scenarioTitle}`}>
        <span className="chat-call-ring relative grid h-3 w-3 shrink-0 place-items-center rounded-full bg-emerald-400" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-emerald-400/70" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">{t('chatIncomingCall')}</p>
          <h1 className="break-words text-base font-semibold leading-6 text-white">{session.scenarioTitle}</h1>
        </div>
        <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-emerald-200" aria-label={t('chatCallDuration').replace('{time}', formatDuration(elapsedSeconds))}>
          {formatDuration(elapsedSeconds)}
        </span>
      </div>
    )
  }

  if (session.channel === 'telegram') {
    return (
      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-sky-950/80 px-3 py-2.5" aria-label={`${channelLabel}: ${session.scenarioTitle}`}>
        <svg className="h-6 w-6 shrink-0 text-sky-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.7 3.3a1 1 0 0 0-1.05-.17L2.8 10.1a1 1 0 0 0 .1 1.9l4.67 1.48 1.48 4.67a1 1 0 0 0 .86.69h.08a1 1 0 0 0 .87-.5l2.5-4.19 4.44 3.33a1 1 0 0 0 1.56-.6l3-12.5a1 1 0 0 0-.66-1.08ZM9.1 12.9l7.23-5.8-5.93 7.1-.73 1.22-.57-1.8Zm7.64 2.4-3.23-2.43 5.03-6.02-1.8 8.45Z" />
        </svg>
        <div className="min-w-0">
          <h1 className="break-words text-lg font-semibold leading-6 text-white">{session.scenarioTitle}</h1>
          <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-sky-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
            {t('chatOnline')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 rounded-xl bg-slate-900 px-3 py-2.5" aria-label={`${channelLabel}: ${session.scenarioTitle}`}>
      <h1 className="break-words text-lg font-semibold leading-6 text-white">{session.scenarioTitle}</h1>
      <span className="mt-1 inline-flex rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200">{t('scenarioChannelMessage')}</span>
    </div>
  )
}
