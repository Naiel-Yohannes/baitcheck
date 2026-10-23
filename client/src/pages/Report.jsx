/**
 * src/pages/Report.jsx
 *
 * Loads a finished session's report from the server.
 * Never reads from router state — always fetches so a refresh works.
 * Never calls finishSession; never derives or modifies any value.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { getSession } from '../api'
import { useLang } from '../context/LanguageContext'
import { errorText } from '../errorText'

// ── Tiny shared primitives ────────────────────────────────────────

/** Button styled as a pill link (min 44px tall). */
function PillLink({ to, children, variant = 'primary' }) {
  const base = 'inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg text-sm font-semibold transition-colors'
  const cls = variant === 'primary'
    ? `${base} bg-indigo-600 hover:bg-indigo-500 text-white`
    : `${base} bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700`
  return <Link to={to} className={cls}>{children}</Link>
}

/** Action button (min 44px tall). */
function ActionButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
    >
      {children}
    </button>
  )
}

/** Section wrapper card. */
function Card({ children, className = '' }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  )
}

/** Section heading. */
function SectionHeading({ children }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">
      {children}
    </h2>
  )
}

// ── Band config ───────────────────────────────────────────────────
const BAND_CONFIG = {
  vulnerable: { bar: 'bg-red-500',    text: 'text-red-400',    labelKey: 'bandVulnerable' },
  partial:    { bar: 'bg-amber-500',  text: 'text-amber-400',  labelKey: 'bandPartial'    },
  resilient:  { bar: 'bg-emerald-500',text: 'text-emerald-400',labelKey: 'bandResilient'  },
  strong:     { bar: 'bg-indigo-500', text: 'text-indigo-400', labelKey: 'bandStrong'     },
}

// ── Checkpoint status config ──────────────────────────────────────
const CP_CONFIG = {
  passed:   { symbol: '✓', badgeCls: 'bg-emerald-900/60 text-emerald-300 border border-emerald-700', labelKey: 'checkpointPassed'   },
  failed:   { symbol: '✗', badgeCls: 'bg-red-900/60    text-red-300    border border-red-700',    labelKey: 'checkpointFailed'   },
  na:       { symbol: '–', badgeCls: 'bg-gray-800      text-gray-400   border border-gray-700',   labelKey: 'checkpointNa'       },
  unjudged: { symbol: '?', badgeCls: 'bg-gray-800      text-gray-500   border border-gray-600',   labelKey: 'checkpointUnjudged' },
}

// ── Header card ───────────────────────────────────────────────────
function HeaderCard({ report, t }) {
  const lang       = report?.language
  const score      = report?.score ?? 0
  const band       = report?.band ?? ''
  const bandCfg    = BAND_CONFIG[band]
  const endReason  = report?.endReason ?? ''
  const endKey     = `reportEndReason_${endReason}`
  const langLabel  = lang === 'am' ? t('reportLanguageAmharic') : t('reportLanguageEnglish')

  return (
    <Card>
      {/* Scenario title + language */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <h1
          className="text-xl font-bold text-white leading-snug"
          lang={lang}
        >
          {report?.scenarioTitle ?? ''}
        </h1>
        <span className="text-xs text-gray-500 bg-gray-800 rounded px-2 py-1 shrink-0">
          {langLabel}
        </span>
      </div>

      {/* Score */}
      <div className="flex items-end gap-2 mb-3">
        <span className="text-6xl font-extrabold text-white leading-none tabular-nums">
          {score}
        </span>
        <span className="text-lg text-gray-500 pb-1">{t('reportScoreOutOf')}</span>
      </div>

      {/* Score bar — decorative, width = exact score% */}
      <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden mb-3">
        <div
          role="presentation"
          className={`h-full rounded-full transition-all ${bandCfg ? bandCfg.bar : 'bg-gray-600'}`}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Band label */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${bandCfg ? bandCfg.text : 'text-gray-400'}`}>
          {bandCfg ? t(bandCfg.labelKey) : band}
        </span>
        {endReason && (
          <span className="text-xs text-gray-500">
            {/* t() returns the key itself if unknown — that's the safe fallback */}
            {strings_en_has(endKey) ? t(endKey) : endReason}
          </span>
        )}
      </div>
    </Card>
  )
}

// Helper: does the en string table have this key?
// Avoids importing strings directly into a component — evaluated at render time via closure.
// We pass it through a module-level function instead of importing strings here.
import { strings } from '../i18n'
function strings_en_has(key) { return key in strings.en }

// ── Degraded notice ───────────────────────────────────────────────
function DegradedNotice({ t }) {
  return (
    <div className="flex items-start gap-3 bg-amber-950/50 border border-amber-700 rounded-xl px-4 py-3 text-amber-300 text-sm">
      <span className="text-lg leading-none mt-0.5" aria-hidden>⚠</span>
      <p>{t('reportDegradedNotice')}</p>
    </div>
  )
}

// ── Checkpoints section ───────────────────────────────────────────
function CheckpointsSection({ checkpoints, report, t }) {
  const lang = report?.language
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) return null

  return (
    <Card>
      <SectionHeading>{t('reportCheckpoints')}</SectionHeading>
      <ul className="flex flex-col gap-4">
        {checkpoints.map((cp, i) => {
          const cfg    = CP_CONFIG[cp.status] ?? CP_CONFIG.unjudged
          const hasEvidence = cp.evidence && typeof cp.evidence === 'string' && cp.evidence.trim() !== ''
          const noteKey = cp.status === 'na' ? 'checkpointNaNote'
                        : cp.status === 'unjudged' ? 'checkpointUnjudgedNote'
                        : null

          return (
            <li key={cp.id ?? i} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                {/* Status badge: symbol + text — never color alone */}
                <span
                  className={`inline-flex items-center gap-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${cfg.badgeCls}`}
                  aria-label={t(cfg.labelKey)}
                >
                  <span aria-hidden>{cfg.symbol}</span>
                  {t(cfg.labelKey)}
                </span>
                {/* Description from server — plain text, session language */}
                <p className="text-sm text-gray-200 leading-snug" lang={lang}>
                  {cp.description ?? ''}
                </p>
              </div>

              {/* na / unjudged contextual note */}
              {noteKey && (
                <p className="text-xs text-gray-500 ml-1">
                  {t(noteKey)}
                </p>
              )}

              {/* Evidence quote */}
              {hasEvidence && (
                <div className="ml-1 pl-3 border-l-2 border-gray-700">
                  <p className="text-xs text-gray-500 mb-0.5">{t('checkpointYourMessage')}</p>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap" lang={lang}>
                    {cp.evidence}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// ── Timeline section ──────────────────────────────────────────────
function TimelineSection({ timeline, report, t }) {
  const lang = report?.language
  if (!Array.isArray(timeline) || timeline.length === 0) return null

  return (
    <Card>
      <SectionHeading>{t('reportTimeline')}</SectionHeading>
      <ol className="flex flex-col gap-5">
        {timeline.map((item, i) => {
          const turnLabel = item.startedAtTurn === 0
            ? t('reportOpeningMessage')
            : t('reportFromTurn').replace('{n}', item.startedAtTurn)

          return (
            <li key={item.stageId ?? i} className="flex gap-3">
              {/* Vertical connector dot */}
              <div className="flex flex-col items-center shrink-0 pt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                {i < timeline.length - 1 && (
                  <div className="w-px flex-1 bg-gray-700 mt-1" />
                )}
              </div>

              <div className="pb-2 min-w-0">
                {/* Turn label */}
                <span className="text-xs text-indigo-400 font-medium">{turnLabel}</span>
                {/* Technique name */}
                <p className="text-sm font-semibold text-white mt-0.5" lang={lang}>
                  {item.technique ?? ''}
                </p>
                {/* Explanation */}
                {item.explanation && (
                  <p className="text-sm text-gray-400 mt-1 leading-snug" lang={lang}>
                    {item.explanation}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

// ── Feedback section ──────────────────────────────────────────────
function FeedbackSection({ feedback, report, t }) {
  const lang = report?.language
  if (!feedback) return null

  const { summary, didWell = [], improve = [], nextTime = [] } = feedback

  const lists = [
    { key: 'feedbackDidWell',  items: didWell  },
    { key: 'feedbackImprove',  items: improve  },
    { key: 'feedbackNextTime', items: nextTime },
  ].filter(l => Array.isArray(l.items) && l.items.length > 0)

  if (!summary && lists.length === 0) return null

  return (
    <Card>
      <SectionHeading>{t('reportFeedback')}</SectionHeading>

      {/* Summary paragraph */}
      {summary && (
        <p
          className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-4"
          lang={lang}
        >
          {summary}
        </p>
      )}

      {/* Subsection lists */}
      <div className="flex flex-col gap-5">
        {lists.map(({ key, items }) => (
          <div key={key}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              {t(key)}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-300"
                  lang={lang}
                >
                  <span className="text-gray-600 mt-0.5 shrink-0" aria-hidden>•</span>
                  <span className="whitespace-pre-wrap">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Loading / error UI helpers ────────────────────────────────────
function CenteredBox({ children }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      {children}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
// Main page component
// ═════════════════════════════════════════════════════════════════
export default function Report() {
  const { sessionId } = useParams()
  const { t } = useLang()

  const [state, setState] = useState('loading') // 'loading'|'redirect'|'report'|'no_report'|'not_found'|'error'
  const [report,  setReport]  = useState(null)
  const [session, setSession] = useState(null)
  const [apiErr,  setApiErr]  = useState(null)

  // Ref to cancel stale fetches when sessionId changes or on unmount
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    setState('loading')
    setReport(null)
    setApiErr(null)

    async function load() {
      try {
        const res = await getSession(sessionId)
        if (cancelRef.current) return

        const sess = res?.session
        if (!sess) {
          setState('error')
          setApiErr({ code: 'SERVER_ERROR' })
          return
        }

        if (sess.status === 'active') {
          setState('redirect')
          return
        }

        // status === 'finished'
        setSession(sess)
        if (!sess.report) {
          setState('no_report')
        } else {
          setReport(sess.report)
          setState('report')
        }
      } catch (err) {
        if (cancelRef.current) return
        if (err.code === 'NOT_FOUND') {
          setState('not_found')
        } else {
          setState('error')
          setApiErr(err)
        }
      }
    }

    load()

    return () => { cancelRef.current = true }
  }, [sessionId])

  // ── Redirect active session to Chat ──────────────────────────
  if (state === 'redirect') {
    return <Navigate to={`/chat/${sessionId}`} replace />
  }

  // ── Loading ───────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <CenteredBox>
        <p className="text-gray-400 text-sm animate-pulse">{t('reportLoading')}</p>
      </CenteredBox>
    )
  }

  // ── Not found ─────────────────────────────────────────────────
  if (state === 'not_found') {
    return (
      <CenteredBox>
        <p className="text-gray-400 text-sm text-center">{t('reportNotFound')}</p>
        <PillLink to="/scenarios">{t('reportGoToScenarios')}</PillLink>
      </CenteredBox>
    )
  }

  // ── Report is null despite session being finished ─────────────
  if (state === 'no_report') {
    return (
      <CenteredBox>
        <p className="text-gray-400 text-sm text-center max-w-xs">{t('reportNotAvailable')}</p>
        <ActionButton onClick={() => {
          setState('loading')
          setApiErr(null)
          // Re-trigger the effect by flipping a key — simplest is to
          // just call load directly (extracted to a module-level fn below),
          // but since we need the effect, we remount via a key on the parent.
          // Here, we directly re-run the logic:
          cancelRef.current = false
          getSession(sessionId).then(res => {
            if (cancelRef.current) return
            const sess = res?.session
            if (!sess) { setState('error'); setApiErr({ code: 'SERVER_ERROR' }); return }
            if (sess.status === 'active') { setState('redirect'); return }
            setSession(sess)
            if (!sess.report) { setState('no_report') }
            else { setReport(sess.report); setState('report') }
          }).catch(err => {
            if (cancelRef.current) return
            if (err.code === 'NOT_FOUND') setState('not_found')
            else { setState('error'); setApiErr(err) }
          })
        }}>
          {t('actionRetry')}
        </ActionButton>
      </CenteredBox>
    )
  }

  // ── Generic API error ─────────────────────────────────────────
  if (state === 'error') {
    return (
      <CenteredBox>
        <p className="text-red-400 text-sm text-center max-w-xs">
          {errorText(apiErr, t)}
        </p>
        <ActionButton onClick={() => {
          cancelRef.current = false
          setState('loading')
          setApiErr(null)
          getSession(sessionId).then(res => {
            if (cancelRef.current) return
            const sess = res?.session
            if (!sess) { setState('error'); setApiErr({ code: 'SERVER_ERROR' }); return }
            if (sess.status === 'active') { setState('redirect'); return }
            setSession(sess)
            if (!sess.report) setState('no_report')
            else { setReport(sess.report); setState('report') }
          }).catch(err => {
            if (cancelRef.current) return
            if (err.code === 'NOT_FOUND') setState('not_found')
            else { setState('error'); setApiErr(err) }
          })
        }}>
          {t('actionRetry')}
        </ActionButton>
      </CenteredBox>
    )
  }

  // ── Report ─────────────────────────────────────────────────────
  const checkpoints = Array.isArray(report?.checkpoints) ? report.checkpoints : []
  const timeline    = Array.isArray(report?.timeline)    ? report.timeline    : []

  return (
    <div className="flex justify-center px-4 py-6">
      <div className="w-full max-w-3xl flex flex-col gap-5">

        {/* 1. Header card */}
        <HeaderCard report={report} t={t} />

        {/* 2. Degraded notice */}
        {report?.degraded && <DegradedNotice t={t} />}

        {/* 3. Checkpoints */}
        <CheckpointsSection checkpoints={checkpoints} report={report} t={t} />

        {/* 4. Technique timeline */}
        <TimelineSection timeline={timeline} report={report} t={t} />

        {/* 5. Feedback */}
        <FeedbackSection feedback={report?.feedback} report={report} t={t} />

        {/* 6. Footer links */}
        <div className="flex flex-wrap gap-3 pt-2">
          <PillLink to="/scenarios" variant="primary">
            {t('reportTryAnother')}
          </PillLink>
          <PillLink to="/history" variant="secondary">
            {t('reportMyHistory')}
          </PillLink>
        </div>

      </div>
    </div>
  )
}
