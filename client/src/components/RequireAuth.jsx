import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { errorText } from '../errorText'

export default function RequireAuth() {
  const { user, status, authError, retry } = useAuth()
  const { t } = useLang()
  const location = useLocation()

  // ── Still checking ────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm animate-pulse">{t('statusLoading')}</p>
      </div>
    )
  }

  // ── Cannot reach server (token exists but network/server failed) ─
  if (authError && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 text-sm text-center max-w-xs">
          {t('errorCannotReachServer')}
        </p>
        <button
          onClick={retry}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          {t('actionRetry')}
        </button>
      </div>
    )
  }

  // ── Not logged in ─────────────────────────────────────────────
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
