import { useRoomStore } from '../../store/roomStore'

export default function MemberList() {
  const { members, myId, isHost } = useRoomStore()

  if (members.length === 0) return null

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1 mb-2">
        In this room
      </p>
      {members.map((member) => {
        const isSelf = member.id === myId
        const isRoomHost = isHost && isSelf

        return (
          <div
            key={member.id}
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-raised transition-colors"
          >
            {/* Avatar */}
            <div className={`
              w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
              ${isRoomHost
                ? 'bg-brand-700 text-brand-200'
                : 'bg-surface-border text-gray-400'}
            `}>
              {member.username.charAt(0).toUpperCase()}
            </div>

            {/* Name */}
            <span className={`text-sm truncate flex-1 ${isSelf ? 'text-white font-medium' : 'text-gray-300'}`}>
              {member.username}
              {isSelf && <span className="text-gray-500 font-normal"> (you)</span>}
            </span>

            {/* Host badge */}
            {isRoomHost && (
              <span className="badge badge-brand text-[10px]">HOST</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
