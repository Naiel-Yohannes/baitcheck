import { useParams } from 'react-router-dom'

export default function Report() {
  const { sessionId } = useParams()
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
      <h1 className="text-3xl font-bold text-white">Report</h1>
      <div className="bg-amber-900/50 border border-amber-700 rounded-xl px-8 py-6 text-amber-300 shadow-lg">
        📊 Report page — placeholder &nbsp;|&nbsp; Session:{' '}
        <span className="font-mono text-amber-100">{sessionId}</span>
      </div>
    </div>
  )
}
