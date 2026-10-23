import { useLang } from '../context/LanguageContext'

export default function Scenarios() {
  const { t } = useLang()
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <h1 className="text-3xl font-bold text-white">{t('headingScenarios')}</h1>
      <div className="bg-violet-900/50 border border-violet-700 rounded-xl px-8 py-6 text-violet-300 shadow-lg">
        🎭 Scenarios page — placeholder
      </div>
    </div>
  )
}
