import { create } from 'zustand'
import { Track } from './playerStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoomMember {
  id: string
  username: string
}

export interface QueueTrack {
  track: Track
  suggested_by: string
  votes: number
  user_vote: 'up' | 'down' | null  // current user's vote
}

export type RoomStatus =
  | 'idle'             // not in a room
  | 'connecting'       // WS connecting
  | 'connected'        // in a room
  | 'grace_period'     // host disconnected, waiting
  | 'disconnected'     // WS dropped unexpectedly
  | 'error'

interface RoomState {
  // Room identity
  roomCode: string | null
  isHost: boolean
  myId: string | null
  myUsername: string | null

  // Members
  members: RoomMember[]

  // Sync state (from host broadcasts)
  syncTrackId: string | null
  syncPositionMs: number
  syncIsPlaying: boolean
  syncHostTimestamp: number

  // Voting queue (separate from player queue)
  votingQueue: QueueTrack[]

  // Connection
  status: RoomStatus
  gracePeriodMs: number | null
  error: string | null

  // Actions
  setConnecting: () => void
  setConnected: (roomCode: string, myId: string, isHost: boolean) => void
  setDisconnected: () => void
  setError: (msg: string) => void
  setMembers: (members: RoomMember[]) => void
  addMember: (member: RoomMember) => void
  removeMember: (id: string) => void
  setHost: (isHost: boolean) => void
  setGracePeriod: (ms: number | null) => void
  updateSyncState: (trackId: string, positionMs: number, isPlaying: boolean, hostTimestamp: number) => void
  setVotingQueue: (queue: QueueTrack[]) => void
  setUserVote: (trackId: string, vote: 'up' | 'down' | null) => void
  leaveRoom: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRoomStore = create<RoomState>((set) => ({
  roomCode: null,
  isHost: false,
  myId: null,
  myUsername: null,
  members: [],
  syncTrackId: null,
  syncPositionMs: 0,
  syncIsPlaying: false,
  syncHostTimestamp: 0,
  votingQueue: [],
  status: 'idle',
  gracePeriodMs: null,
  error: null,

  setConnecting: () => set({ status: 'connecting', error: null }),

  setConnected: (roomCode, myId, isHost) =>
    set({ roomCode, myId, isHost, status: 'connected', error: null }),

  setDisconnected: () =>
    set({ status: 'disconnected' }),

  setError: (msg) =>
    set({ status: 'error', error: msg }),

  setMembers: (members) => set({ members }),

  addMember: (member) =>
    set((s) => ({
      members: s.members.find((m) => m.id === member.id)
        ? s.members
        : [...s.members, member],
    })),

  removeMember: (id) =>
    set((s) => ({ members: s.members.filter((m) => m.id !== id) })),

  setHost: (isHost) => set({ isHost }),

  setGracePeriod: (ms) =>
    set({ gracePeriodMs: ms, status: ms !== null ? 'grace_period' : 'connected' }),

  updateSyncState: (trackId, positionMs, isPlaying, hostTimestamp) =>
    set({
      syncTrackId: trackId,
      syncPositionMs: positionMs,
      syncIsPlaying: isPlaying,
      syncHostTimestamp: hostTimestamp,
    }),

  setVotingQueue: (queue) => set({ votingQueue: queue }),

  setUserVote: (trackId, vote) =>
    set((s) => ({
      votingQueue: s.votingQueue.map((item) =>
        item.track.id === trackId ? { ...item, user_vote: vote } : item
      ),
    })),

  leaveRoom: () =>
    set({
      roomCode: null,
      isHost: false,
      myId: null,
      members: [],
      syncTrackId: null,
      syncPositionMs: 0,
      syncIsPlaying: false,
      syncHostTimestamp: 0,
      votingQueue: [],
      status: 'idle',
      gracePeriodMs: null,
      error: null,
    }),
}))
