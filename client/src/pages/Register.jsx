import { useLang } from '../context/LanguageContext'

export default function Register() {
  const { t } = useLang()
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <h1 className="text-3xl font-bold text-white">{t('headingRegister')}</h1>
      <div className="bg-emerald-900/50 border border-emerald-700 rounded-xl px-8 py-6 text-emerald-300 shadow-lg">
        📋 Register page — placeholder
      </div>
    </div>
  )
}
