export default function TypingDots({ label, initial }) {
  return (
    <div className="flex items-center gap-2" role="status" aria-label={label}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-700 text-xs font-bold text-white" aria-hidden="true">{initial}</span>
      <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-800 px-3.5 py-3" aria-hidden="true">
        <span className="chat-typing-dot h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="chat-typing-dot chat-typing-dot-delayed h-1.5 w-1.5 rounded-full bg-slate-300" />
        <span className="chat-typing-dot chat-typing-dot-later h-1.5 w-1.5 rounded-full bg-slate-300" />
      </span>
      <span className="sr-only">{label}</span>
    </div>
  )
}
