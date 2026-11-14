import React from 'react'
import { useLang } from '../../context/LanguageContext'

/**
 * Simple line chart for weekly trend.
 * Props: points = [{ weekStart, completed, averageScore }]
 */
export default function LineChart({ points }) {
  const { t } = useLang()
  if (!points || points.length === 0 || !points.some(point => point.completed > 0)) {
    return <p className="text-slate-300">{t('adminNoTrendData')}</p>
  }
  const width = 640
  const height = 240
  const left = 42
  const right = 12
  const top = 14
  const bottom = 194
  const plotHeight = bottom - top
  const xStep = (width - left - right) / (points.length - 1 || 1)
  const maxCompleted = Math.max(...points.map(point => point.completed || 0), 1)
  const coordinates = points.map((point, index) => ({
    x: left + index * xStep,
    y: bottom - ((point.averageScore ?? 0) / 100) * plotHeight,
    score: point.averageScore,
  }))
  const scoreLines = []
  let currentLine = []
  for (const point of coordinates) {
    if (point.score == null) {
      if (currentLine.length) scoreLines.push(currentLine)
      currentLine = []
    } else {
      currentLine.push(point)
    }
  }
  if (currentLine.length) scoreLines.push(currentLine)

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
          {t('adminWeeklyAverageScore')}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm bg-blue-400" aria-hidden="true" />
          {t('adminWeeklySessions')}
        </span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[34rem] max-w-4xl" role="img" aria-label={t('adminWeeklyTrendChart')}>
          {[0, 50, 100].map(score => {
            const y = bottom - (score / 100) * plotHeight
            return (
              <g key={score}>
                <line x1={left} y1={y} x2={width - right} y2={y} stroke="#334155" strokeWidth="1" />
                <text x={left - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{score}</text>
              </g>
            )
          })}
          {points.map((point, index) => {
            const x = left + index * xStep
            const barHeight = (point.completed / maxCompleted) * 44
            return (
              <g key={point.weekStart}>
                {point.completed > 0 && (
                  <>
                    <rect x={x - 9} y={bottom - barHeight} width="18" height={barHeight} rx="3" fill="#60a5fa" opacity="0.8" />
                    <text x={x} y={bottom - barHeight - 5} textAnchor="middle" fill="#bfdbfe" fontSize="10">{point.completed}</text>
                  </>
                )}
                <text x={x} y={height - 10} textAnchor="middle" fill="#94a3b8" fontSize="10">{point.weekStart.slice(5)}</text>
              </g>
            )
          })}
          {scoreLines.map((line, index) => (
            <g key={index}>
              {line.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={line.map(point => `${point.x},${point.y}`).join(' ')}
                />
              )}
              {line.map(point => (
                <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="4" fill="#fbbf24" stroke="#0f172a" strokeWidth="2" />
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
