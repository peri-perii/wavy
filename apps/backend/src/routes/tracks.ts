import { Router, Request, Response } from 'express'
import { apiRateLimiter, searchRateLimiter } from '../middleware/rateLimiter.js'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

const router = Router()

const JAMENDO_BASE = process.env.JAMENDO_API_BASE || 'https://api.jamendo.com/v3.0'
const CLIENT_ID = process.env.JAMENDO_CLIENT_ID

// ─── Unified Polymorphic Type Layout ──────────────────────────────────────────

export interface UnifiedTrack {
  id: string          // E.g., "jam-1234" or "yt-vX2yz..."
  nativeId: string    // Raw video ID or Jamendo track ID
  source: 'jamendo' | 'youtube'
  title: string
  artist: string
  artworkUrl: string | null
  duration_ms: number
  streamUrl: string   // Local backend proxy stream endpoint
}

// ─── Multi-Instance Resiliency Pool ───────────────────────────────────────────

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.tokhmi.xyz',
  'https://api.piped.yt',
  'https://piped-api.garudalinux.org'
]

/**
 * Robust fallback requester that rotates sequentially through Piped instances
 * to bypass rate limiting (429) or forbidden blocks (403).
 */
async function fetchWithFallback<T = any>(
  endpointPath: string,
  config?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  let lastError: Error = new Error('No Piped instances available')

  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}${endpointPath}`
      const response = await axios.get<T>(url, {
        ...config,
        timeout: config?.timeout ?? 6000,
      })

      if (response.status === 200) {
        return response
      }
    } catch (err: any) {
      const errMsg = err.message || 'Unknown network error'
      console.warn(`[Piped Fallback] Node failed: ${instance}${endpointPath} - ${errMsg}`)
      lastError = err instanceof Error ? err : new Error(errMsg)
    }
  }

  throw lastError
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

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
  const match = urlPath.match(/[?&]v=([^&#]+)/)
  if (match) return match[1]
  return urlPath.replace(/^\/watch\?v=/, '')
}

/** Query the Jamendo API for track search and map to UnifiedTrack */
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
    const res = await axios.get(url, { timeout: 6000 })
    const data = res.data as any
    return (data.results || []).map((raw: any): UnifiedTrack => ({
      id: `jam-${raw.id}`,
      nativeId: String(raw.id),
      source: 'jamendo',
      title: String(raw.name || 'Unknown Track'),
      artist: String(raw.artist_name || 'Unknown Artist'),
      artworkUrl: raw.image ? String(raw.image) : null,
      duration_ms: (Number(raw.duration) || 0) * 1000,
      streamUrl: String(raw.audio || ''),
    }))
  } catch (err) {
    console.error('[Tracks Search] Jamendo failed:', err instanceof Error ? err.message : err)
    return []
  }
}

/** Query Piped instances with fallback for track search and map to UnifiedTrack */
async function searchYoutube(query: string): Promise<UnifiedTrack[]> {
  try {
    const response = await fetchWithFallback<any>(
      `/search?q=${encodeURIComponent(query)}&filter=music_songs`,
      { timeout: 6000 }
    )
    const items = response.data.items || []
    return items
      .filter((item: any) => item.type === 'stream')
      .map((item: any): UnifiedTrack => {
        const videoId = extractYoutubeId(item.url || '')
        return {
          id: `yt-${videoId}`,
          nativeId: videoId,
          source: 'youtube',
          title: String(item.title || 'Unknown Title'),
          artist: String(item.uploaderName || 'Unknown Artist'),
          artworkUrl: item.thumbnail ? String(item.thumbnail) : null,
          duration_ms: (Number(item.duration) || 0) * 1000,
          streamUrl: `/api/tracks/stream/yt/${videoId}`, // Resolved to fully-qualified URL on delivery
        }
      })
  } catch (err) {
    console.error('[Tracks Search] YouTube (Piped) fallback failed:', err instanceof Error ? err.message : err)
    return []
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /api/tracks/search?q=<query>&limit=<n>
 * Poly-search: Jamendo + YouTube (Piped) concurrently using Promise.allSettled.
 */
router.get('/tracks/search', searchRateLimiter, async (req: Request, res: Response) => {
  const query = String(req.query.q ?? '').trim()
  if (!query) {
    res.status(400).json({ error: 'MISSING_QUERY', message: 'Search query "q" is required.' })
    return
  }

  // Fire concurrent search queries
  const [jamResult, ytResult] = await Promise.allSettled([
    searchJamendo(query),
    searchYoutube(query),
  ])

  const jamTracks = jamResult.status === 'fulfilled' ? jamResult.value : []
  const ytTracks = ytResult.status === 'fulfilled' ? ytResult.value : []

  // Ensure fully-qualified streamUrls for YouTube tracks using current request host
  const host = req.get('host')
  const protocol = req.protocol
  const mappedYtTracks = ytTracks.map((t) => ({
    ...t,
    streamUrl: `${protocol}://${host}/api/tracks/stream/yt/${t.nativeId}`,
  }))

  // Interleave Jamendo and YouTube results for premium mixed UX
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
 * Retrieve metadata for a single track by its unified polymorphic ID.
 */
router.get('/tracks/:id', apiRateLimiter, async (req: Request, res: Response) => {
  const { id } = req.params
  const host = req.get('host')
  const protocol = req.protocol

  if (id.startsWith('yt-')) {
    const videoId = id.replace('yt-', '')
    try {
      const response = await fetchWithFallback<any>(`/streams/${videoId}`, { timeout: 6000 })
      const data = response.data
      const track: UnifiedTrack = {
        id: `yt-${videoId}`,
        nativeId: videoId,
        source: 'youtube',
        title: String(data.title || 'Unknown YouTube Track'),
        artist: String(data.uploader || 'Unknown Artist'),
        artworkUrl: data.thumbnailUrl ? String(data.thumbnailUrl) : null,
        duration_ms: (Number(data.duration) || 0) * 1000,
        streamUrl: `${protocol}://${host}/api/tracks/stream/yt/${videoId}`,
      }
      res.json({
        headers: { status: 'success', code: 0, error_message: '', results_count: 1 },
        results: [track],
      })
    } catch (err) {
      console.error('[Tracks Fetch] YouTube metadata failed:', err instanceof Error ? err.message : err)
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
      const response = await axios.get(url, { timeout: 6000 })
      const data = response.data as any
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
        title: String(raw.name || 'Unknown Track'),
        artist: String(raw.artist_name || 'Unknown Artist'),
        artworkUrl: raw.image ? String(raw.image) : null,
        duration_ms: (Number(raw.duration) || 0) * 1000,
        streamUrl: String(raw.audio || ''),
      }
      res.json({
        headers: { status: 'success', code: 0, error_message: '', results_count: 1 },
        results: [track],
      })
    } catch (err) {
      console.error('[Tracks Fetch] Jamendo failed:', err instanceof Error ? err.message : err)
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
    const response = await axios.get(url, { timeout: 6000 })
    const data = response.data as any
    const tracks: UnifiedTrack[] = (data.results || []).map((raw: any): UnifiedTrack => ({
      id: `jam-${raw.id}`,
      nativeId: String(raw.id),
      source: 'jamendo',
      title: String(raw.name || 'Unknown Track'),
      artist: String(raw.artist_name || 'Unknown Artist'),
      artworkUrl: raw.image ? String(raw.image) : null,
      duration_ms: (Number(raw.duration) || 0) * 1000,
      streamUrl: String(raw.audio || ''),
    }))
    res.json({
      headers: { status: 'success', code: 0, error_message: '', results_count: tracks.length },
      results: tracks,
    })
  } catch (err) {
    console.error('[Charts] Failed:', err instanceof Error ? err.message : err)
    res.status(502).json({ error: 'BAD_GATEWAY', message: 'Failed to query Jamendo charts.' })
  }
})

/**
 * GET /api/tracks/stream/yt/:videoId
 * Secure audio extractor tunnel: fetches YouTube stream endpoints and pipes
 * binary streams directly through our Node.js environment to resolve CORS
 * issues and rapid expiration blocks.
 */
router.get('/tracks/stream/yt/:videoId', async (req: Request, res: Response) => {
  const { videoId } = req.params

  try {
    const response = await fetchWithFallback<any>(`/streams/${videoId}`, { timeout: 6000 })
    const audioStreams = response.data.audioStreams || []

    if (audioStreams.length === 0) {
      res.status(404).json({ error: 'NO_AUDIO_STREAM', message: 'No audio streams available.' })
      return
    }

    // Sort by bitrate descending and choose the highest bitrate stream
    const sorted = [...audioStreams].sort((a: any, b: any) => (Number(b.bitrate || 0) - Number(a.bitrate || 0)))
    const optimal = sorted.find((s: any) =>
      s.format === 'M4A' || s.format === 'WEBM' || s.codec === 'opus' || s.mimeType?.includes('audio')
    ) || sorted[0]

    if (!optimal || !optimal.url) {
      res.status(404).json({ error: 'NO_STREAM_URL', message: 'Valid stream URL not resolved.' })
      return
    }

    const rawAudioStreamUrl = String(optimal.url)

    // Build headers to pass to stream source (including Range support)
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    if (req.headers.range) {
      headers['Range'] = req.headers.range as string
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
        res.setHeader(k, String(v))
      }
    })

    const stream = streamResponse.data as NodeJS.ReadableStream
    stream.pipe(res)
  } catch (err: any) {
    console.error('[Stream Tunnel Error]', err.message || err)
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
    const response = await axios.get(url, { timeout: 6000 })
    res.json(response.data)
  } catch (err) {
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
    const response = await axios.get(url, { timeout: 6000 })
    res.json(response.data)
  } catch (err) {
    res.status(502).json({ error: 'BAD_GATEWAY', message: 'Failed to search Jamendo artists.' })
  }
})

export default router
