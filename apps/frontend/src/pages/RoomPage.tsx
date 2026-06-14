import { useState } from 'react'
import { useRoomStore } from '../store/roomStore'
import { usePlayerStore } from '../store/playerStore'
import { useNavigate } from 'react-router-dom'
import SearchBar from '../components/Search/SearchBar'
import RoomHeader from '../components/JamRoom/RoomHeader'
import MemberList from '../components/JamRoom/MemberList'
import ChatPanel from '../components/Chat/ChatPanel'
import QueuePanel from '../components/Queue/QueuePanel'

type RightPanel = 'chat' | 'queue'

export default function RoomPage() {
  const { status } = useRoomStore()
  const navigate = useNavigate()
  const [activePanel, setActivePanel] = useState<RightPanel>('chat')

  // Redirect if somehow landed here without being in a room
  if (status === 'idle') {
    navigate('/')
    return null
  }

  return (
    <div className="content-area flex flex-col lg:flex-row h-full">

      {/* ── Left sidebar: Room info ──────────────────────────────────── */}
      <div className="sidebar p-4 gap-4" style={{ width: '260px' }}>
        <div className="mb-2">
          <SearchBar />
        </div>

        <RoomHeader />

        <div className="gradient-divider my-2" />

        <MemberList />
      </div>

      {/* ── Center: Now playing / main content ──────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto w-full space-y-6">
          {/* Room code hero (mobile) */}
          <div className="lg:hidden">
            <RoomHeader />
          </div>

          {/* Now playing card */}
          <NowPlayingCard />
        </div>
      </div>

      {/* ── Right panel: Chat / Queue tabs ──────────────────────────── */}
      <div className="w-full lg:w-80 flex flex-col border-l border-surface-border flex-shrink-0">
        {/* Tab switcher */}
        <div className="flex border-b border-surface-border">
          <button
            id="chat-tab"
            onClick={() => setActivePanel('chat')}
            aria-selected={activePanel === 'chat'}
            role="tab"
            className={`
              flex-1 py-3 text-sm font-medium transition-colors
              ${activePanel === 'chat'
                ? 'text-brand-400 border-b-2 border-brand-500'
                : 'text-gray-500 hover:text-gray-300'}
            `}
          >
            💬 Chat
          </button>
          <button
            id="queue-tab"
            onClick={() => setActivePanel('queue')}
            aria-selected={activePanel === 'queue'}
            role="tab"
            className={`
              flex-1 py-3 text-sm font-medium transition-colors
              ${activePanel === 'queue'
                ? 'text-brand-400 border-b-2 border-brand-500'
                : 'text-gray-500 hover:text-gray-300'}
            `}
          >
            🗳️ Queue
          </button>
        </div>

        {/* Panel content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activePanel === 'chat' ? <ChatPanel /> : <QueuePanel />}
        </div>
      </div>
    </div>
  )
}

// ── Now Playing Card ──────────────────────────────────────────────────────────
function NowPlayingCard() {
  const { currentTrack, isPlaying } = usePlayerStore()

  if (!currentTrack) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-32 h-32 rounded-2xl bg-surface-raised mx-auto mb-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-gray-700">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">No track playing</p>
        <p className="text-gray-600 text-xs mt-1">Search for a track or vote in the queue</p>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 text-center space-y-4">
      <div className="relative inline-block">
        <img
          src={currentTrack.image || '/placeholder-art.png'}
          alt={currentTrack.name}
          className={`
            w-48 h-48 rounded-2xl object-cover mx-auto shadow-card
            ${isPlaying ? 'shadow-glow-brand' : ''}
            transition-shadow duration-500
          `}
        />
        {isPlaying && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-brand-600 rounded-full px-3 py-1">
            <div className="equalizer h-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="eq-bar" />)}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display font-bold text-xl text-white truncate">
          {currentTrack.name}
        </h2>
        <p className="text-gray-400 text-sm mt-1">{currentTrack.artist_name}</p>
        {currentTrack.album_name && (
          <p className="text-gray-600 text-xs mt-0.5">{currentTrack.album_name}</p>
        )}
      </div>

      {currentTrack.license_ccurl && (
        <a
          href={currentTrack.license_ccurl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-600 hover:text-gray-500 transition-colors"
        >
          Creative Commons License ↗
        </a>
      )}
    </div>
  )
}
