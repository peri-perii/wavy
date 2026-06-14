import { Track, UnifiedTrack } from '../store/playerStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JamendoTrack {
  id: string
  name: string
  duration: number
  artist_id: string
  artist_name: string
  artist_idstr: string
  album_name: string
  album_id: string
  album_image: string
  image: string
  audio: string
  audiodownload: string
  shareurl: string
  license_ccurl: string
  position?: number
  releasedate?: string
  musicinfo?: {
    vocalinstrumental?: string
    lang?: string
    gender?: string
    tags?: {
      genres?: string[]
      instruments?: string[]
      vartags?: string[]
    }
  }
}

export interface JamendoResponse<T> {
  headers: {
    status: string
    code: number
    error_message: string
    results_count: number
  }
  results: T[]
}

export interface SearchParams {
  q: string
  limit?: number
  offset?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3001'

async function apiFetch<T>(path: string): Promise<JamendoResponse<T>> {
  const res = await fetch(`${BACKEND}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `API error ${res.status}`)
  }

  return res.json() as Promise<JamendoResponse<T>>
}

/** Normalise a raw Jamendo track or UnifiedTrack into our internal Track shape */
export function normalizeTrack(raw: any): Track {
  if (raw && raw.source) {
    const ut = raw as UnifiedTrack
    return {
      id: ut.id,
      name: ut.title,
      artist_name: ut.artist,
      artist_id: '',
      album_name: '',
      album_id: '',
      duration: Math.round(ut.duration_ms / 1000),
      position: 0,
      image: ut.artworkUrl || '',
      audio: ut.streamUrl,
      source: ut.source,
      nativeId: ut.nativeId,
    }
  }

  return {
    id: `jam-${raw.id}`,
    name: raw.name,
    artist_id: raw.artist_id,
    artist_name: raw.artist_name,
    album_name: raw.album_name,
    album_id: raw.album_id,
    duration: raw.duration,
    position: 0,
    image: raw.image || raw.album_image || '',
    audio: raw.audio,
    shareurl: raw.shareurl,
    license_ccurl: raw.license_ccurl,
    source: 'jamendo',
    nativeId: raw.id,
  }
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Search tracks by keyword.
 * Debounce (300ms) should be applied by the calling component.
 */
export async function searchTracks(params: SearchParams): Promise<Track[]> {
  const q = encodeURIComponent(params.q.trim())
  const limit = params.limit ?? 20
  const offset = params.offset ?? 0

  const data = await apiFetch<any>(
    `/api/tracks/search?q=${q}&limit=${limit}&offset=${offset}`
  )

  return data.results.map(normalizeTrack)
}

/**
 * Fetch a single track by ID.
 */
export async function fetchTrack(id: string): Promise<Track | null> {
  const data = await apiFetch<any>(`/api/tracks/${id}`)
  return data.results[0] ? normalizeTrack(data.results[0]) : null
}

/**
 * Fetch trending chart tracks.
 */
export async function fetchCharts(): Promise<Track[]> {
  const data = await apiFetch<any>('/api/charts')
  return data.results.map(normalizeTrack)
}

/**
 * Search albums.
 */
export async function searchAlbums(q: string, limit = 10) {
  return apiFetch(`/api/albums/search?q=${encodeURIComponent(q)}&limit=${limit}`)
}

/**
 * Search artists.
 */
export async function searchArtists(q: string, limit = 10) {
  return apiFetch(`/api/artists/search?q=${encodeURIComponent(q)}&limit=${limit}`)
}
