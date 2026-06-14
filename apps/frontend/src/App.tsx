import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useRoomStore } from './store/roomStore'
import { useChatStore } from './store/chatStore'
import HomePage from './pages/HomePage'
import RoomPage from './pages/RoomPage'
import AudioPlayer from './components/Player/AudioPlayer'

// ── Top Navigation ─────────────────────────────────────────────────────────────
function NavBar() {
  const { status, roomCode } = useRoomStore()
  const { unreadCount } = useChatStore()
  const navigate = useNavigate()

  const inRoom = status === 'connected' || status === 'grace_period'

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border" style={{
      background: 'rgba(15,15,26,0.9)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          aria-label="OpenWave home"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center shadow-glow-sm">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M3 9l4-4 4 4 4-4 4 4v6l-4 4-4-4-4 4-4-4V9z" />
            </svg>
          </div>
          <span className="font-display font-bold text-white text-lg">Wavy</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-2">
          {inRoom && roomCode && (
            <button
              onClick={() => navigate('/room')}
              className="flex items-center gap-1.5 btn-ghost text-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="room-code text-xs">{roomCode}</span>
              {unreadCount > 0 && (
                <span className="badge badge-brand">{unreadCount}</span>
              )}
            </button>
          )}

          <Link to="/" className="btn-ghost text-sm">
            Discover
          </Link>
        </nav>
      </div>
    </header>
  )
}

// ── App root ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <div className="page-layout">
        <NavBar />

        <main className="main-grid">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room" element={<RoomPage />} />
            <Route path="*" element={
              <div className="content-area flex items-center justify-center">
                <div className="text-center space-y-3">
                  <p className="text-6xl">🌊</p>
                  <h1 className="font-display text-2xl font-bold text-white">Page Not Found</h1>
                  <Link to="/" className="btn-primary inline-flex">Go Home</Link>
                </div>
              </div>
            } />
          </Routes>
        </main>

        {/* Global persistent player bar */}
        <AudioPlayer />
      </div>
    </BrowserRouter>
  )
}
