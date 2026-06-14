import React from 'react'
import { useRoomStore } from '../../store/roomStore'
import { useJamRoom } from '../../hooks/useJamRoom'

export default function RoomHeader() {
  const { roomCode, isHost, members, status, gracePeriodMs, error } = useRoomStore()
  const { leaveRoom } = useJamRoom()
  const [copied, setCopied] = React.useState(false)

  const copyCode = async () => {
    if (!roomCode) return
    await navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'idle') return null

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-emerald-400 animate-pulse-slow' :
            status === 'grace_period' ? 'bg-amber-400 animate-pulse' :
            status === 'connecting' ? 'bg-brand-400 animate-pulse' :
            'bg-rose-400'
          }`} />
          <span className="text-sm font-medium text-white">
            {isHost ? '🎛️ Your Jam Room' : '🎧 Jam Room'}
          </span>
          {status === 'grace_period' && (
            <span className="badge badge-brand animate-pulse text-xs">
              Host reconnecting…
            </span>
          )}
        </div>

        <button
          onClick={leaveRoom}
          aria-label="Leave room"
          className="btn-ghost text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-900/20"
        >
          Leave
        </button>
      </div>

      {/* Room code */}
      {roomCode && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Room code</span>
          <button
            onClick={copyCode}
            aria-label="Copy room code"
            className="room-code hover:border-brand-600 transition-colors"
          >
            {roomCode}
          </button>
          <span className={`text-xs transition-opacity duration-200 ${copied ? 'text-emerald-400 opacity-100' : 'opacity-0'}`}>
            Copied!
          </span>
        </div>
      )}

      {/* Member count */}
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-gray-500">
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
        <span className="text-xs text-gray-400">
          {members.length} listener{members.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-rose-400 bg-rose-900/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Grace period countdown */}
      {status === 'grace_period' && gracePeriodMs && (
        <div className="text-xs text-amber-400/80 bg-amber-900/20 rounded-lg px-3 py-2">
          ⏳ Host has 60 seconds to reconnect before the room is closed.
        </div>
      )}
    </div>
  )
}
