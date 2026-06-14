import { z } from 'zod'

// ─── Shared primitive schemas ─────────────────────────────────────────────────

const TrackIdSchema = z.string().min(1).max(64).regex(/^[\w-]+$/)
const UsernameSchema = z.string().min(1).max(32).regex(/^[\w\s\-_.]+/)
const RoomCodeSchema = z.string().length(6).regex(/^[A-Z0-9]+/)

// ─── Client → Server message schemas ─────────────────────────────────────────

export const JoinRoomSchema = z.object({
  type: z.literal('JOIN_ROOM'),
  room_code: RoomCodeSchema,
  username: UsernameSchema,
})

export const CreateRoomSchema = z.object({
  type: z.literal('CREATE_ROOM'),
  username: UsernameSchema,
})

export const LeaveRoomSchema = z.object({
  type: z.literal('LEAVE_ROOM'),
})

/**
 * SYNC_STATE — host only.
 * position_ms must be non-negative and finite.
 * host_timestamp must be a recent Unix ms timestamp (within 30s of server time).
 */
export const SyncStateSchema = z.object({
  type: z.literal('SYNC_STATE'),
  track_id: TrackIdSchema,
  position_ms: z.number().int().min(0).max(24 * 60 * 60 * 1000), // max 24h
  is_playing: z.boolean(),
  host_timestamp: z.number().int().positive().refine(
    (ts) => Math.abs(Date.now() - ts) < 30_000,
    { message: 'host_timestamp must be within 30 seconds of server time' }
  ),
})

/**
 * CHAT_MESSAGE — content trimmed and max 500 chars.
 * Validation here is length/type only; XSS sanitization happens on the client.
 */
export const ChatMessageSchema = z.object({
  type: z.literal('CHAT_MESSAGE'),
  content: z.string().min(1).max(500),
})

export const QueueSuggestSchema = z.object({
  type: z.literal('QUEUE_SUGGEST'),
  track_id: TrackIdSchema,
  track_name: z.string().min(1).max(200),
  artist_name: z.string().min(1).max(200),
  duration: z.number().int().min(1).max(24 * 60 * 60), // seconds
  image_url: z.string().url().optional(),
  audio_url: z.string().url(),
})

export const QueueVoteSchema = z.object({
  type: z.literal('QUEUE_VOTE'),
  track_id: TrackIdSchema,
  vote: z.enum(['up', 'down']),
})

/** QUEUE_ACCEPT — host only */
export const QueueAcceptSchema = z.object({
  type: z.literal('QUEUE_ACCEPT'),
  track_id: TrackIdSchema,
})

export const CloseRoomSchema = z.object({
  type: z.literal('CLOSE_ROOM'),
})

// ─── Union discriminated schema for all inbound messages ─────────────────────

export const InboundMessageSchema = z.discriminatedUnion('type', [
  JoinRoomSchema,
  CreateRoomSchema,
  LeaveRoomSchema,
  SyncStateSchema,
  ChatMessageSchema,
  QueueSuggestSchema,
  QueueVoteSchema,
  QueueAcceptSchema,
  CloseRoomSchema,
])

export type InboundMessage = z.infer<typeof InboundMessageSchema>
export type SyncStateMessage = z.infer<typeof SyncStateSchema>
export type ChatMessage = z.infer<typeof ChatMessageSchema>
export type QueueSuggestMessage = z.infer<typeof QueueSuggestSchema>
export type QueueVoteMessage = z.infer<typeof QueueVoteSchema>
export type QueueAcceptMessage = z.infer<typeof QueueAcceptSchema>

/**
 * Safely parse a raw WebSocket message string.
 * Returns the parsed message or null if invalid/unknown.
 * Prevents prototype pollution by using Zod's strict validation.
 */
export function parseMessage(raw: string): InboundMessage | null {
  try {
    const json: unknown = JSON.parse(raw)

    // Prevent prototype pollution — reject arrays and non-plain objects
    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      return null
    }

    const result = InboundMessageSchema.safeParse(json)
    if (!result.success) {
      return null // Silently drop malformed messages
    }

    return result.data
  } catch {
    return null // Silently drop non-JSON frames
  }
}
