import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import { randomUUID } from 'crypto'
import { parseMessage } from './messageSchema.js'
import {
  createRoom,
  joinRoom,
  leaveRoom,
  closeRoom,
  handleSyncState,
  handleChatMessage,
  handleQueueSuggest,
  handleQueueVote,
  handleQueueAccept,
  RoomMember,
  RoomState,
  rooms,
} from './roomManager.js'

// Track which room each connection belongs to
const connectionRoomMap = new Map<string, string>() // connectionId → roomCode
const connectionMemberMap = new Map<string, RoomMember>() // connectionId → member

function send(ws: WebSocket, payload: object): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}

/** Look up a room by its code from the in-memory store (typed) */
function getRoom(roomCode: string): RoomState | undefined {
  return rooms.get(roomCode)
}

export function createWsServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket) => {
    const connectionId = randomUUID()
    let currentMember: RoomMember | null = null

    console.log(`[WS] New connection: ${connectionId}`)

    ws.on('message', (rawData) => {
      const raw = rawData.toString()

      // Reject oversized frames (prevent memory exhaustion / DoS)
      if (raw.length > 4096) {
        send(ws, { type: 'ERROR', code: 'MESSAGE_TOO_LARGE', message: 'Message exceeds 4KB limit.' })
        return
      }

      const message = parseMessage(raw)

      if (!message) {
        // Silently drop malformed messages — do not echo errors that reveal schema
        return
      }

      switch (message.type) {
        case 'CREATE_ROOM': {
          if (currentMember) {
            send(ws, { type: 'ERROR', code: 'ALREADY_IN_ROOM', message: 'Leave current room first.' })
            return
          }

          currentMember = {
            id: connectionId,
            username: message.username,
            ws,
            joined_at: Date.now(),
            last_chat_at: 0,
            chat_count: 0,
          }

          const room = createRoom(currentMember)
          connectionRoomMap.set(connectionId, room.id)
          connectionMemberMap.set(connectionId, currentMember)
          break
        }

        case 'JOIN_ROOM': {
          if (currentMember) {
            send(ws, { type: 'ERROR', code: 'ALREADY_IN_ROOM', message: 'Leave current room first.' })
            return
          }

          currentMember = {
            id: connectionId,
            username: message.username,
            ws,
            joined_at: Date.now(),
            last_chat_at: 0,
            chat_count: 0,
          }

          const result = joinRoom(message.room_code, currentMember)

          if (!result.success) {
            send(ws, {
              type: 'ERROR',
              code: result.error,
              message: result.error === 'ROOM_NOT_FOUND'
                ? 'Room not found. Check the room code and try again.'
                : 'Could not join room.',
            })
            currentMember = null
            return
          }

          connectionRoomMap.set(connectionId, result.room.id)
          connectionMemberMap.set(connectionId, currentMember)
          break
        }

        case 'LEAVE_ROOM': {
          const roomCode = connectionRoomMap.get(connectionId)
          if (roomCode && currentMember) {
            leaveRoom(roomCode, connectionId)
            connectionRoomMap.delete(connectionId)
            connectionMemberMap.delete(connectionId)
            currentMember = null
          }
          break
        }

        case 'CLOSE_ROOM': {
          const roomCode = connectionRoomMap.get(connectionId)
          if (!roomCode) return
          closeRoom(roomCode, connectionId)
          connectionRoomMap.delete(connectionId)
          connectionMemberMap.delete(connectionId)
          currentMember = null
          break
        }

        case 'SYNC_STATE': {
          const roomCode = connectionRoomMap.get(connectionId)
          if (!roomCode || !currentMember) {
            send(ws, { type: 'ERROR', code: 'NOT_IN_ROOM', message: 'You are not in a room.' })
            return
          }

          const room = getRoom(roomCode)
          if (!room) return

          handleSyncState(
            room,
            connectionId,
            message.track_id,
            message.position_ms,
            message.is_playing,
            message.host_timestamp
          )
          break
        }

        case 'CHAT_MESSAGE': {
          const roomCode = connectionRoomMap.get(connectionId)
          if (!roomCode || !currentMember) return

          const room = getRoom(roomCode)
          if (!room) return

          const allowed = handleChatMessage(room, currentMember, message.content)
          if (!allowed) {
            send(ws, {
              type: 'ERROR',
              code: 'CHAT_RATE_LIMIT',
              message: 'You are sending messages too fast.',
            })
          }
          break
        }

        case 'QUEUE_SUGGEST': {
          const roomCode = connectionRoomMap.get(connectionId)
          if (!roomCode || !currentMember) return

          const room = getRoom(roomCode)
          if (!room) return

          handleQueueSuggest(room, currentMember, {
            id: message.track_id,
            name: message.track_name,
            artist_name: message.artist_name,
            duration: message.duration,
            image_url: message.image_url,
            audio_url: message.audio_url,
          })
          break
        }

        case 'QUEUE_VOTE': {
          const roomCode = connectionRoomMap.get(connectionId)
          if (!roomCode || !currentMember) return

          const room = getRoom(roomCode)
          if (!room) return

          handleQueueVote(room, currentMember, message.track_id, message.vote)
          break
        }

        case 'QUEUE_ACCEPT': {
          const roomCode = connectionRoomMap.get(connectionId)
          if (!roomCode || !currentMember) return

          const room = getRoom(roomCode)
          if (!room) return

          const track = handleQueueAccept(room, connectionId, message.track_id)
          if (!track) {
            send(ws, {
              type: 'ERROR',
              code: 'ACCEPT_DENIED',
              message: 'Only the host can accept queued tracks.',
            })
          }
          break
        }

        default:
          // Exhaustive check — TypeScript ensures all cases are handled
          break
      }
    })

    ws.on('close', () => {
      console.log(`[WS] Disconnected: ${connectionId}`)
      const roomCode = connectionRoomMap.get(connectionId)
      if (roomCode) {
        leaveRoom(roomCode, connectionId)
        connectionRoomMap.delete(connectionId)
        connectionMemberMap.delete(connectionId)
      }
    })

    ws.on('error', (err) => {
      console.error(`[WS] Error on ${connectionId}:`, err.message)
    })

    // Send a welcome ping
    send(ws, { type: 'CONNECTED', connection_id: connectionId })
  })

  wss.on('error', (err) => {
    console.error('[WS Server] Error:', err.message)
  })

  console.log('[WS] WebSocket server attached at /ws')
  return wss
}
