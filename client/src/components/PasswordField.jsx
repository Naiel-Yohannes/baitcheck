// client/src/components/PasswordField.jsx
import { useLang } from '../context/LanguageContext'
import { useState, useEffect } from 'react'

import { evaluatePassword, RULES } from '../lib/passwordStrength'
// generatePassword utility is defined inline below

/**
 * Props:
 *   value, onChange, email, name, disabled, error, id
 */
export default function PasswordField({ value, onChange, email, name, disabled, error, id }) {
  const { t } = useLang()
  const [evalResult, setEvalResult] = useState(() => evaluatePassword('', { email, name }))
  const [show, setShow] = useState(false)

  useEffect(() => {
    setEvalResult(evaluatePassword(value, { email, name }))
  }, [value, email, name])

  const toggleShow = () => setShow(s => !s)

  const barColor = {
    empty: 'bg-gray-600',
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

  const getRuleLabel = (ruleId) => {
    const map = {
      [RULES.LENGTH]:            t('passwordRuleLength'),
      [RULES.LOWERCASE]:        t('passwordRuleLowercase'),
      [RULES.UPPERCASE]:        t('passwordRuleUppercase'),
      [RULES.DIGIT]:            t('passwordRuleDigit'),
      [RULES.SYMBOL]:           t('passwordRuleSymbol'),
    }
    return map[ruleId] || ruleId
  }

  return (
    <div className="space-y-2">
      <div className="relative flex items-center">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          disabled={disabled}
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
      {/* Strength bar */}
      <div className="h-2 w-full bg-gray-700 rounded" role="meter" aria-valuenow={evalResult.score} aria-valuemin="0" aria-valuemax="100">
        <div
          className={`h-full ${barColor}`}
          style={barStyle}
        />
      </div>
      {/* Text label */}
      <div aria-live="polite" className="text-sm font-medium text-gray-300">
        {evalResult.level.charAt(0).toUpperCase() + evalResult.level.slice(1)}
      </div>
      {/* Checklist */}
      <ul className="list-none space-y-1 text-xs">
        {Object.entries(evalResult.passed).map(([ruleId, ok]) => (
          <li key={ruleId} className={`flex items-center ${ok ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`mr-1 ${ok ? '✓' : '✗'}`} />
            {getRuleLabel(ruleId)}
          </li>
        ))}
      </ul>
      {/* Problems */}
      {evalResult.problems.includes(RULES.COMMON) && (
        <p className="text-xs text-orange-300">{t('passwordProblemCommon')}</p>
      )}
      {evalResult.problems.includes(RULES.CONTAINS_EMAIL) && (
        <p className="text-xs text-orange-300">{t('passwordProblemContainsEmail')}</p>
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
