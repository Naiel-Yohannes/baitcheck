import React, { useEffect, useState } from 'react';
import { getMySessions, getScenarios } from '../api';
import { useLang } from '../context/LanguageContext';

export default function Dashboard() {
  const { t, lang } = useLang();
  const [sessions, setSessions] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sessRes, scenRes] = await Promise.all([getMySessions(), getScenarios()]);
        if (!cancelled) {
          setSessions(sessRes?.sessions || []);
          setScenarios(scenRes?.scenarios || []);
        }
      } catch (err) {
        // handle error silently for now
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <p className="py-12 text-center text-slate-300" role="status">{t('statusLoading')}</p>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-2 py-4 sm:px-0 sm:py-6">
      <h1 className="mb-6 text-3xl font-bold tracking-tight text-white">{t('appName')} Dashboard</h1>
      {/* Placeholder content */}
      <p className="text-slate-300">{t('dashboardPlaceholder') || 'Dashboard content goes here.'}</p>
    </main>
  );
}
