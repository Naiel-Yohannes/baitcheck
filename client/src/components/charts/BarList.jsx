import React from 'react';
import { useLang } from '../../context/LanguageContext';

/**
 * Simple vertical bar list.
 * Props: items = [{ label, value, percent }]
 */
export default function BarList({ items }) {
  const { t } = useLang();
  return (
    <dl className="space-y-2 text-sm">
      {items.map(item => (
        <div key={item.label} className="flex items-center">
          <dt className="w-1/3 flex-shrink-0 truncate mr-2" title={item.label}>{item.label}</dt>
          <dd className="flex-1 mr-2 bg-slate-800 h-4 rounded" aria-hidden="true">
            <div className="h-full bg-indigo-500" style={{ width: `${item.percent}%` }}></div>
          </dd>
          <dd className="w-12 text-right">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
