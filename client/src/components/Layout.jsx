import { NavLink, Outlet } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'

export default function Layout() {
  const { lang, setLang, t } = useLang()

  const navLinks = [
    { to: '/scenarios', labelKey: 'navScenarios' },
    { to: '/history',   labelKey: 'navHistory'   },
    { to: '/admin',     labelKey: 'navAdmin'      },
    { to: '/login',     labelKey: 'navLogin'      },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Top nav ──────────────────────────────────────────── */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        {/*
          Two-row layout on very small screens, single row on sm+.
          Row 1: brand + lang toggle
          Row 2 (wraps on mobile): page links
        */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Brand */}
          <span className="text-indigo-400 font-bold text-lg tracking-tight shrink-0">
            {t('appName')}
          </span>

          {/* Spacer — pushes lang toggle to the right on the brand row */}
          <span className="flex-1" />

          {/* Language toggle */}
          <div
            className="flex items-center gap-1 rounded-lg bg-gray-800 p-1 shrink-0"
            role="group"
            aria-label="Language selector"
          >
            <button
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              className={`rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                lang === 'en'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('am')}
              aria-pressed={lang === 'am'}
              className={`rounded-md px-2.5 py-0.5 text-xs font-semibold transition-colors lang-am ${
                lang === 'am'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              አማርኛ
            </button>
          </div>

          {/* Page links — wrap onto next line on narrow screens */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 w-full sm:w-auto">
            {navLinks.map(({ to, labelKey }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-indigo-400'
                      : 'text-gray-400 hover:text-white'
                  }`
                }
              >
                {t(labelKey)}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Page content ─────────────────────────────────────── */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
