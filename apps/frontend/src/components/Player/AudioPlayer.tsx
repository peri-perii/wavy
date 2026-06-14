import { usePlayerStore } from '../../store/playerStore'
import { useRoomStore } from '../../store/roomStore'
import { usePlayer } from '../../hooks/usePlayer'
import { useJamRoom } from '../../hooks/useJamRoom'
import ProgressBar from './ProgressBar'
import VolumeControl from './VolumeControl'
import { Button } from '../ui/button'
import { Shuffle, SkipBack, SkipForward, Play, Pause, Repeat, Repeat1, Loader2 } from 'lucide-react'

// ── Removed legacy SVG icons as we use lucide-react now ─────────────────────────────

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
      <audio
        ref={audioRef}
        preload="auto"
        onCanPlay={async () => {
          if (!audioRef.current) return
          try {
            audioRef.current.volume = 0.8
            await audioRef.current.play()
            console.log('[Wavy Player] Audio channel successfully established!')
          } catch (err) {
            console.warn('[Wavy Player] Autoplay blocked, awaiting initial viewport canvas click interaction:', err)
          }
        }}
      />

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
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleShuffle}
              className={`rounded-full h-9 w-9 ${shuffle ? 'text-brand-400' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label="Toggle shuffle"
              disabled={isControlLocked}
            >
              <Shuffle className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => { playPrev(); setTimeout(emitSync, 50) }}
              className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground"
              aria-label="Previous track"
              disabled={isControlLocked || !currentTrack}
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </Button>

            <Button
              onClick={handleTogglePlay}
              disabled={!currentTrack}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className={`
                rounded-full h-11 w-11 flex items-center justify-center
                transition-all duration-200 active:scale-95 shadow-glow-sm
                ${currentTrack
                  ? 'bg-brand-600 hover:bg-brand-500 text-white'
                  : 'bg-surface-raised text-muted-foreground cursor-not-allowed hover:bg-surface-raised'}
              `}
            >
              {isLoading ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => { playNext(); setTimeout(emitSync, 50) }}
              className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground"
              aria-label="Next track"
              disabled={isControlLocked || !currentTrack}
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={cycleRepeat}
              className={`rounded-full h-9 w-9 ${repeat !== 'none' ? 'text-brand-400' : 'text-muted-foreground hover:text-foreground'}`}
              aria-label={`Repeat mode: ${repeat}`}
              disabled={isControlLocked}
            >
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </Button>
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
