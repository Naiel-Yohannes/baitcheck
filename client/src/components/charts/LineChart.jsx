import React from 'react'
import { useLang } from '../../context/LanguageContext'

/**
 * Simple line chart for weekly trend.
 * Props: points = [{ weekStart, completed, averageScore }]
 */
export default function LineChart({ points }) {
  const { t } = useLang()
  if (!points || points.length === 0) {
    return <p className="text-slate-300">{t('adminNoTrendData')}</p>
  }
  const width = 300
  const height = 150
  const maxCompleted = Math.max(...points.map(p => p.completed || 0), 1)
  const maxScore = Math.max(...points.map(p => p.averageScore || 0), 1)

  const xStep = width / (points.length - 1 || 1)
  const completedPoints = points.map((p, i) => `${i * xStep},${height - (p.completed / maxCompleted) * height}`).join(' ')
  const scorePoints = points.map((p, i) => `${i * xStep},${height - ((p.averageScore || 0) / maxScore) * height}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xs" role="img" aria-label={t('adminWeeklyTrendChart')}
      >
      <polyline fill="none" stroke="#60a5fa" strokeWidth="2" points={completedPoints} />
      <polyline fill="none" stroke="#fbbf24" strokeWidth="2" points={scorePoints} />
    </svg>
  )
}
