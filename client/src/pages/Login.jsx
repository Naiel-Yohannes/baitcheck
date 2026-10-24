import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { errorText } from '../errorText'

// ── Helpers ───────────────────────────────────────────────────────
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

// ── Shared primitives ─────────────────────────────────────────────
function FieldError({ msg }) {
  if (!msg) return null
  return (
    <p role="alert" className="mt-1 text-sm text-red-400">
      {msg}
    </p>
  )
}

function FormError({ msg }) {
  if (!msg) return null
  return (
    <div
      role="alert"
      className="rounded-lg bg-red-950/60 border border-red-700 px-4 py-3 text-sm text-red-300"
    >
      {msg}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
export default function Login() {
  const { user, login } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const location = useLocation()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [errors,   setErrors]   = useState({}) // { email?, password? }
  const [formErr,  setFormErr]  = useState('')  // banner above form
  const [pending,  setPending]  = useState(false)

  // Already logged-in guard
  if (user) return <Navigate to="/scenarios" replace />

  // ── Client-side validation ──────────────────────────────────────
  function validate() {
    const errs = {}
    if (!isValidEmail(email)) errs.email = t('validEmailRequired')
    if (!password)            errs.password = t('validPasswordEmpty')
    return errs
  }

  // ── Submit ──────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setFormErr('')

    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})

    setPending(true)
    try {
      await login({ email: email.trim(), password })
      const dest = location.state?.from?.pathname ?? '/scenarios'
      navigate(dest, { replace: true })
    } catch (err) {
      setFormErr(errorText(err, t))
    } finally {
      setPending(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex items-start justify-center min-h-[80vh] px-4 pt-12 pb-8">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-6 py-8 shadow-xl">
          <h1 className="text-2xl font-bold text-white mb-6">
            {t('headingLogin')}
          </h1>

          <FormError msg={formErr} />

          <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-5">
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                {t('fieldEmail')}
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(v => ({ ...v, email: '' })) }}
                disabled={pending}
                className={`w-full min-h-[44px] rounded-lg bg-gray-800 border px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 ${
                  errors.email ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'
                }`}
                placeholder="you@example.com"
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                aria-invalid={!!errors.email}
              />
              <FieldError msg={errors.email} />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                {t('fieldPassword')}
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: '' })) }}
                disabled={pending}
                className={`w-full min-h-[44px] rounded-lg bg-gray-800 border px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 ${
                  errors.password ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'
                }`}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                aria-invalid={!!errors.password}
              />
              <FieldError msg={errors.password} />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={pending}
              className="w-full min-h-[44px] rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
            >
              {pending ? t('statusPleaseWait') : t('loginSubmit')}
            </button>
          </form>

          {/* Link to register */}
          <p className="mt-5 text-center text-sm text-gray-500">
            {t('loginNoAccount')}{' '}
            <Link
              to="/register"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              {t('loginRegisterLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
