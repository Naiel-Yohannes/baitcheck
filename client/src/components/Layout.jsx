import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'

export default function Layout() {
  const { lang, setLang, t } = useLang()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const isOrgAdmin = user?.role === 'orgAdmin'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* ── Top nav ──────────────────────────────────────────────── */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

          {/* Brand */}
          <span className="text-indigo-400 font-bold text-lg tracking-tight shrink-0">
            {t('appName')}
          </span>

          {/* Spacer */}
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

          {/* Page links — wrap onto second row on narrow screens */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 w-full sm:w-auto">
            {user ? (
              /* ── Logged-in nav ────────────────────────────────── */
              <>
                <NavLink
                  to="/scenarios"
                  className={({ isActive }) =>
                    `text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
                    }`
                  }
                >
                  {t('navScenarios')}
                </NavLink>

                <NavLink
                  to="/history"
                  className={({ isActive }) =>
                    `text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
                    }`
                  }
                >
                  {t('navHistory')}
                </NavLink>

                {isOrgAdmin && (
                  <NavLink
                    to="/admin"
                    className={({ isActive }) =>
                      `text-sm font-medium whitespace-nowrap transition-colors ${
                        isActive ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
                      }`
                    }
                  >
                    {t('navAdmin')}
                  </NavLink>
                )}

                {/* User name */}
                <span className="text-sm text-gray-500 whitespace-nowrap hidden sm:inline">
                  {user.name}
                </span>

                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium whitespace-nowrap text-gray-400 hover:text-white transition-colors"
                >
                  {t('navLogout')}
                </button>
              </>
            ) : (
              /* ── Logged-out nav ───────────────────────────────── */
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
                    }`
                  }
                >
                  {t('navLogin')}
                </NavLink>

                <NavLink
                  to="/register"
                  className={({ isActive }) =>
                    `text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive ? 'text-indigo-400' : 'text-gray-400 hover:text-white'
                    }`
                  }
                >
                  {t('navRegister')}
                </NavLink>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
