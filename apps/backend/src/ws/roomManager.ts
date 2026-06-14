import { WebSocket } from 'ws'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrackInfo {
  id: string
  name: string
  artist_name: string
  duration: number // seconds
  image_url?: string
  audio_url: string
}

export interface QueueEntry {
  track: TrackInfo
  suggested_by: string // username
  votes: number
  voted_by: Map<string, 'up' | 'down'> // memberId → vote
}

export interface RoomMember {
  id: string         // websocket connection id (uuid)
  username: string
  ws: WebSocket
  joined_at: number
  last_chat_at: number // for chat rate limiting
  chat_count: number   // messages in current window
}

export interface RoomState {
  id: string                  // 6-char code e.g. "ABC123"
  host_id: string             // member id of current host
  members: Map<string, RoomMember>
  current_track: TrackInfo | null
  position_ms: number
  is_playing: boolean
  host_timestamp: number
  queue: QueueEntry[]
  chat_buffer: ChatEntry[]    // rolling 100-message buffer
  grace_timer: ReturnType<typeof setTimeout> | null
  created_at: number
}

export interface ChatEntry {
  username: string
  content: string
  timestamp: number
}

// ─── In-memory Room Store ─────────────────────────────────────────────────────

const rooms = new Map<string, RoomState>()

const GRACE_PERIOD_MS = 60_000     // 60 seconds
const CHAT_BUFFER_SIZE = 100
const CHAT_RATE_LIMIT = 5          // messages per second per connection
const CHAT_RATE_WINDOW_MS = 1_000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No ambiguous O/0, I/1
  let code: string
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  } while (rooms.has(code))
  return code
}

function send(ws: WebSocket, payload: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

function broadcast(room: RoomState, payload: object, exclude?: string): void {
  room.members.forEach((member) => {
    if (exclude && member.id === exclude) return
    send(member.ws, payload)
  })
}

function getNextHost(room: RoomState): RoomMember | null {
  // Promote the member who joined earliest (excluding current host)
  let earliest: RoomMember | null = null
  room.members.forEach((member) => {
    if (member.id === room.host_id) return
    if (!earliest || member.joined_at < earliest.joined_at) {
      earliest = member
    }
  })
  return earliest
}

function serializeRoom(room: RoomState) {
  return {
    id: room.id,
    host_id: room.host_id,
    members: Array.from(room.members.values()).map((m) => ({
      id: m.id,
      username: m.username,
    })),
    current_track: room.current_track,
    position_ms: room.position_ms,
    is_playing: room.is_playing,
    host_timestamp: room.host_timestamp,
    queue: serializeQueue(room.queue),
  }
}

function serializeQueue(queue: QueueEntry[]) {
  return [...queue]
    .sort((a, b) => b.votes - a.votes)
    .map((entry) => ({
      track: entry.track,
      suggested_by: entry.suggested_by,
      votes: entry.votes,
    }))
}

// ─── Room Lifecycle ───────────────────────────────────────────────────────────

export function createRoom(member: RoomMember): RoomState {
  const code = generateRoomCode()
  const room: RoomState = {
    id: code,
    host_id: member.id,
    members: new Map([[member.id, member]]),
    current_track: null,
    position_ms: 0,
    is_playing: false,
    host_timestamp: Date.now(),
    queue: [],
    chat_buffer: [],
    grace_timer: null,
    created_at: Date.now(),
  }

  rooms.set(code, room)

  send(member.ws, {
    type: 'ROOM_CREATED',
    room_code: code,
    room: serializeRoom(room),
  })

  console.log(`[Room] Created ${code} by ${member.username}`)
  return room
}

export function joinRoom(
  roomCode: string,
  member: RoomMember
): { success: true; room: RoomState } | { success: false; error: string } {
  const room = rooms.get(roomCode.toUpperCase())

  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' }
  }

  // If this member is the disconnected host reconnecting within grace period
  if (room.grace_timer && room.host_id === member.id) {
    clearTimeout(room.grace_timer)
    room.grace_timer = null
    room.members.set(member.id, member)

    broadcast(room, {
      type: 'HOST_RECLAIMED',
      member_id: member.id,
      username: member.username,
    })

    send(member.ws, {
      type: 'ROOM_STATE',
      room: serializeRoom(room),
      chat_history: room.chat_buffer,
    })

    console.log(`[Room] ${member.username} reclaimed host in ${roomCode}`)
    return { success: true, room }
  }

  room.members.set(member.id, member)

  // Send current room state to the new joiner
  send(member.ws, {
    type: 'ROOM_STATE',
    room: serializeRoom(room),
    chat_history: room.chat_buffer,
  })

  // Announce to existing members
  broadcast(room, {
    type: 'MEMBER_JOINED',
    member: { id: member.id, username: member.username },
    member_count: room.members.size,
  }, member.id)

  console.log(`[Room] ${member.username} joined ${roomCode} (${room.members.size} members)`)
  return { success: true, room }
}

export function leaveRoom(roomCode: string, memberId: string): void {
  const room = rooms.get(roomCode)
  if (!room) return

  const member = room.members.get(memberId)
  if (!member) return

  const isHost = room.host_id === memberId

  if (!isHost) {
    // Simple member leave
    room.members.delete(memberId)
    broadcast(room, {
      type: 'MEMBER_LEFT',
      member_id: memberId,
      username: member.username,
      member_count: room.members.size,
    })

    // Clean up empty rooms
    if (room.members.size === 0) {
      dissolveRoom(roomCode)
    }
    return
  }

  // Host is leaving — start grace period
  room.members.delete(memberId)

  broadcast(room, {
    type: 'HOST_DISCONNECTED',
    grace_period_ms: GRACE_PERIOD_MS,
  })

  console.log(`[Room] Host left ${roomCode}. Grace period started (60s).`)

  room.grace_timer = setTimeout(() => {
    const currentRoom = rooms.get(roomCode)
    if (!currentRoom) return

    if (currentRoom.members.size === 0) {
      dissolveRoom(roomCode)
      return
    }

    // Promote next member
    const newHost = getNextHost(currentRoom)
    if (!newHost) {
      dissolveRoom(roomCode)
      return
    }

    currentRoom.host_id = newHost.id
    currentRoom.grace_timer = null

    broadcast(currentRoom, {
      type: 'HOST_PROMOTED',
      new_host_id: newHost.id,
      new_host_username: newHost.username,
    })

    console.log(`[Room] ${newHost.username} promoted to host in ${roomCode}`)
  }, GRACE_PERIOD_MS)
}

export function handleHostReconnect(roomCode: string, memberId: string, ws: WebSocket): boolean {
  const room = rooms.get(roomCode)
  if (!room || room.host_id !== memberId || !room.grace_timer) return false

  clearTimeout(room.grace_timer)
  room.grace_timer = null

  const existingMember = room.members.get(memberId)
  if (existingMember) {
    existingMember.ws = ws
  }

  return true
}

export function dissolveRoom(roomCode: string): void {
  const room = rooms.get(roomCode)
  if (!room) return

  if (room.grace_timer) {
    clearTimeout(room.grace_timer)
  }

  broadcast(room, { type: 'ROOM_DISSOLVED', reason: 'Host disconnected and grace period expired.' })
  rooms.delete(roomCode)
  console.log(`[Room] ${roomCode} dissolved.`)
}

export function closeRoom(roomCode: string, requesterId: string): boolean {
  const room = rooms.get(roomCode)
  if (!room || room.host_id !== requesterId) return false

  broadcast(room, { type: 'ROOM_DISSOLVED', reason: 'Room closed by host.' })
  if (room.grace_timer) clearTimeout(room.grace_timer)
  rooms.delete(roomCode)
  console.log(`[Room] ${roomCode} closed by host.`)
  return true
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export function handleSyncState(
  room: RoomState,
  hostId: string,
  trackId: string,
  positionMs: number,
  isPlaying: boolean,
  hostTimestamp: number
): void {
  if (room.host_id !== hostId) return // Only host can set sync state

  room.position_ms = positionMs
  room.is_playing = isPlaying
  room.host_timestamp = hostTimestamp

  if (!room.current_track || room.current_track.id !== trackId) {
    // Track changed — update if known in queue
    const queueEntry = room.queue.find((e) => e.track.id === trackId)
    if (queueEntry) {
      room.current_track = queueEntry.track
    } else if (room.current_track?.id !== trackId) {
      // Track not in queue but host is playing it — create minimal record
      room.current_track = { id: trackId, name: '', artist_name: '', duration: 0, audio_url: '' }
    }
  }

  broadcast(room, {
    type: 'SYNC_BROADCAST',
    track_id: trackId,
    position_ms: positionMs,
    is_playing: isPlaying,
    host_timestamp: hostTimestamp,
  }, hostId)
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

/**
 * Check chat rate limit: max 5 messages per second per connection.
 * Returns true if allowed, false if rate limited.
 */
function checkChatRateLimit(member: RoomMember): boolean {
  const now = Date.now()
  if (now - member.last_chat_at > CHAT_RATE_WINDOW_MS) {
    member.last_chat_at = now
    member.chat_count = 1
    return true
  }
  member.chat_count++
  return member.chat_count <= CHAT_RATE_LIMIT
}

export function handleChatMessage(
  room: RoomState,
  member: RoomMember,
  content: string
): boolean {
  if (!checkChatRateLimit(member)) return false

  // Truncate to 500 chars server-side (belt-and-suspenders with schema)
  const safeContent = content.slice(0, 500)

  const entry: ChatEntry = {
    username: member.username,
    content: safeContent,
    timestamp: Date.now(),
  }

  // Maintain rolling 100-message buffer
  room.chat_buffer.push(entry)
  if (room.chat_buffer.length > CHAT_BUFFER_SIZE) {
    room.chat_buffer.shift()
  }

  broadcast(room, {
    type: 'CHAT_BROADCAST',
    username: entry.username,
    content: entry.content,
    timestamp: entry.timestamp,
  })

  return true
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export function handleQueueSuggest(
  room: RoomState,
  member: RoomMember,
  track: TrackInfo
): void {
  // Prevent duplicate suggestions
  const exists = room.queue.some((e) => e.track.id === track.id)
  if (exists) return

  const entry: QueueEntry = {
    track,
    suggested_by: member.username,
    votes: 0,
    voted_by: new Map(),
  }

  room.queue.push(entry)

  broadcast(room, {
    type: 'QUEUE_UPDATE',
    queue: serializeQueue(room.queue),
  })
}

export function handleQueueVote(
  room: RoomState,
  member: RoomMember,
  trackId: string,
  vote: 'up' | 'down'
): void {
  const entry = room.queue.find((e) => e.track.id === trackId)
  if (!entry) return

  const existingVote = entry.voted_by.get(member.id)

  // Idempotent: re-voting same direction is a no-op
  if (existingVote === vote) return

  // Remove old vote
  if (existingVote) {
    entry.votes += existingVote === 'up' ? -1 : 1
  }

  // Apply new vote
  entry.voted_by.set(member.id, vote)
  entry.votes += vote === 'up' ? 1 : -1

  broadcast(room, {
    type: 'QUEUE_UPDATE',
    queue: serializeQueue(room.queue),
  })
}

export function handleQueueAccept(
  room: RoomState,
  requesterId: string,
  trackId: string
): TrackInfo | null {
  if (room.host_id !== requesterId) return null // Host only

  const idx = room.queue.findIndex((e) => e.track.id === trackId)
  if (idx === -1) return null

  const [accepted] = room.queue.splice(idx, 1)
  room.current_track = accepted.track

  broadcast(room, {
    type: 'TRACK_ACCEPTED',
    track: accepted.track,
    queue: serializeQueue(room.queue),
  })

  return accepted.track
}

export { rooms }
