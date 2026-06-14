import { useEffect, useRef, useCallback } from 'react'
import { useRoomStore } from '../store/roomStore'
import { useChatStore } from '../store/chatStore'
import { usePlayerStore } from '../store/playerStore'
import { sanitize, sanitizeUsername } from '../lib/sanitize'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3001'
const SYNC_INTERVAL_MS = 5_000
const RECONNECT_DELAY_MS = 2_000
const MAX_RECONNECT_ATTEMPTS = 5

type SendFn = (payload: object) => void

/**
 * useJamRoom — manages the WebSocket connection lifecycle for Jam Rooms.
 *
 * Handles:
 *  - WS connect / disconnect / reconnect
 *  - CREATE_ROOM / JOIN_ROOM / LEAVE_ROOM
 *  - Dispatching all inbound server messages to the correct stores
 *  - Host: emitting SYNC_STATE every 5 seconds + on play/pause/seek
 *  - Chat: sending CHAT_MESSAGE
 *  - Queue: QUEUE_SUGGEST / QUEUE_VOTE / QUEUE_ACCEPT
 */
export function useJamRoom() {
  const wsRef = useRef<WebSocket | null>(null)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const pendingActionRef = useRef<{ type: 'create' | 'join'; username: string; roomCode?: string } | null>(null)

  const roomStore = useRoomStore()
  const chatStore = useChatStore()
  const playerStore = usePlayerStore()

  // ── Helpers ────────────────────────────────────────────────────────────────

  const send: SendFn = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    }
  }, [])

  // ── Message Dispatcher ─────────────────────────────────────────────────────

  const handleMessage = useCallback((raw: string) => {
    let msg: Record<string, unknown>

    try {
      const parsed = JSON.parse(raw) as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return
      msg = parsed as Record<string, unknown>
    } catch {
      return
    }

    const type = msg.type as string

    switch (type) {
      case 'CONNECTED': {
        // WS handshake complete — now send our pending join/create action
        const pending = pendingActionRef.current
        if (!pending) return

        if (pending.type === 'create') {
          send({ type: 'CREATE_ROOM', username: pending.username })
        } else if (pending.type === 'join' && pending.roomCode) {
          send({ type: 'JOIN_ROOM', room_code: pending.roomCode.toUpperCase(), username: pending.username })
        }
        pendingActionRef.current = null
        break
      }

      case 'ROOM_CREATED': {
        const roomCode = msg.room_code as string
        const room = msg.room as { host_id: string; members: Array<{ id: string; username: string }> }
        roomStore.setConnected(roomCode, room.host_id, true)
        roomStore.setMembers(room.members)
        break
      }

      case 'ROOM_STATE': {
        const room = msg.room as {
          id: string
          host_id: string
          members: Array<{ id: string; username: string }>
          current_track: unknown
          position_ms: number
          is_playing: boolean
          host_timestamp: number
          queue: Array<{ track: unknown; suggested_by: string; votes: number }>
        }
        const myId = roomStore.myId

        roomStore.setConnected(room.id, myId ?? room.host_id, myId === room.host_id)
        roomStore.setMembers(room.members)
        roomStore.updateSyncState(
          (room.current_track as { id?: string })?.id ?? '',
          room.position_ms,
          room.is_playing,
          room.host_timestamp
        )
        roomStore.setVotingQueue(
          room.queue.map((e) => ({
            track: e.track as Parameters<typeof roomStore.setVotingQueue>[0][0]['track'],
            suggested_by: e.suggested_by,
            votes: e.votes,
            user_vote: null,
          }))
        )

        // Load chat history
        const history = msg.chat_history as Array<{ username: string; content: string; timestamp: number }> ?? []
        const myUsername = roomStore.myUsername ?? ''
        chatStore.loadHistory(
          history.map((m) => ({
            username: sanitizeUsername(m.username),
            content: sanitize(m.content),
            timestamp: m.timestamp,
          })),
          myUsername
        )
        break
      }

      case 'MEMBER_JOINED': {
        const member = msg.member as { id: string; username: string }
        roomStore.addMember({ id: member.id, username: sanitizeUsername(member.username) })
        break
      }

      case 'MEMBER_LEFT': {
        roomStore.removeMember(msg.member_id as string)
        break
      }

      case 'HOST_DISCONNECTED': {
        roomStore.setGracePeriod(msg.grace_period_ms as number)
        break
      }

      case 'HOST_RECLAIMED':
      case 'HOST_PROMOTED': {
        const newHostId = (msg.new_host_id ?? msg.member_id) as string
        roomStore.setGracePeriod(null)
        const myId = roomStore.myId
        if (myId === newHostId) {
          roomStore.setHost(true)
        }
        break
      }

      case 'SYNC_BROADCAST': {
        const trackId = msg.track_id as string
        const positionMs = msg.position_ms as number
        const isPlaying = msg.is_playing as boolean
        const hostTimestamp = msg.host_timestamp as number
        roomStore.updateSyncState(trackId, positionMs, isPlaying, hostTimestamp)
        break
      }

      case 'CHAT_BROADCAST': {
        const username = sanitizeUsername(msg.username as string)
        const content = sanitize(msg.content as string)
        const timestamp = msg.timestamp as number
        const myUsername = roomStore.myUsername

        chatStore.addMessage({
          username,
          content,
          timestamp,
          isOwn: username === myUsername,
        })
        break
      }

      case 'QUEUE_UPDATE': {
        const queue = msg.queue as Array<{ track: unknown; suggested_by: string; votes: number }>
        roomStore.setVotingQueue(
          queue.map((e) => ({
            track: e.track as Parameters<typeof roomStore.setVotingQueue>[0][0]['track'],
            suggested_by: e.suggested_by,
            votes: e.votes,
            user_vote: roomStore.votingQueue.find(
              (q) => q.track.id === (e.track as { id: string }).id
            )?.user_vote ?? null,
          }))
        )
        break
      }

      case 'TRACK_ACCEPTED': {
        const track = msg.track as Parameters<typeof playerStore.setTrack>[0]
        playerStore.setTrack(track)
        playerStore.play()
        break
      }

      case 'ROOM_DISSOLVED': {
        roomStore.leaveRoom()
        chatStore.clearChat()
        break
      }

      case 'ERROR': {
        roomStore.setError(msg.message as string)
        break
      }

      default:
        break
    }
  }, [roomStore, chatStore, playerStore, send])

  // ── WebSocket Connection ───────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_URL}/ws`)
    wsRef.current = ws
    roomStore.setConnecting()

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0
      console.log('[WS] Connected')
    }

    ws.onmessage = (event) => handleMessage(event.data as string)

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      roomStore.setDisconnected()

      // Auto-reconnect with backoff
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current)
        reconnectAttemptsRef.current++
        setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      roomStore.setError('WebSocket connection error.')
    }
  }, [handleMessage, roomStore])

  // ── Host Sync Interval ─────────────────────────────────────────────────────

  const startSyncInterval = useCallback(() => {
    if (syncIntervalRef.current) return

    syncIntervalRef.current = setInterval(() => {
      const { isHost, roomCode } = useRoomStore.getState()
      const { currentTrack, isPlaying, position } = usePlayerStore.getState()

      if (!isHost || !roomCode || !currentTrack) return

      send({
        type: 'SYNC_STATE',
        track_id: currentTrack.id,
        position_ms: Math.round(position * 1000),
        is_playing: isPlaying,
        host_timestamp: Date.now(),
      })
    }, SYNC_INTERVAL_MS)
  }, [send])

  const stopSyncInterval = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current)
      syncIntervalRef.current = null
    }
  }, [])

  // ── Public API ─────────────────────────────────────────────────────────────

  const createRoom = useCallback((username: string) => {
    pendingActionRef.current = { type: 'create', username }
    useRoomStore.setState({ myUsername: username })
    connect()
  }, [connect])

  const joinRoom = useCallback((roomCode: string, username: string) => {
    pendingActionRef.current = { type: 'join', username, roomCode }
    useRoomStore.setState({ myUsername: username })
    connect()
  }, [connect])

  const leaveRoom = useCallback(() => {
    send({ type: 'LEAVE_ROOM' })
    stopSyncInterval()
    roomStore.leaveRoom()
    chatStore.clearChat()
    wsRef.current?.close()
    wsRef.current = null
  }, [send, stopSyncInterval, roomStore, chatStore])

  const sendChat = useCallback((content: string) => {
    const safe = sanitize(content)
    if (!safe) return
    send({ type: 'CHAT_MESSAGE', content: safe })
  }, [send])

  const suggestTrack = useCallback((track: {
    id: string; name: string; artist_name: string; duration: number; image?: string; audio: string
  }) => {
    send({
      type: 'QUEUE_SUGGEST',
      track_id: track.id,
      track_name: track.name,
      artist_name: track.artist_name,
      duration: track.duration,
      image_url: track.image,
      audio_url: track.audio,
    })
  }, [send])

  const voteTrack = useCallback((trackId: string, vote: 'up' | 'down') => {
    send({ type: 'QUEUE_VOTE', track_id: trackId, vote })
    roomStore.setUserVote(trackId, vote)
  }, [send, roomStore])

  const acceptTrack = useCallback((trackId: string) => {
    send({ type: 'QUEUE_ACCEPT', track_id: trackId })
  }, [send])

  /** Emit SYNC_STATE immediately (called on play/pause/seek by host) */
  const emitSync = useCallback(() => {
    const { isHost, roomCode } = useRoomStore.getState()
    const { currentTrack, isPlaying, position } = usePlayerStore.getState()
    if (!isHost || !roomCode || !currentTrack) return

    send({
      type: 'SYNC_STATE',
      track_id: currentTrack.id,
      position_ms: Math.round(position * 1000),
      is_playing: isPlaying,
      host_timestamp: Date.now(),
    })
  }, [send])

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const { isHost, status } = roomStore
    if (isHost && status === 'connected') {
      startSyncInterval()
    } else {
      stopSyncInterval()
    }
  }, [roomStore.isHost, roomStore.status, startSyncInterval, stopSyncInterval])

  useEffect(() => {
    return () => {
      stopSyncInterval()
      wsRef.current?.close()
    }
  }, [stopSyncInterval])

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    sendChat,
    suggestTrack,
    voteTrack,
    acceptTrack,
    emitSync,
    send,
  }
}
