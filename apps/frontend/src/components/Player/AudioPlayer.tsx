import { usePlayerStore } from '../../store/playerStore'
import { useRoomStore } from '../../store/roomStore'
import { usePlayer } from '../../hooks/usePlayer'
import { useJamRoom } from '../../hooks/useJamRoom'
import ProgressBar from './ProgressBar'
import VolumeControl from './VolumeControl'

// ── Icons (inline SVG to avoid extra dependency) ─────────────────────────────
const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M8 5v14l11-7z" />
  </svg>
)
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
)
const SkipNextIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
  </svg>
)
const SkipPrevIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
)
const ShuffleIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
  </svg>
)
const RepeatIcon = ({ mode }: { mode: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    {mode === 'one' ? (
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
    ) : (
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
    )}
  </svg>
)

// ── Equalizer (playing indicator) ────────────────────────────────────────────
const Equalizer = () => (
  <div className="equalizer h-4" aria-label="Playing">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="eq-bar" style={{ height: `${8 + Math.random() * 8}px` }} />
    ))}
  </div>
)

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
export default function AudioPlayer() {
  const { currentTrack, isPlaying, position, duration, shuffle, repeat, isLoading,
    togglePlay, playNext, playPrev, toggleShuffle, cycleRepeat } = usePlayerStore()
  const { isHost, status: roomStatus } = useRoomStore()
  const { audioRef, seek } = usePlayer()
  const { emitSync } = useJamRoom()

  const inRoom = roomStatus === 'connected' || roomStatus === 'grace_period'
  // Non-host listeners cannot control playback
  const isControlLocked = inRoom && !isHost

  const handleTogglePlay = () => {
    if (isControlLocked) return
    togglePlay()
    // Emit sync immediately on play/pause
    setTimeout(emitSync, 50)
  }

  const handleSeek = (sec: number) => {
    if (isControlLocked) return
    seek(sec)
    setTimeout(emitSync, 50)
  }

  const formatTime = (sec: number) => {
    if (!isFinite(sec)) return '0:00'
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="player-bar">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />

      <div className="h-full max-w-screen-xl mx-auto px-4 flex items-center gap-4">

        {/* ── Track Info ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 w-56 min-w-0 flex-shrink-0">
          {currentTrack ? (
            <>
              <div className="relative flex-shrink-0">
                <img
                  src={currentTrack.image || '/placeholder-art.png'}
                  alt={currentTrack.name}
                  className="w-12 h-12 rounded-lg object-cover bg-surface-raised"
                />
                {isPlaying && (
                  <div className="absolute -bottom-1 -right-1 bg-brand-600 rounded p-0.5">
                    <Equalizer />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{currentTrack.name}</p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-xs text-gray-400 truncate">{currentTrack.artist_name}</p>
                  {currentTrack.source === 'youtube' && (
                    <span className="flex-shrink-0 text-[8px] font-bold tracking-wider text-rose-400/80 bg-rose-950/40 border border-rose-900/30 px-1.5 py-0.2 rounded font-mono uppercase">
                      EXTRACTOR // AUDIO
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-surface-raised flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-600">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500">No track selected</p>
            </div>
          )}
        </div>

        {/* ── Controls + Progress ─────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
          {/* Control buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleShuffle}
              className={`btn-icon ${shuffle ? 'text-brand-400' : ''}`}
              aria-label="Toggle shuffle"
              disabled={isControlLocked}
            >
              <ShuffleIcon />
            </button>

            <button
              onClick={() => { playPrev(); setTimeout(emitSync, 50) }}
              className="btn-icon"
              aria-label="Previous track"
              disabled={isControlLocked || !currentTrack}
            >
              <SkipPrevIcon />
            </button>

            <button
              onClick={handleTogglePlay}
              disabled={!currentTrack}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className={`
                w-10 h-10 rounded-full flex items-center justify-center
                transition-all duration-200 active:scale-90
                ${currentTrack
                  ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-glow-sm'
                  : 'bg-surface-raised text-gray-600 cursor-not-allowed'}
                ${isLoading ? 'opacity-75' : ''}
              `}
            >
              {isLoading ? (
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
              ) : isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button
              onClick={() => { playNext(); setTimeout(emitSync, 50) }}
              className="btn-icon"
              aria-label="Next track"
              disabled={isControlLocked || !currentTrack}
            >
              <SkipNextIcon />
            </button>

            <button
              onClick={cycleRepeat}
              className={`btn-icon ${repeat !== 'none' ? 'text-brand-400' : ''}`}
              aria-label={`Repeat mode: ${repeat}`}
              disabled={isControlLocked}
            >
              <RepeatIcon mode={repeat} />
            </button>
          </div>

          {/* Progress bar + timestamps */}
          <div className="flex items-center gap-2 w-full max-w-lg">
            <span className="text-xs text-gray-500 w-8 text-right tabular-nums">
              {formatTime(position)}
            </span>
            <ProgressBar
              position={position}
              duration={duration}
              onSeek={handleSeek}
              disabled={isControlLocked || !currentTrack}
            />
            <span className="text-xs text-gray-500 w-8 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* ── Volume ──────────────────────────────────────────────── */}
        <div className="w-32 flex-shrink-0 hidden sm:flex justify-end">
          <VolumeControl />
        </div>
      </div>
    </div>
  )
}
