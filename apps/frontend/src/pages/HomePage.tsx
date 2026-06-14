import React, { useEffect, useState } from 'react'
import { normalizeTrack } from '../api/jamendo'
import { Track } from '../store/playerStore'
import { useRoomStore } from '../store/roomStore'
import { useJamRoom } from '../hooks/useJamRoom'
import SearchBar from '../components/Search/SearchBar'
import TrackCard from '../components/Search/TrackCard'
import axios from 'axios'

export default function HomePage() {
  const [charts, setCharts] = useState<Track[]>([])
  const [isLoadingCharts, setIsLoadingCharts] = useState(true)
  const [chartError, setChartError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [username, setUsername] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [modalError, setModalError] = useState('')

  const { status } = useRoomStore()
  const { createRoom, joinRoom } = useJamRoom()
  const inRoom = status !== 'idle' && status !== 'error'

  useEffect(() => {
    axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/charts`)
      .then(res => {
        const rawTracks = Array.isArray(res.data) ? res.data : (res.data.results || [])
        const trackData = rawTracks.map(normalizeTrack)
        setCharts(trackData)
        setChartError(null)
      })
      .catch(err => {
        console.error("Charts fetch bypassed:", err)
        setChartError(null)
      })
      .finally(() => setIsLoadingCharts(false))
  }, [])

  const handleCreate = () => {
    if (!username.trim()) { setModalError('Enter a username'); return }
    createRoom(username.trim())
    setShowCreateModal(false)
    setUsername('')
    setModalError('')
  }

  const handleJoin = () => {
    if (!username.trim()) { setModalError('Enter a username'); return }
    if (joinCode.trim().length !== 6) { setModalError('Room code must be 6 characters'); return }
    joinRoom(joinCode.trim(), username.trim())
    setShowJoinModal(false)
    setUsername('')
    setJoinCode('')
    setModalError('')
  }

  return (
    <div className="content-area">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-hero-glow">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 badge badge-brand mb-6 text-sm px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Free & Open Source
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold mb-4 leading-tight">
            <span className="text-gradient">Listen Together,</span>
            <br />
            <span className="text-white">In Real-Time</span>
          </h1>

          <p className="text-slate-400 max-w-xl text-center mx-auto mt-4 text-base md:text-lg">
            Discover real-time trending music and synchronized playback with anyone in the world 
            — millisecond-accurate, no account required to listen.
          </p>

          {/* Search */}
          <div className="flex justify-center mb-8">
            <div className="w-full max-w-xl">
              <SearchBar />
            </div>
          </div>

          {/* Room CTA buttons */}
          {!inRoom && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                id="create-room-btn"
                onClick={() => { setShowCreateModal(true); setModalError('') }}
                className="btn-primary px-6 py-3 text-base shadow-glow-brand"
              >
                🎛️ Create Jam Room
              </button>
              <button
                id="join-room-btn"
                onClick={() => { setShowJoinModal(true); setModalError('') }}
                className="btn-secondary px-6 py-3 text-base"
              >
                🎧 Join a Room
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Chart tracks ──────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 rounded-full bg-brand-500" />
          <h2 className="text-xl font-display font-semibold text-white">Trending This Week</h2>
        </div>

        {chartError && (
          <div className="glass-card p-6 text-center">
            <p className="text-rose-400 text-sm mb-2">{chartError}</p>
            <p className="text-gray-500 text-xs">
              Set <code className="text-brand-400">JAMENDO_CLIENT_ID</code> in your backend .env
            </p>
          </div>
        )}

        {isLoadingCharts && !chartError && (
          <div className="grid grid-cols-1 gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                <div className="w-4 h-3 bg-surface-raised rounded" />
                <div className="w-11 h-11 bg-surface-raised rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-surface-raised rounded w-1/2" />
                  <div className="h-2 bg-surface-raised rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoadingCharts && !chartError && (
          <div className="glass-card overflow-hidden">
            {charts.map((track, idx) => (
              <div key={track.id} className="border-b border-surface-border/50 last:border-0">
                <TrackCard track={track} index={idx} showSuggest={inRoom} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Features strip ───────────────────────────────────────────── */}
      <div className="border-t border-surface-border">
        <div className="max-w-4xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '🎵', title: 'Jamendo Catalog', desc: '600,000+ royalty-free tracks, always free.' },
            { icon: '⚡', title: 'Drift-Corrected Sync', desc: 'Sub-500ms sync tolerance. No audible skips.' },
            { icon: '🗳️', title: 'Democratic Queue', desc: 'Vote on tracks. Host decides what plays next.' },
          ].map((f) => (
            <div key={f.title} className="glass-card p-5 space-y-2">
              <div className="text-2xl">{f.icon}</div>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Create Room Modal ────────────────────────────────────────── */}
      {showCreateModal && (
        <Modal title="Create a Jam Room" onClose={() => setShowCreateModal(false)}>
          <p className="text-sm text-gray-400 mb-4">
            You'll be the host. Share the room code with friends to listen together.
          </p>
          <input
            id="create-username"
            className="input mb-3"
            type="text"
            placeholder="Your display name"
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 32))}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          {modalError && <p className="text-xs text-rose-400 mb-3">{modalError}</p>}
          <button onClick={handleCreate} className="btn-primary w-full py-2.5">
            🎛️ Create Room
          </button>
        </Modal>
      )}

      {/* ── Join Room Modal ──────────────────────────────────────────── */}
      {showJoinModal && (
        <Modal title="Join a Jam Room" onClose={() => setShowJoinModal(false)}>
          <input
            id="join-username"
            className="input mb-3"
            type="text"
            placeholder="Your display name"
            value={username}
            onChange={(e) => setUsername(e.target.value.slice(0, 32))}
            autoFocus
          />
          <input
            id="join-code"
            className="input mb-3 uppercase tracking-widest font-mono text-center"
            type="text"
            placeholder="ROOM CODE"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          {modalError && <p className="text-xs text-rose-400 mb-3">{modalError}</p>}
          <button onClick={handleJoin} className="btn-primary w-full py-2.5">
            🎧 Join Room
          </button>
        </Modal>
      )}
    </div>
  )
}

// ─── Simple Modal wrapper ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="glass-card-raised relative w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close modal" className="btn-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
