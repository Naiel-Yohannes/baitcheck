import React from 'react';
import { useLang } from '../../context/LanguageContext';

/**
 * Simple vertical bar list.
 * Props: items = [{ label, value, percent }]
 */
export default function BarList({ items }) {
  const { t } = useLang();
  if (!items.length) return <p className="text-sm text-slate-400">{t('adminNoScenarioData')}</p>

  return (
    <dl className="space-y-3 text-sm">
      {items.map(item => (
        <div key={item.scenarioId ?? item.label} className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,2fr)_auto] sm:items-center sm:gap-4">
          <dt className="truncate font-medium text-slate-200" title={item.label}>{item.label}</dt>
          <dd className="h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
            <div className="h-full rounded-full bg-indigo-500 transition-[width]" style={{ width: `${item.percent}%` }}></div>
          </dd>
          <dd className="text-xs text-slate-400 sm:min-w-36 sm:text-right">
            {item.value} {t('adminSessionsShort')}
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline">
              {item.averageScore == null
                ? t('adminNoScenarioScore')
                : `${t('adminAverageScore')}: ${item.averageScore} ${t('reportScoreOutOf')}`}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
