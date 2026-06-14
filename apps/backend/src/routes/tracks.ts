import { Router, Request, Response } from 'express'
import { apiRateLimiter, searchRateLimiter } from '../middleware/rateLimiter.js'
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

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

// ─── Multi-Instance Resiliency Pools ──────────────────────────────────────────

// Dynamic working pools (Hydrated automatically on startup)
export let PIPED_INSTANCES: string[] = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.owo.si'
]

export let INVIDIOUS_INSTANCES: string[] = [
  'https://iv.melmac.space',
  'https://invidious.flokinet.to',
  'https://inv.riverside.rocks'
]

/**
 * Global Discovery Sync Engine
 * Fetches the highest uptime verified public API domains directly from official registries
 */
export async function initializeDynamicMusicPools(): Promise<void> {
  console.log('[Wavy Engine] Initializing public scraping node synchronization...')
  
  // 1. Sync Live Piped Nodes
  try {
    const res = await axios.get('https://raw.githubusercontent.com/TeamPiped/piped-uptime/master/.upptimerc.yml', { timeout: 4000 })
    const rawYaml = typeof res.data === 'string' ? res.data : String(res.data)
    const matches = rawYaml.match(/url:\s*(https:\/\/pipedapi[^\s]+|https:\/\/api\.piped[^\s]+)/g)
    if (matches) {
      const freshPiped: string[] = matches
        .map((m: string) => m.replace('url:', '').trim().replace('/healthcheck', ''))
        .slice(0, 6)
      if (freshPiped.length > 0) {
        PIPED_INSTANCES = freshPiped
        console.log(`[Wavy Engine] Synchronized ${PIPED_INSTANCES.length} live, high-uptime Piped instances.`)
      }
    }
  } catch (err) {
    console.warn('[Wavy Engine] Piped registry unreachable, falling back to local pool defaults.')
  }

  // 2. Sync Live Invidious Nodes
  try {
    const res = await axios.get('https://invidious.io/api/v1/instances', { timeout: 4000 })
    const instancesData = Array.isArray(res.data) ? res.data : []
    const activeInstances: string[] = instancesData
      .filter((inst: any) => inst && Array.isArray(inst) && inst[1] && inst[1].api === true && inst[1].type === 'https')
      .map((inst: any) => `https://${inst[0]}`)
      .slice(0, 6)

    if (activeInstances.length > 0) {
      INVIDIOUS_INSTANCES = activeInstances
      console.log(`[Wavy Engine] Synchronized ${INVIDIOUS_INSTANCES.length} live, unblocked Invidious instances.`)
    }
  } catch (err) {
    console.warn('[Wavy Engine] Invidious registry offline, relying on local pool defaults.')
  }
}

// Automatically fire synchronization on backend bootstrap initialization
initializeDynamicMusicPools()

interface PipedSearchItem {
  url?: string
  id?: string
  type?: string
  title?: string
  thumbnail?: string
  thumbnailUrl?: string
  duration?: number
  uploaderName?: string
  artist?: string
}

interface PipedSearchResponse {
  items?: PipedSearchItem[]
}

interface PipedAudioStream {
  url?: string
  bitrate?: number
  format?: string
  codec?: string
  mimeType?: string
}

interface PipedStreamResponse {
  title?: string
  uploader?: string
  thumbnailUrl?: string
  duration?: number
  audioStreams?: PipedAudioStream[]
}

/**
 * Hardened network fallback requester that rotates sequentially through Piped instances
 * to bypass rate limiting (429) or forbidden blocks (403), catching network failures gracefully.
 */
async function fetchFromPipedWithFallback<T = any>(
  endpoint: string,
  params?: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  let lastError: any = new Error('No Piped instances available')

  for (const instance of PIPED_INSTANCES) {
    const url = `${instance}${endpoint}`
    try {
      const response = await axios.get<T>(url, {
        ...params,
        timeout: 3000, // Enforce strict 3000ms timeout
      })

      if (response.status === 200) {
        return response
      }
    } catch (err: any) {
      const errorCode = err.code || (err.response ? String(err.response.status) : 'UNKNOWN')
      console.warn(`Piped Node [${url}] failed connectivity check (${errorCode})`)
      lastError = err instanceof Error ? err : new Error(String(err))
      
      // Explicitly catch networking errors and continue loop
      if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.response) {
        continue
      }
      continue
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
  Object.entries(params).forEach(([k, v]: [string, string]) => url.searchParams.set(k, v))
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

/**
 * Hardened multi-engine handler: Queries Piped first, then falls back 
 * to Invidious if public Piped nodes fail or return empty results.
 */
async function searchYoutube(query: string, protocol: string, host: string): Promise<UnifiedTrack[]> {
  // 1. TACTIC A: Try Piped Instances
  try {
    const response = await fetchFromPipedWithFallback<PipedSearchResponse>(
      `/search?q=${encodeURIComponent(query)}&filter=music_songs`
    )
    
    const rawData = response.data as any
    const items = Array.isArray(rawData) ? rawData : (rawData ? (rawData.items || []) : [])
    
    if (items.length > 0) {
      const validItems: UnifiedTrack[] = []
      items.forEach((item: any) => {
        const duration = Number(item.duration) || 0
        if (duration > 0 && (item.type === 'stream' || item.type === 'song' || !item.type)) {
          const videoId = extractYoutubeId(item.url || item.id || '')
          if (videoId) {
            validItems.push({
              id: `yt-${videoId}`,
              nativeId: videoId,
              source: 'youtube',
              title: String(item.title || 'Unknown Title'),
              artist: String(item.uploaderName || item.artist || 'Unknown Artist'),
              artworkUrl: item.thumbnail || item.thumbnailUrl ? String(item.thumbnail || item.thumbnailUrl) : null,
              duration_ms: duration * 1000,
              streamUrl: `${protocol}://${host}/api/tracks/stream/yt/${videoId}`, 
            })
          }
        }
      })
      if (validItems.length > 0) return validItems
    }
    console.warn('[Tracks Search] Piped resolved but returned an empty list. Dropping to Invidious Fallback.')
  } catch (err) {
    console.warn('[Tracks Search] Piped engine exhausted. Triggering Invidious fallback network block...')
  }

  // 2. TACTIC B: Invidious Engine Fallback (The Ultimate Safety Net)
  for (const invBase of INVIDIOUS_INSTANCES) {
    try {
      // Invidious API public search endpoint
      const invResponse = await axios.get(`${invBase}/api/v1/search`, {
        params: { q: query, type: 'video' },
        timeout: 3000
      })

      const invItems = invResponse.data || []
      if (invItems.length === 0) continue

      const validInvItems: UnifiedTrack[] = []
      invItems.forEach((item: any) => {
        const duration = Number(item.lengthSeconds) || 0
        if (duration > 0) {
          validInvItems.push({
            id: `yt-${item.videoId}`,
            nativeId: item.videoId,
            source: 'youtube',
            title: String(item.title || 'Unknown Title'),
            artist: String(item.author || 'Unknown Artist'),
            artworkUrl: item.videoThumbnails?.[0]?.url || null,
            duration_ms: duration * 1000,
            streamUrl: `${protocol}://${host}/api/tracks/stream/yt/${item.videoId}`
          })
        }
      })

      if (validInvItems.length > 0) {
        console.log(`[Tracks Search] Successfully recovered stream catalog using Invidious node: [${invBase}]`)
        return validInvItems
      }
    } catch (invErr: any) {
      console.warn(`Invidious Node [${invBase}] failed to respond. Rotating...`)
    }
  }

  // If both scraping engine protocols are entirely blocked, return a safe empty set
  return []
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

  const protocol = req.protocol
  const host = req.get('host') || 'localhost:3001'

  // Fire concurrent search queries
  const [jamResult, ytResult] = await Promise.allSettled([
    searchJamendo(query),
    searchYoutube(query, protocol, host),
  ])

  const jamTracks = jamResult.status === 'fulfilled' ? jamResult.value : []
  const ytTracks = ytResult.status === 'fulfilled' ? ytResult.value : []

  // Ensure fully-qualified streamUrls for YouTube tracks using current request host
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

  res.json(results)
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
      const response = await fetchFromPipedWithFallback<PipedStreamResponse>(`/streams/${videoId}`)
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
 * Hardened Trending Engine: Extracts real-time global charts.
 * Uses Piped's music feed spec with multi-path Invidious fallback.
 * Strictly filters out live streams and uses Jamendo as an absolute failsafe.
 */
router.get('/charts', apiRateLimiter, async (req: Request, res: Response): Promise<void> => {
  const host = req.get('host')
  const protocol = req.protocol
  let tracks: UnifiedTrack[] = []

  // TACTIC A: Query Piped — try updated music feed spec
  const PIPED_CHART_PATHS = [
    '/feed/trending?filter=music',  // Spec-specified music feed path
  ]

  for (const chartPath of PIPED_CHART_PATHS) {
    try {
      const response = await fetchFromPipedWithFallback<any>(chartPath)
      const rawItems = Array.isArray(response.data) ? response.data : (response.data?.items || [])

      if (rawItems.length > 0) {
        rawItems.slice(0, 40).forEach((item: any) => {
          const duration = Number(item.duration) || 0
          // Block live streams and non-music videos
          if (duration > 0 && item.type !== 'channel') {
            const videoId = extractYoutubeId(item.url || item.id || '')
            if (videoId) {
              tracks.push({
                id: `yt-${videoId}`,
                nativeId: videoId,
                source: 'youtube',
                title: String(item.title || 'Trending Track'),
                artist: String(item.uploaderName || item.artist || 'Commercial Artist'),
                artworkUrl: item.thumbnail || item.thumbnailUrl || null,
                duration_ms: duration * 1000,
                streamUrl: `${protocol}://${host}/api/tracks/stream/yt/${videoId}`
              })
            }
          }
        })

        if (tracks.length > 0) {
          res.json(tracks.slice(0, 20))
          return
        }
      }
    } catch (pipedErr) {
      console.warn(`[Charts Engine] Piped path [${chartPath}] failed. Trying next path...`)
    }
  }

  // TACTIC B: Invidious trending fallback (/api/v1/trending?type=music)
  if (tracks.length === 0) {
    for (const invBase of INVIDIOUS_INSTANCES) {
      try {
        const invResponse = await axios.get(`${invBase}/api/v1/trending`, {
          params: { type: 'music' },
          timeout: 3000
        })

        const invItems = invResponse.data || []
        if (invItems.length === 0) continue

        invItems.slice(0, 40).forEach((item: any) => {
          const duration = Number(item.lengthSeconds) || 0
          // Filter out live streams
          if (duration > 0) {
            tracks.push({
              id: `yt-${item.videoId}`,
              nativeId: item.videoId,
              source: 'youtube',
              title: String(item.title || 'Trending Track'),
              artist: String(item.author || 'Commercial Artist'),
              artworkUrl: item.videoThumbnails?.[0]?.url || null,
              duration_ms: duration * 1000,
              streamUrl: `${protocol}://${host}/api/tracks/stream/yt/${item.videoId}`
            })
          }
        })

        if (tracks.length > 0) {
          console.log(`[Charts Engine] Successfully recovered trending view via Invidious mirror: [${invBase}]`)
          res.json(tracks.slice(0, 20))
          return
        }
      } catch (invErr) {
        continue
      }
    }
  }

  // TACTIC C: Absolute Safety Valve — Jamendo Popularity Charts
  // Ensures the frontend NEVER renders an empty list
  if (tracks.length === 0 && CLIENT_ID) {
    try {
      console.log(`[Charts Engine] YouTube scrapers exhausted. Fetching Jamendo weekly popularity...`)
      const url = jamendoUrl('/tracks/', {
        limit: '20',
        order: 'popularity_week',
        imagesize: '200',
        audioformat: 'mp32'
      })
      const response = await axios.get(url, { timeout: 6000 })
      const data = response.data as any
      
      const jamTracks: UnifiedTrack[] = (data.results || []).map((raw: any) => ({
        id: `jam-${raw.id}`,
        nativeId: raw.id,
        source: 'jamendo',
        title: String(raw.name || 'Unknown Track'),
        artist: String(raw.artist_name || 'Unknown Artist'),
        artworkUrl: raw.image ? String(raw.image) : null,
        duration_ms: (Number(raw.duration) || 0) * 1000,
        streamUrl: String(raw.audio || ''),
      }))

      if (jamTracks.length > 0) {
        res.json(jamTracks)
        return
      }
    } catch (jamErr) {
      console.error(`[Charts Engine] Jamendo fallback also failed!`)
    }
  }

  // Final Safety Valve: Return flat empty array instead of timing out
  res.json([])
})

/**
 * GET /api/tracks/stream/yt/:videoId
 * Server-side audio proxy engine.
 * PRIMARY: ytdl-core pipes YouTube CDN audio directly — no CORS, no third-party redirects.
 * FALLBACK: Invidious/Piped pool for 302 redirect if ytdl fails.
 */
router.get('/tracks/stream/yt/:videoId', async (req: Request, res: Response): Promise<void> => {
  const { videoId } = req.params
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`

  // ── TACTIC A: yt-dlp — most reliable, handles Shorts + modern signatures ──
  try {
    const ytdlpCmd = process.platform === 'win32' ? 'python' : 'python3'
    const ytdlpArgs = [
      '-m', 'yt_dlp',
      '--get-url',
      '--format', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
      '--no-warnings',
      '--no-playlist',
      '--socket-timeout', '8',
      `https://www.youtube.com/watch?v=${videoId}`,
    ]

    const { stdout } = await execFileAsync(ytdlpCmd, ytdlpArgs, { timeout: 12000 })
    const cdnUrl = stdout.trim().split('\n')[0]  // first URL line

    if (cdnUrl && cdnUrl.startsWith('https://')) {
      console.log(`[Stream Engine] yt-dlp resolved [${videoId}] → CDN redirect`)
      res.redirect(302, cdnUrl)
      return
    }
  } catch (ytdlpErr: any) {
    console.warn(`[Stream Engine] yt-dlp failed for [${videoId}]: ${ytdlpErr.message?.split('\n')[0] || ytdlpErr}`)
  }

  // ── TACTIC B: Invidious/Piped fallback pool (302 redirect) ───────────────
  const STREAM_FALLBACK_POOL = [
    'https://invidious.flokinet.to',
    'https://inv.riverside.rocks',
    'https://iv.melmac.space',
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.owo.si'
  ]

  for (const baseUrl of STREAM_FALLBACK_POOL) {
    try {
      if (baseUrl.includes('invidious') || baseUrl.includes('iv.') || baseUrl.includes('inv.')) {
        const invResponse = await axios.get(`${baseUrl}/api/v1/videos/${videoId}`, {
          timeout: 3000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          validateStatus: (s) => s === 200,
        })

        if (String(invResponse.headers['content-type'] ?? '').includes('application/json')) {
          const adaptiveFormats = invResponse.data.adaptiveFormats || []
          const optimalAudio = adaptiveFormats.find((f: any) => f.type?.includes('audio/'))
          if (optimalAudio?.url && !res.headersSent) {
            console.log(`[Stream Engine] Fallback redirect via Invidious: [${baseUrl}]`)
            res.redirect(302, String(optimalAudio.url))
            return
          }
        }
      } else {
        const manifestResponse = await axios.get(`${baseUrl}/streams/${videoId}`, {
          timeout: 3000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          validateStatus: (s) => s === 200,
        })

        const audioStreams: PipedAudioStream[] = manifestResponse.data.audioStreams || []
        if (audioStreams.length > 0) {
          const best = [...audioStreams].sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0]
          if (best?.url && !res.headersSent) {
            console.log(`[Stream Engine] Fallback redirect via Piped: [${baseUrl}]`)
            res.redirect(302, String(best.url))
            return
          }
        }
      }
    } catch (err: any) {
      console.warn(`[Stream Engine] Fallback node [${baseUrl}] skipped: ${err.code || err.response?.status || 'TIMEOUT'}`)
      continue
    }
  }

  // ── TACTIC C: Absolute worst case — 503 instead of misleading YouTube redirect
  if (!res.headersSent) {
    console.error(`[Stream Engine] All tiers exhausted for [${videoId}]. Returning 503.`)
    res.status(503).json({
      error: 'STREAM_UNAVAILABLE',
      message: 'Audio stream could not be resolved from any available source.',
      videoId,
    })
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
