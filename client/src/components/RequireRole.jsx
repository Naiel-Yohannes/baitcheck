import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'

/**
 * RequireRole — renders children only when user.role is in `roles`.
 * Must be nested inside RequireAuth (so user is guaranteed non-null).
 * @param {{ roles: string[] }} props
 */
export default function RequireRole({ roles }) {
  const { user } = useAuth()
  const { t } = useLang()

  if (!user || !roles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-400 text-sm text-center max-w-xs">
          {t('errorNoPermission')}
        </p>
      </div>
    )
  }

  return <Outlet />
}
