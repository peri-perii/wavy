import { create } from 'zustand'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnifiedTrack {
  id: string          // E.g., "yt-vId_12345"
  nativeId: string    // The raw YouTube Video ID
  source: 'jamendo' | 'soundcloud' | 'youtube'
  title: string
  artist: string
  artworkUrl: string | null
  duration_ms: number
  streamUrl: string   
}

export interface Track {
  id: string
  name: string
  artist_name: string
  artist_id: string
  album_name: string
  album_id: string
  duration: number        // seconds
  position: number        // seconds (current)
  image: string           // album art URL
  audio: string           // streaming URL (mp32)
  shareurl?: string
  license_ccurl?: string
  source?: 'jamendo' | 'soundcloud' | 'youtube'
  nativeId?: string
}

export type RepeatMode = 'none' | 'one' | 'all'

interface PlayerState {
  // Current playback
  currentTrack: Track | null
  isPlaying: boolean
  position: number          // seconds
  duration: number          // seconds
  volume: number            // 0–1
  isMuted: boolean
  isLoading: boolean

  // Queue
  queue: Track[]
  queueIndex: number

  // Playback settings
  shuffle: boolean
  repeat: RepeatMode

  // Actions
  setTrack: (track: Track) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setPosition: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setLoading: (loading: boolean) => void
  setIsPlaying: (playing: boolean) => void

  // Queue management
  setQueue: (tracks: Track[], startIndex?: number) => void
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  playNext: () => void
  playPrev: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  isLoading: false,
  queue: [],
  queueIndex: -1,
  shuffle: false,
  repeat: 'none',

  setTrack: (track) =>
    set({
      currentTrack: track,
      duration: track.duration,
      position: 0,
      isLoading: true,
    }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),

  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  setPosition: (seconds) => set({ position: seconds }),

  setVolume: (volume) => {
    const clamped = Math.max(0, Math.min(1, volume))
    set({ volume: clamped, isMuted: clamped === 0 })
  },

  toggleMute: () =>
    set((s) => ({
      isMuted: !s.isMuted,
      volume: s.isMuted ? (s.volume === 0 ? 0.5 : s.volume) : s.volume,
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setQueue: (tracks, startIndex = 0) =>
    set({
      queue: tracks,
      queueIndex: startIndex,
      currentTrack: tracks[startIndex] ?? null,
    }),

  addToQueue: (track) =>
    set((s) => ({ queue: [...s.queue, track] })),

  removeFromQueue: (index) =>
    set((s) => ({
      queue: s.queue.filter((_, i) => i !== index),
      queueIndex: index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex,
    })),

  clearQueue: () => set({ queue: [], queueIndex: -1 }),

  playNext: () => {
    const { queue, queueIndex, shuffle, repeat } = get()

    if (queue.length === 0) return

    if (repeat === 'one') {
      // Replay current track — handled by usePlayer hook resetting position
      set({ position: 0 })
      return
    }

    let nextIndex: number

    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length)
    } else {
      nextIndex = queueIndex + 1
    }

    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0
      } else {
        // End of queue
        set({ isPlaying: false })
        return
      }
    }

    set({
      queueIndex: nextIndex,
      currentTrack: queue[nextIndex],
      position: 0,
      isLoading: true,
    })
  },

  playPrev: () => {
    const { queue, queueIndex, position } = get()

    // If more than 3 seconds in — restart current track
    if (position > 3) {
      set({ position: 0 })
      return
    }

    const prevIndex = Math.max(0, queueIndex - 1)
    set({
      queueIndex: prevIndex,
      currentTrack: queue[prevIndex] ?? null,
      position: 0,
      isLoading: true,
    })
  },

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

  cycleRepeat: () =>
    set((s) => {
      const modes: RepeatMode[] = ['none', 'all', 'one']
      const next = modes[(modes.indexOf(s.repeat) + 1) % modes.length]
      return { repeat: next }
    }),
}))
