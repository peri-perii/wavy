/**
 * syncMath.ts — Client-side drift calculation for Jam Room sync.
 *
 * Algorithm (from PRD §10.1):
 *   Expected Position (ms) = position_ms + (Date.now() - host_timestamp)
 *   Drift Delta (ms)       = |audio.currentTime × 1000 - Expected Position|
 *
 *   IF Drift Delta > DRIFT_THRESHOLD_MS → seek audio to Expected Position
 */

export const DRIFT_THRESHOLD_MS = 500 // Seek only if drift > 500ms
export const SYNC_INTERVAL_MS = 5_000 // Host broadcasts every 5 seconds

/**
 * Calculate the expected playback position for a listener,
 * compensating for network latency using the host's timestamp.
 *
 * @param positionMs    The position_ms value from the host's SYNC_STATE message
 * @param hostTimestamp The host_timestamp (Unix ms) from the host's message
 * @param isPlaying     Whether the track is currently playing (paused = no drift)
 * @returns             Expected position in milliseconds
 */
export function calcExpectedPositionMs(
  positionMs: number,
  hostTimestamp: number,
  isPlaying: boolean
): number {
  if (!isPlaying) return positionMs
  const elapsed = Date.now() - hostTimestamp
  return positionMs + Math.max(0, elapsed)
}

/**
 * Calculate the drift between the local audio position and the expected position.
 *
 * @param audioCurrentTimeSec   Local audio element's currentTime in seconds
 * @param expectedPositionMs    The expected position in milliseconds
 * @returns                     Drift delta in milliseconds (always positive)
 */
export function calcDriftMs(
  audioCurrentTimeSec: number,
  expectedPositionMs: number
): number {
  const localMs = audioCurrentTimeSec * 1000
  return Math.abs(localMs - expectedPositionMs)
}

/**
 * Determine if the audio needs a seek correction.
 * Returns the target currentTime (seconds) to seek to, or null if no correction needed.
 *
 * @param audioCurrentTimeSec   Local audio element's currentTime (seconds)
 * @param positionMs            Host's reported position in milliseconds
 * @param hostTimestamp         Host's Unix timestamp when positionMs was recorded
 * @param isPlaying             Whether the room is currently playing
 * @returns                     Target seconds to seek to, or null (no correction needed)
 */
export function getSyncCorrection(
  audioCurrentTimeSec: number,
  positionMs: number,
  hostTimestamp: number,
  isPlaying: boolean
): number | null {
  const expectedMs = calcExpectedPositionMs(positionMs, hostTimestamp, isPlaying)
  const drift = calcDriftMs(audioCurrentTimeSec, expectedMs)

  if (drift > DRIFT_THRESHOLD_MS) {
    return expectedMs / 1000
  }

  return null
}
