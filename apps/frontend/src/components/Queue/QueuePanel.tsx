import { useRoomStore } from '../../store/roomStore'
import QueueItem from './QueueItem'
import { useJamRoom } from '../../hooks/useJamRoom'

export default function QueuePanel() {
  const { votingQueue, isHost, status } = useRoomStore()
  const { voteTrack, acceptTrack } = useJamRoom()

  const inRoom = status === 'connected' || status === 'grace_period'

  const sorted = [...votingQueue].sort((a, b) => b.votes - a.votes)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-surface-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-brand-400">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
          </svg>
          <span className="text-sm font-medium text-white">Voting Queue</span>
          {votingQueue.length > 0 && (
            <span className="badge badge-brand">{votingQueue.length}</span>
          )}
        </div>
        {isHost && (
          <span className="badge badge-green">Host</span>
        )}
      </div>

      {/* Queue list */}
      <div
        role="list"
        aria-label="Voting queue"
        className="flex-1 overflow-y-auto min-h-0"
      >
        {!inRoom ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-700 mb-2">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2z" />
            </svg>
            <p className="text-sm text-gray-600">Join a room to vote</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-700 mb-2">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
            </svg>
            <p className="text-sm text-gray-600">Queue is empty</p>
            <p className="text-xs text-gray-700 mt-1">
              Search for a track and hit "+ Queue"
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {sorted.map((item, idx) => (
              <QueueItem
                key={item.track.id}
                item={item}
                rank={idx + 1}
                isHost={isHost}
                onVote={voteTrack}
                onAccept={acceptTrack}
              />
            ))}
          </div>
        )}
      </div>

      {/* Host info */}
      {inRoom && isHost && votingQueue.length > 0 && (
        <div className="p-3 border-t border-surface-border flex-shrink-0">
          <p className="text-xs text-gray-500 text-center">
            ✓ Accept a track to play it next
          </p>
        </div>
      )}
    </div>
  )
}
