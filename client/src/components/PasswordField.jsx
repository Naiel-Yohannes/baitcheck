// client/src/components/PasswordField.jsx
import { useLang } from '../context/LanguageContext'
import { useState } from 'react'

import { evaluatePassword } from '../lib/passwordStrength'
// generatePassword utility is defined inline below

/**
 * Props:
 *   value, onChange, email, name, disabled, error, id
 */
export default function PasswordField({ value, onChange, email, name, disabled, error, id }) {
  const { t } = useLang()
  const evalResult = evaluatePassword(value, { email, name })
  const [show, setShow] = useState(false)

  const toggleShow = () => setShow(s => !s)

  const barColor = {
    weak:  'bg-red-600',
    fair:  'bg-orange-500',
    good:  'bg-yellow-400',
    strong:'bg-green-500',
  }[evalResult.level]

  // Prefer reduced motion handling
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const barStyle = {
    width: `${evalResult.score}%`,
    transition: prefersReduced ? 'none' : 'width 0.4s ease',
  }

  const strengthKey = {
    weak: 'passwordStrengthWeak',
    fair: 'passwordStrengthMedium',
    good: 'passwordStrengthMedium',
    strong: 'passwordStrengthStrong',
  }[evalResult.level]

  return (
    <div className="space-y-2">
      <div className="relative flex items-center">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={t('passwordPlaceholder')}
          aria-invalid={!!error}
          className={`w-full min-h-[44px] rounded-lg bg-gray-800 border px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 ${
            error ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'
          }`}
        />
        <button
          type="button"
          onClick={toggleShow}
          aria-pressed={show}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-sm text-gray-400 hover:text-white"
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
      {value.length > 0 && (
        <>
          <div className="h-2 w-full rounded bg-gray-700" role="meter" aria-valuenow={evalResult.score} aria-valuemin="0" aria-valuemax="100">
            <div className={`h-full rounded ${barColor}`} style={barStyle} />
          </div>
          <div aria-live="polite" className="text-sm font-medium text-gray-300">
            {t(strengthKey)}
          </div>
        </>
      )}
      {/* Generate button */}
      <button
        type="button"
        onClick={() => {
          const gen = generatePassword(16)
          const e = { target: { value: gen } }
          onChange(e)
        }}
        disabled={disabled}
        className="mt-1 min-h-[44px] px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-60"
      >
        Generate strong password
      </button>
    </div>
  )
}

// Simple password generator avoiding look‑alikes
function generatePassword(length) {
  const charset = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%^&*()_+[]{}|;:,.<>?'
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  let pw = ''
  for (let i = 0; i < length; i++) {
    pw += charset[arr[i] % charset.length]
  }
  return pw
}
