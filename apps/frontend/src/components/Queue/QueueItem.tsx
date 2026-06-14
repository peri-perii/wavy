import { QueueTrack } from '../../store/roomStore'

interface QueueItemProps {
  item: QueueTrack
  rank: number
  isHost: boolean
  onVote: (trackId: string, vote: 'up' | 'down') => void
  onAccept: (trackId: string) => void
}

export default function QueueItem({ item, rank, isHost, onVote, onAccept }: QueueItemProps) {
  const { track, suggested_by, votes, user_vote } = item

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div
      role="listitem"
      className="
        flex items-center gap-3 p-2.5 rounded-xl
        bg-surface-card hover:bg-surface-raised
        border border-surface-border hover:border-brand-800/40
        transition-all duration-150 group animate-fade-in
      "
    >
      {/* Rank */}
      <span className="text-xs text-gray-600 w-4 text-center flex-shrink-0 font-mono">
        #{rank}
      </span>

      {/* Album art */}
      <img
        src={track.image || '/placeholder-art.png'}
        alt={track.album_name}
        className="w-9 h-9 rounded-lg object-cover bg-surface-border flex-shrink-0"
      />

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{track.name}</p>
        <p className="text-xs text-gray-500 truncate">
          {track.artist_name}
          <span className="text-gray-700"> · by {suggested_by}</span>
        </p>
      </div>

      {/* Duration */}
      <span className="text-xs text-gray-600 flex-shrink-0 tabular-nums">
        {formatDuration(track.duration)}
      </span>

      {/* Vote buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onVote(track.id, 'up')}
          aria-label={`Upvote ${track.name}`}
          aria-pressed={user_vote === 'up'}
          className={`vote-btn-up ${user_vote === 'up' ? 'active' : ''}`}
        >
          ▲
        </button>

        <span className={`
          text-xs font-bold w-5 text-center tabular-nums
          ${votes > 0 ? 'text-emerald-400' : votes < 0 ? 'text-rose-400' : 'text-gray-500'}
        `}>
          {votes > 0 ? `+${votes}` : votes}
        </span>

        <button
          onClick={() => onVote(track.id, 'down')}
          aria-label={`Downvote ${track.name}`}
          aria-pressed={user_vote === 'down'}
          className={`vote-btn-down ${user_vote === 'down' ? 'active' : ''}`}
        >
          ▼
        </button>
      </div>

      {/* Host accept button */}
      {isHost && (
        <button
          onClick={() => onAccept(track.id)}
          aria-label={`Accept ${track.name} as next track`}
          className="
            btn px-2 py-1 text-xs font-semibold
            bg-brand-700/50 hover:bg-brand-600
            text-brand-300 hover:text-white
            border border-brand-700/50 hover:border-brand-500
            rounded-lg transition-all duration-150
            opacity-0 group-hover:opacity-100
          "
        >
          ✓ Play
        </button>
      )}
    </div>
  )
}
