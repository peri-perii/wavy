import { ChatMessage as ChatMessageType } from '../../store/chatStore'

interface ChatMessageProps {
  message: ChatMessageType
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const { username, content, timestamp, isOwn } = message

  const time = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  // NOTE: content is already DOMPurify-sanitized before being stored in the
  // chat store (sanitized in useJamRoom handleMessage → CHAT_BROADCAST).
  // We use React's safe text rendering (no dangerouslySetInnerHTML).
  return (
    <div className={`flex flex-col gap-0.5 animate-fade-in ${isOwn ? 'items-end' : 'items-start'}`}>
      {/* Username + timestamp */}
      <div className={`flex items-baseline gap-1.5 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        <span className={`text-xs font-medium ${isOwn ? 'text-brand-400' : 'text-gray-400'}`}>
          {username}
        </span>
        <span className="text-[10px] text-gray-600">{time}</span>
      </div>

      {/* Bubble — plain text, React-escaped, never dangerouslySetInnerHTML */}
      <div
        className={`chat-bubble ${
          isOwn
            ? 'bg-brand-700/50 text-white border border-brand-600/30'
            : 'bg-surface-raised text-gray-200 border border-surface-border'
        }`}
      >
        {/* Safe: React renders this as text node, not HTML */}
        {content}
      </div>
    </div>
  )
}
