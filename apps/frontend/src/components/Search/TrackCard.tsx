import { Track } from '../../store/playerStore'
import { usePlayerStore } from '../../store/playerStore'
import { useJamRoom } from '../../hooks/useJamRoom'
import { useRoomStore } from '../../store/roomStore'

interface TrackCardProps {
  track: Track
  index?: number
  showSuggest?: boolean
}

export default function TrackCard({ track, index, showSuggest = false }: TrackCardProps) {
  const { currentTrack, isPlaying, setTrack, play, pause } = usePlayerStore()
  const { status } = useRoomStore()
  const { suggestTrack } = useJamRoom()

  const isActive = currentTrack?.id === track.id
  const inRoom = status === 'connected'

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handlePlay = () => {
    if (isActive) {
      isPlaying ? pause() : play()
    } else {
      setTrack(track)
      play()
    }
  }

  const handleSuggest = (e: React.MouseEvent) => {
    e.stopPropagation()
    suggestTrack({
      id: track.id,
      name: track.name,
      artist_name: track.artist_name,
      duration: track.duration,
      image: track.image,
      audio: track.audio,
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Play ${track.name} by ${track.artist_name}`}
      onClick={handlePlay}
      onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
      className={`
        track-card group
        ${isActive ? 'bg-brand-950/60 border border-brand-800/40' : ''}
      `}
    >
      {/* Index or playing indicator */}
      {index !== undefined && (
        <span className="text-xs text-gray-500 w-4 text-right flex-shrink-0">
          {isActive && isPlaying ? (
            <span className="text-brand-400">▶</span>
          ) : (
            index + 1
          )}
        </span>
      )}

      {/* Album art */}
      <div className="relative flex-shrink-0">
        <img
          src={track.image || '/placeholder-art.png'}
          alt={track.album_name}
          className="w-11 h-11 rounded-lg object-cover bg-surface-raised"
        />
        {isActive && isPlaying && (
          <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center">
            <div className="equalizer h-4">
              {[1, 2, 3].map((i) => <div key={i} className="eq-bar" />)}
            </div>
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={`text-sm font-medium truncate ${isActive ? 'text-brand-300' : 'text-white'}`}>
            {track.name}
          </p>
          {track.source === 'youtube' && (
            <span className="flex-shrink-0 text-[8px] font-bold tracking-wider text-rose-400 bg-rose-950/40 border border-rose-900/40 px-1 py-0.2 rounded uppercase font-mono">
              YT
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">
          {track.artist_name}
          {track.album_name && (
            <span className="text-gray-600"> · {track.album_name}</span>
          )}
        </p>
      </div>

      {/* Duration + actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {inRoom && showSuggest && (
          <button
            onClick={handleSuggest}
            aria-label={`Suggest ${track.name} to room queue`}
            className="btn-ghost text-xs py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            + Queue
          </button>
        )}
        <span className="text-xs text-gray-500 tabular-nums">
          {formatDuration(track.duration)}
        </span>
      </div>
    </div>
  )
}
