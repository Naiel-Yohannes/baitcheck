import React from 'react';
import { useLang } from '../../context/LanguageContext';

/**
 * Simple donut chart showing score distribution.
 * Props: data = { vulnerable, partial, resilient, strong } (numbers)
 */
export default function DonutChart({ data }) {
  const { t } = useLang();
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
  const segments = [
    { key: 'vulnerable', value: data.vulnerable, color: 'bg-red-600' },
    { key: 'partial', value: data.partial, color: 'bg-orange-500' },
    { key: 'resilient', value: data.resilient, color: 'bg-emerald-500' },
    { key: 'strong', value: data.strong, color: 'bg-indigo-600' },
  ];
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const arcs = segments.map(seg => {
    const percent = seg.value / total;
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
        className={seg.color}
        strokeLinecap="round"
      />
    );
    offset += percent * circumference;
    return arc;
  });

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" aria-label={t('adminScoreDistributionChart')} role="img" className="w-40 h-40">
        <circle r={radius} cx={50} cy={50} fill="transparent" stroke="transparent" strokeWidth={10} />
        {arcs}
      </svg>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-200">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center">
            <span className={`inline-block w-2 h-2 mr-1 ${seg.color}`} aria-hidden="true" />
            <dt className="capitalize mr-1">{t(`band${seg.key.charAt(0).toUpperCase() + seg.key.slice(1)}`)}</dt>
            <dd>{((seg.value / total) * 100).toFixed(0)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
