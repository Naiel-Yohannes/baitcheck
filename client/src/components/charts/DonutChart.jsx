import React from 'react';
import { useLang } from '../../context/LanguageContext';

/**
 * Simple donut chart showing score distribution.
 * Props: data = { vulnerable, partial, resilient, strong } (numbers)
 */
export default function DonutChart({ data }) {
  const { t } = useLang();
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const segments = [
    { key: 'vulnerable', value: data.vulnerable, color: 'bg-red-500', stroke: 'stroke-red-500' },
    { key: 'partial', value: data.partial, color: 'bg-orange-400', stroke: 'stroke-orange-400' },
    { key: 'resilient', value: data.resilient, color: 'bg-emerald-400', stroke: 'stroke-emerald-400' },
    { key: 'strong', value: data.strong, color: 'bg-indigo-400', stroke: 'stroke-indigo-400' },
  ];
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = segments.map(seg => {
    const percent = total === 0 ? 0 : seg.value / total;
    const dash = `${percent * circumference} ${circumference}`;
    const arc = (
      <circle
        key={seg.key}
        r={radius}
        cx={50}
        cy={50}
        fill="transparent"
        strokeWidth={10}
        strokeDasharray={dash}
        strokeDashoffset={-offset}
        className={seg.stroke}
        strokeLinecap="butt"
      />
    );
    offset += percent * circumference;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 100 100" aria-label={t('adminScoreDistributionChart')} role="img" className="h-40 w-40 shrink-0">
        <circle r={radius} cx={50} cy={50} fill="none" stroke="#334155" strokeWidth={10} />
        <g transform="rotate(-90 50 50)">{arcs}</g>
        <text x="50" y="48" textAnchor="middle" className="fill-white text-[16px] font-bold">{total}</text>
        <text x="50" y="59" textAnchor="middle" className="fill-slate-400 text-[5px]">{t('adminCompletedSessions')}</text>
      </svg>
      <dl className="grid w-full grid-cols-1 gap-2 text-sm text-gray-200 sm:grid-cols-2">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/60 px-3 py-2">
            <div className="flex min-w-0 items-center">
            <span className={`inline-block w-2 h-2 mr-1 ${seg.color}`} aria-hidden="true" />
              <dt className="truncate">{t(`band${seg.key.charAt(0).toUpperCase() + seg.key.slice(1)}`)}</dt>
            </div>
            <dd className="shrink-0 text-slate-300">{seg.value} · {total === 0 ? 0 : ((seg.value / total) * 100).toFixed(0)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
