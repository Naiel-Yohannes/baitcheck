import { useState } from 'react'

export default function MessageBubble({ message, isUser, channel, t, language }) {
  const [clientReceivedAt] = useState(() => new Date())
  const receivedAt = message.createdAt ? new Date(message.createdAt) : clientReceivedAt
  const time = new Intl.DateTimeFormat(language === 'am' ? 'am-ET' : 'en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(receivedAt)

  const bubbleStyle = channel === 'call'
    ? `rounded-md ${isUser ? 'border-r-2' : 'border-l-2'} border-emerald-400 bg-slate-900 font-mono text-emerald-100`
    : channel === 'telegram'
      ? `rounded-2xl ${isUser ? 'rounded-br-md bg-sky-700' : 'rounded-bl-md bg-sky-900/80'} text-white`
      : isUser
        ? 'rounded-2xl rounded-br-md bg-violet-700 text-white'
        : 'rounded-2xl rounded-bl-md bg-slate-800 text-slate-100'

  return (
    <div className={`chat-message-enter flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-700 text-xs font-bold text-white" aria-hidden="true">
          {t('chatAttackerInitial')}
        </span>
      )}
      <div className={`max-w-[88%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'} flex min-w-0 flex-col`}>
        <p className={`whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-6 ${bubbleStyle} ${message.pending ? 'opacity-60' : ''}`}>
          {message.text}
        </p>
        <time className="mt-1 px-1 text-[10px] leading-4 text-slate-500" dateTime={receivedAt.toISOString()} aria-label={t('chatReceivedAt').replace('{time}', time)}>
          {time}
        </time>
      </div>
    </div>
  )
}
