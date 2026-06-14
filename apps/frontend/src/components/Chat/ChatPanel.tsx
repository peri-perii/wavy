import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../../store/chatStore'
import { useRoomStore } from '../../store/roomStore'
import { useJamRoom } from '../../hooks/useJamRoom'
import ChatMessage from './ChatMessage'

export default function ChatPanel() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, isPanelOpen, unreadCount, togglePanel: _togglePanel, markRead } = useChatStore()
  const { status } = useRoomStore()
  const { sendChat } = useJamRoom()

  const inRoom = status === 'connected' || status === 'grace_period'

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (isPanelOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, isPanelOpen])

  // Mark read when panel opens
  useEffect(() => {
    if (isPanelOpen) markRead()
  }, [isPanelOpen, markRead])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || !inRoom) return
    sendChat(trimmed)
    setInput('')
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between p-3 border-b border-surface-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-brand-400">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
          <span className="text-sm font-medium text-white">Live Chat</span>
          {unreadCount > 0 && !isPanelOpen && (
            <span className="badge badge-brand">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">ephemeral</span>
      </div>

      {/* Messages */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-700 mb-2">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
            <p className="text-sm text-gray-600">No messages yet</p>
            <p className="text-xs text-gray-700 mt-1">Say hello to the room! 👋</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-surface-border flex-shrink-0">
        {inRoom ? (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 500))}
              onKeyDown={handleKeyDown}
              placeholder="Say something…"
              maxLength={500}
              className="input flex-1 py-2 text-sm"
              aria-label="Chat message"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="Send message"
              className="btn-primary px-3 py-2 disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-600 text-center">Join a room to chat</p>
        )}
        {input.length > 400 && (
          <p className="text-xs text-gray-500 mt-1 text-right">
            {500 - input.length} chars left
          </p>
        )}
      </div>
    </div>
  )
}
