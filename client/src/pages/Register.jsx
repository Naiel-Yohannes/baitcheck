import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LanguageContext'
import { errorText } from '../errorText'

const TYPES = ['individual', 'create', 'join']

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

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

function InputField({ id, label, type = 'text', autoComplete, value, onChange, disabled, error, ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={!!error}
        className={`w-full min-h-[44px] rounded-lg bg-gray-800 border px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 ${
          error ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'
        }`}
        {...rest}
      />
      <FieldError msg={error} />
    </div>
  )
}

function SuccessPanel({ joinCode, t, onContinue }) {
  const [copyLabel, setCopyLabel] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopyLabel('copied')
      timerRef.current = setTimeout(() => setCopyLabel(null), 2000)
    } catch {
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 text-center py-4">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {t('registerSuccessHeading')}
        </h2>
        <p className="text-sm text-gray-400 max-w-xs">
          {t('registerSuccessBody')}
        </p>
      </div>

      {joinCode ? (
        <>
          <div className="bg-gray-800 border border-indigo-700 rounded-2xl px-8 py-6">
            <p
              className="font-mono text-5xl font-bold tracking-[0.25em] text-indigo-300 select-all"
              aria-label={`Join code: ${joinCode}`}
            >
              {joinCode}
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="min-h-[44px] px-6 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
          >
            {copyLabel === 'copied' ? t('registerCopied') : t('registerCopyCode')}
          </button>
        </>
      ) : (
        <p className="max-w-sm text-sm leading-relaxed text-amber-200">{t('registerJoinCodeMissing')}</p>
      )}

      <button
        onClick={onContinue}
        className="min-h-[44px] px-6 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
      >
        {t('registerContinue')}
      </button>
    </div>
  )
}

export default function Register() {
  const { user, register } = useAuth()
  const { t } = useLang()
  const navigate = useNavigate()
  const creatingOrgRef = useRef(false)

  const [accountType, setAccountType] = useState('individual')

  const [formValues, setFormValues] = useState({
    individual: { name: '', email: '', password: '', orgName: '', joinCode: '' },
    create: { name: '', email: '', password: '', orgName: '', joinCode: '' },
    join: { name: '', email: '', password: '', orgName: '', joinCode: '' },
  })
  const { name, email, password, orgName, joinCode } = formValues[accountType]

  function setField(field, value) {
    setFormValues(current => ({
      ...current,
      [accountType]: { ...current[accountType], [field]: value },
    }))
  }

  const [errors,  setErrors]  = useState({})
  const [formErr, setFormErr] = useState('')

  const [pending,   setPending]   = useState(false)
  const [successCode, setSuccessCode] = useState(null)

  function switchType(type) {
    setAccountType(type)
    setErrors({})
    setFormErr('')
  }

  if (user && successCode === null && !creatingOrgRef.current) return <Navigate to="/scenarios" replace />

  function validate() {
    const errs = {}

    if (name.trim().length < 2)  errs.name     = t('validNameRequired')
    if (name.trim().length > 60) errs.name     = t('validNameTooLong')
    if (!isValidEmail(email))    errs.email    = t('validEmailRequired')
    if (password.length < 8)     errs.password = t('validPasswordRequired')
    if (password.length > 72)    errs.password = t('validPasswordTooLong')

    if (accountType === 'create') {
      if (orgName.trim().length < 2)  errs.orgName = t('validOrgNameRequired')
      if (orgName.trim().length > 60) errs.orgName = t('validOrgNameTooLong')
    }

    if (accountType === 'join') {
      if (joinCode.trim().length !== 6) errs.joinCode = t('validJoinCodeRequired')
    }

    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormErr('')

    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})

    const body = {
      name:     name.trim(),
      email:    email.trim(),
      password,
    }
    if (accountType === 'create') body.orgName  = orgName.trim()
    if (accountType === 'join')   body.joinCode = joinCode.trim().toUpperCase()

    setPending(true)
    try {
      creatingOrgRef.current = accountType === 'create'
      const res = await register(body)

      if (creatingOrgRef.current) {
        setSuccessCode(res.joinCode ?? '')
      } else {
        navigate('/scenarios', { replace: true })
      }
    } catch (err) {
      creatingOrgRef.current = false
      if (err.code === 'INVALID_JOIN_CODE') {
        setErrors({ joinCode: t('error_INVALID_JOIN_CODE') })
      } else if (err.code === 'EMAIL_TAKEN') {
        setErrors({ email: t('error_EMAIL_TAKEN') })
      } else if (err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
        const fieldErrs = {}
        for (const { field, issue } of err.details) {
          const key = field === 'orgName'  ? 'orgName'
                    : field === 'joinCode' ? 'joinCode'
                    : field === 'name'     ? 'name'
                    : field === 'email'    ? 'email'
                    : field === 'password' ? 'password'
                    : null
          if (key) {
            fieldErrs[key] = issue ?? t('validFieldInvalid')
          }
        }
        if (Object.keys(fieldErrs).length) {
          setErrors(fieldErrs)
        } else {
          setFormErr(t('error_VALIDATION_ERROR'))
        }
      } else {
        setFormErr(errorText(err, t))
      }
    } finally {
      setPending(false)
    }
  }

  if (successCode !== null) {
    return (
    <div className="flex items-start justify-center min-h-[80vh] px-2 pt-5 pb-6 sm:px-4 sm:pt-12 sm:pb-8">
        <div className="w-full max-w-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-6 shadow-xl sm:px-6 sm:py-8">
            <SuccessPanel
              joinCode={successCode}
              t={t}
              onContinue={() => navigate('/scenarios', { replace: true })}
            />
          </div>
        </div>
      </div>
    )
  }

  const typeOptions = [
    { value: 'individual', labelKey: 'registerTypeIndividual' },
    { value: 'create',     labelKey: 'registerTypeCreate'     },
    { value: 'join',       labelKey: 'registerTypeJoin'       },
  ]

  return (
    <div className="flex items-start justify-center min-h-[80vh] px-2 pt-5 pb-6 sm:px-4 sm:pt-12 sm:pb-8">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-6 shadow-xl sm:px-6 sm:py-8">
          <h1 className="text-2xl font-bold text-white mb-6">
            {t('headingRegister')}
          </h1>

          <div
            className="flex rounded-lg bg-gray-800 p-1 mb-5 gap-1 sm:mb-6"
            role="group"
            aria-label="Account type"
          >
            {typeOptions.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => switchType(value)}
                disabled={pending}
                aria-pressed={accountType === value}
                className={`min-h-11 flex-1 rounded-md px-1.5 py-2 text-[11px] font-semibold transition-colors leading-tight text-center sm:px-2 sm:text-xs ${
                  accountType === value
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          <FormError msg={formErr} />

          <form onSubmit={handleSubmit} noValidate className="mt-4 flex flex-col gap-5">
            <InputField
              id="reg-name"
              label={t('fieldName')}
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => { setField('name', e.target.value); setErrors(v => ({ ...v, name: '' })) }}
              disabled={pending}
              error={errors.name}
            />

            <InputField
              id="reg-email"
              label={t('fieldEmail')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => { setField('email', e.target.value); setErrors(v => ({ ...v, email: '' })) }}
              disabled={pending}
              error={errors.email}
              placeholder="you@example.com"
            />

            <InputField
              id="reg-password"
              label={t('fieldPassword')}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => { setField('password', e.target.value); setErrors(v => ({ ...v, password: '' })) }}
              disabled={pending}
              error={errors.password}
            />

            {accountType === 'create' && (
              <InputField
                id="reg-orgname"
                label={t('fieldOrgName')}
                type="text"
                autoComplete="organization"
                value={orgName}
                onChange={e => { setField('orgName', e.target.value); setErrors(v => ({ ...v, orgName: '' })) }}
                disabled={pending}
                error={errors.orgName}
              />
            )}

            {accountType === 'join' && (
              <div>
                <label
                  htmlFor="reg-joincode"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  {t('fieldJoinCode')}
                </label>
                <input
                  id="reg-joincode"
                  type="text"
                  autoComplete="off"
                  inputMode="text"
                  maxLength={6}
                  value={joinCode}
                  onChange={e => {
                    setField('joinCode', e.target.value.toUpperCase())
                    setErrors(v => ({ ...v, joinCode: '' }))
                  }}
                  disabled={pending}
                  aria-invalid={!!errors.joinCode}
                  className={`w-full min-h-[44px] rounded-lg bg-gray-800 border px-3 py-2.5 text-sm font-mono uppercase tracking-widest text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 ${
                    errors.joinCode ? 'border-red-500' : 'border-gray-700 hover:border-gray-600'
                  }`}
                  placeholder="ABC123"
                />
                <FieldError msg={errors.joinCode} />
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full min-h-[44px] rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
            >
              {pending ? t('statusPleaseWait') : t('registerSubmit')}
            </button>
          </form>

          <p className="mt-6 text-xs text-gray-500 text-center leading-relaxed">
            {t('demoNotice')}
          </p>

          <p className="mt-4 text-center text-sm text-gray-500">
            {t('registerHaveAccount')}{' '}
            <Link
              to="/login"
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              {t('registerLoginLink')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
