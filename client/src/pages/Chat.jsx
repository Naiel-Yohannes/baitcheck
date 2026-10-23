import { useParams } from 'react-router-dom'
import { useLang } from '../context/LanguageContext'

export default function Chat() {
  const { sessionId } = useParams()
  const { t } = useLang()
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <h1 className="text-3xl font-bold text-white">{t('headingChat')}</h1>
      <div className="bg-sky-900/50 border border-sky-700 rounded-xl px-8 py-6 text-sky-300 shadow-lg">
        💬 Chat page — placeholder &nbsp;|&nbsp; Session:{' '}
        <span className="font-mono text-sky-100">{sessionId}</span>
      </div>
    </div>
  )
}
