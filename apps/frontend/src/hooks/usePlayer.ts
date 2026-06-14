import { useEffect, useRef, useCallback } from 'react'
import { usePlayerStore } from '../store/playerStore'
import { useRoomStore } from '../store/roomStore'
import { getSyncCorrection } from '../lib/syncMath'

/**
 * usePlayer — wires the HTML5 <audio> element to the Zustand player store.
 *
 * Returns a ref to be attached to an <audio> element.
 * Handles:
 *  - Play/pause mirroring from store
 *  - Volume/mute
 *  - Seeking from progress bar
 *  - Track loading (src change)
 *  - Auto-advance to next queue item
 *  - Room sync correction (drift > 500ms → seek)
 */
export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    setPosition,
    setLoading,
    setIsPlaying,
    playNext,
  } = usePlayerStore()

  const {
    status: roomStatus,
    isHost,
    syncPositionMs,
    syncIsPlaying,
    syncHostTimestamp,
    syncTrackId,
  } = useRoomStore()

  const inRoom = roomStatus === 'connected' || roomStatus === 'grace_period'

  // ── Track src changes ──────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    if (audio.src !== currentTrack.audio) {
      audio.src = currentTrack.audio
      audio.load()
      setLoading(true)
    }
  }, [currentTrack?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play / Pause ───────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.play().catch((err) => {
        // Autoplay blocked — update store to reflect paused state
        if (err.name === 'NotAllowedError') {
          setIsPlaying(false)
        }
      })
    } else {
      audio.pause()
    }
  }, [isPlaying, setIsPlaying])

  // ── Volume / Mute ──────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  // ── Audio event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setPosition(audio.currentTime)
    const onCanPlay = () => setLoading(false)
    const onWaiting = () => setLoading(true)
    const onEnded = () => {
      setIsPlaying(false)
      playNext()
    }
    const onError = () => {
      setLoading(false)
      setIsPlaying(false)
      console.error('[Player] Audio error:', audio.error?.message)
    }

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [setPosition, setLoading, setIsPlaying, playNext])

  // ── Room Sync Correction (listener only) ───────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !inRoom || isHost) return
    if (!syncTrackId) return

    // Apply drift correction
    const correction = getSyncCorrection(
      audio.currentTime,
      syncPositionMs,
      syncHostTimestamp,
      syncIsPlaying
    )

    if (correction !== null) {
      audio.currentTime = correction
    }

    // Mirror host's play/pause state
    if (syncIsPlaying && audio.paused) {
      audio.play().catch(() => setIsPlaying(false))
    } else if (!syncIsPlaying && !audio.paused) {
      audio.pause()
    }
  }, [syncPositionMs, syncHostTimestamp, syncIsPlaying, syncTrackId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Host: emit sync on interval ────────────────────────────────────────────
  // Handled by useJamRoom hook to keep this hook focused on audio control

  /** Seek the audio element to a given time (seconds). Called by ProgressBar. */
  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = seconds
    setPosition(seconds)
  }, [setPosition])

  return { audioRef, seek }
}
