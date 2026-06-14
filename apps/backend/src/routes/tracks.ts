import { Router, Request, Response } from 'express'
import { apiRateLimiter, searchRateLimiter } from '../middleware/rateLimiter.js'
import axios from 'axios'

const router = Router()

const JAMENDO_BASE = process.env.JAMENDO_API_BASE || 'https://api.jamendo.com/v3.0'
const CLIENT_ID = process.env.JAMENDO_CLIENT_ID

export interface UnifiedTrack {
  id: string          // E.g., "yt-vId_12345" or "jam-trackId"
  nativeId: string    // The raw source ID
  source: 'jamendo' | 'soundcloud' | 'youtube'
  title: string
  artist: string
  artworkUrl: string | null
  duration_ms: number
  streamUrl: string   
}

/** Build a Jamendo API URL with client_id injected server-side */
function jamendoUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${JAMENDO_BASE}${path}`)
  url.searchParams.set('client_id', CLIENT_ID ?? '')
  url.searchParams.set('format', 'json')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.toString()
}

/** Helper to extract YouTube video ID from a Piped item URL path */
function extractYoutubeId(urlPath: string): string {
  // Piped usually returns "/watch?v=videoId"
  const match = urlPath.match(/[?&]v=([^&#]+)/)
  if (match) return match[1]
  return urlPath.replace(/^\/watch\?v=/, '')
}

/** Query the Jamendo API for track search */
async function searchJamendo(query: string): Promise<UnifiedTrack[]> {
  if (!CLIENT_ID) return []
  try {
    const url = jamendoUrl('/tracks/', {
      search: query,
      limit: '20',
      imagesize: '200',
      audioformat: 'mp32',
      order: 'relevance',
    })
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json() as any
    return (data.results || []).map((raw: any) => ({
      id: `jam-${raw.id}`,
      nativeId: raw.id,
      source: 'jamendo',
      title: raw.name,
      artist: raw.artist_name,
      artworkUrl: raw.image || null,
      duration_ms: (raw.duration || 0) * 1000,
      streamUrl: raw.audio,
    }))
  } catch (err) {
    console.error('[Tracks Search] Jamendo failed:', err)
    return []
  }
}

/** Query a public Piped instance for music search */
async function searchYoutube(query: string): Promise<UnifiedTrack[]> {
  const pipedBase = process.env.PIPED_API_BASE || 'https://pipedapi.kavin.rocks'
  try {
    const res = await fetch(`${pipedBase}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const data = await res.json() as any
    const items = data.items || []
    return items
      .filter((item: any) => item.type === 'stream')
      .map((item: any) => {
        const videoId = extractYoutubeId(item.url || '')
        return {
          id: `yt-${videoId}`,
          nativeId: videoId,
          source: 'youtube',
          title: item.title || 'Unknown Title',
          artist: item.uploaderName || 'Unknown Artist',
          artworkUrl: item.thumbnail || null,
          duration_ms: (item.duration || 0) * 1000,
          streamUrl: `/api/tracks/stream/yt/${videoId}`, // Resolved fully-qualified on delivery or client
        }
      })
  } catch (err) {
    console.error('[Tracks Search] YouTube (Piped) failed:', err)
    return []
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/tracks/search?q=<query>&limit=<n>
 * Poly-search: Jamendo + YouTube (Piped) + SoundCloud (Mocked) concurrently.
 */
router.get('/tracks/search', searchRateLimiter, async (req: Request, res: Response) => {
  const query = String(req.query.q ?? '').trim()
  if (!query) {
    res.status(400).json({ error: 'MISSING_QUERY', message: 'Search query "q" is required.' })
    return
  }

  // Execute pipelines concurrently
  const [jamResult, ytResult] = await Promise.allSettled([
    searchJamendo(query),
    searchYoutube(query),
  ])

  const jamTracks = jamResult.status === 'fulfilled' ? jamResult.value : []
  const ytTracks = ytResult.status === 'fulfilled' ? ytResult.value : []
  const scTracks: UnifiedTrack[] = [] // SoundCloud placeholder

  // Ensure fully-qualified streamUrls for YouTube tracks
  const host = req.get('host')
  const protocol = req.protocol
  const mappedYtTracks = ytTracks.map((t) => ({
    ...t,
    streamUrl: `${protocol}://${host}/api/tracks/stream/yt/${t.nativeId}`,
  }))

  // Interleave Jamendo and YouTube results for premium mixed-feed UX
  const results: UnifiedTrack[] = []
  const maxLen = Math.max(jamTracks.length, mappedYtTracks.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < jamTracks.length) results.push(jamTracks[i])
    if (i < mappedYtTracks.length) results.push(mappedYtTracks[i])
  }

  res.json({
    headers: {
      status: 'success',
      code: 0,
      error_message: '',
      results_count: results.length,
    },
    results,
  })
})

/**
 * GET /api/tracks/:id
 * Retrieve metadata for a single track by its poly-ID (e.g. jam-X or yt-Y).
 */
router.get('/tracks/:id', apiRateLimiter, async (req: Request, res: Response) => {
  const { id } = req.params
  const host = req.get('host')
  const protocol = req.protocol

  if (id.startsWith('yt-')) {
    const videoId = id.replace('yt-', '')
    const pipedBase = process.env.PIPED_API_BASE || 'https://pipedapi.kavin.rocks'
    try {
      const response = await fetch(`${pipedBase}/streams/${videoId}`, {
        signal: AbortSignal.timeout(6000),
      })
      if (!response.ok) {
        res.status(404).json({ error: 'NOT_FOUND', message: 'YouTube track not found.' })
        return
      }
      const data = await response.json() as any
      const track: UnifiedTrack = {
        id: `yt-${videoId}`,
        nativeId: videoId,
        source: 'youtube',
        title: data.title || 'Unknown YouTube Track',
        artist: data.uploader || 'Unknown Artist',
        artworkUrl: data.thumbnailUrl || null,
        duration_ms: (data.duration || 0) * 1000,
        streamUrl: `${protocol}://${host}/api/tracks/stream/yt/${videoId}`,
      }
      res.json({
        headers: { status: 'success', code: 0, error_message: '', results_count: 1 },
        results: [track],
      })
    } catch (err) {
      console.error('[Tracks Fetch] YouTube metadata failed:', err)
      res.status(502).json({ error: 'BAD_GATEWAY', message: 'Failed to fetch YouTube metadata.' })
    }
  } else {
    // Jamendo track ID
    const nativeId = id.replace('jam-', '')
    if (!/^\d+$/.test(nativeId)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Track ID must be numeric.' })
      return
    }
    try {
      const url = jamendoUrl('/tracks/', {
        id: nativeId,
        include: 'musicinfo',
        imagesize: '200',
        audioformat: 'mp32',
      })
      const response = await fetch(url)
      if (!response.ok) {
        res.status(502).json({ error: 'JAMENDO_ERROR', message: 'Failed to query Jamendo.' })
        return
      }
      const data = await response.json() as any
      const raw = data.results?.[0]
      if (!raw) {
        res.json({
          headers: { status: 'success', code: 0, error_message: '', results_count: 0 },
          results: [],
        })
        return
      }
      const track: UnifiedTrack = {
        id: `jam-${raw.id}`,
        nativeId: raw.id,
        source: 'jamendo',
        title: raw.name,
        artist: raw.artist_name,
        artworkUrl: raw.image || null,
        duration_ms: raw.duration * 1000,
        streamUrl: raw.audio,
      }
      res.json({
        headers: { status: 'success', code: 0, error_message: '', results_count: 1 },
        results: [track],
      })
    } catch (err) {
      console.error('[Tracks Fetch] Jamendo failed:', err)
      res.status(502).json({ error: 'BAD_GATEWAY', message: 'Failed to query Jamendo.' })
    }
  }
})

/**
 * GET /api/charts
 * Retrieve trending charts from Jamendo and map to UnifiedTrack format.
 */
router.get('/charts', apiRateLimiter, async (_req: Request, res: Response) => {
  try {
    const url = jamendoUrl('/tracks/', {
      limit: '20',
      imagesize: '200',
      audioformat: 'mp32',
      order: 'popularity_week',
    })
    const response = await fetch(url)
    if (!response.ok) {
      res.status(502).json({ error: 'JAMENDO_ERROR', message: 'Failed to fetch charts from Jamendo.' })
      return
    }
    const data = await response.json() as any
    const tracks: UnifiedTrack[] = (data.results || []).map((raw: any) => ({
      id: `jam-${raw.id}`,
      nativeId: raw.id,
      source: 'jamendo',
      title: raw.name,
      artist: raw.artist_name,
      artworkUrl: raw.image || null,
      duration_ms: raw.duration * 1000,
      streamUrl: raw.audio,
    }))
    res.json({
      headers: { status: 'success', code: 0, error_message: '', results_count: tracks.length },
      results: tracks,
    })
  } catch (err) {
    console.error('[Charts] Failed:', err)
    res.status(502).json({ error: 'BAD_GATEWAY', message: 'Failed to query Jamendo charts.' })
  }
})

/**
 * GET /api/tracks/stream/yt/:videoId
 * Secure audio extractor proxy: downloads YouTube audio from Piped source
 * and tunnels it through Node.js to solve CORS and expiration concerns.
 */
router.get('/tracks/stream/yt/:videoId', async (req: Request, res: Response) => {
  const { videoId } = req.params
  const pipedBase = process.env.PIPED_API_BASE || 'https://pipedapi.kavin.rocks'

  try {
    const response = await fetch(`${pipedBase}/streams/${videoId}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'YouTube stream not found.' })
      return
    }

    const data = await response.json() as any
    const audioStreams = data.audioStreams || []

    if (audioStreams.length === 0) {
      res.status(404).json({ error: 'NO_AUDIO_STREAM', message: 'No audio streams available.' })
      return
    }

    // Sort by bitrate descending and prefer M4A/WebM containers
    const sorted = [...audioStreams].sort((a: any, b: any) => (Number(b.bitrate || 0) - Number(a.bitrate || 0)))
    const optimal = sorted.find((s: any) =>
      s.format === 'M4A' || s.format === 'WEBM' || s.codec === 'opus' || s.mimeType?.includes('audio')
    ) || sorted[0]

    if (!optimal || !optimal.url) {
      res.status(404).json({ error: 'NO_STREAM_URL', message: 'Valid stream URL not resolved.' })
      return
    }

    const rawAudioStreamUrl = optimal.url

    // Forward byte range header if requested by HTML5 player
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    if (req.headers.range) {
      headers['Range'] = req.headers.range
    }

    // Stream negotiation tunnel via Axios
    const streamResponse = await axios({
      method: 'get',
      url: rawAudioStreamUrl,
      responseType: 'stream',
      headers,
      validateStatus: () => true, // Pipe any status code (such as 200, 206, etc.) directly
    })

    // Forward downstream headers
    res.status(streamResponse.status)
    Object.entries(streamResponse.headers).forEach(([k, v]) => {
      if (v !== undefined) {
        res.setHeader(k, v)
      }
    })

    streamResponse.data.pipe(res)
  } catch (err: any) {
    console.error('[Stream Tunnel Error]', err.message)
    res.status(502).json({ error: 'STREAM_ERROR', message: 'Failed to negotiate stream tunnel.' })
  }
})

/** Album & Artist search delegates */
router.get('/albums/search', searchRateLimiter, async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim()
  const limit = Math.min(Number(req.query.limit ?? 10), 50).toString()

  if (!q) {
    res.status(400).json({ error: 'MISSING_QUERY', message: 'Search query "q" is required.' })
    return
  }

  try {
    const url = jamendoUrl('/albums/', { search: q, limit, imagesize: '200' })
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch {
    res.status(502).json({ error: 'BAD_GATEWAY', message: 'Failed to search Jamendo albums.' })
  }
})

router.get('/artists/search', searchRateLimiter, async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim()
  const limit = Math.min(Number(req.query.limit ?? 10), 50).toString()

  if (!q) {
    res.status(400).json({ error: 'MISSING_QUERY', message: 'Search query "q" is required.' })
    return
  }

  try {
    const url = jamendoUrl('/artists/', { search: q, limit, imagesize: '100' })
    const response = await fetch(url)
    const data = await response.json()
    res.json(data)
  } catch {
    res.status(502).json({ error: 'BAD_GATEWAY', message: 'Failed to search Jamendo artists.' })
  }
})

export default router
