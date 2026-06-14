import { useState, useCallback, useRef } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import { searchTracks } from '../../api/jamendo'
import { Track } from '../../store/playerStore'
import { usePlayerStore } from '../../store/playerStore'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Card } from '../ui/card'
import { Search, Loader2 } from 'lucide-react'

interface SearchBarProps {
  onResultClick?: (track: Track) => void
}

export default function SearchBar({ onResultClick }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { setTrack, play, setQueue } = usePlayerStore()

  // ── 300ms debounced search (PRD §8.3 DoS protection) ──────────────────────
  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const tracks = await searchTracks({ q, limit: 10 })
      // Defensive guard: ensure we never store a non-array in results state
      const safeResults = Array.isArray(tracks) ? tracks : ((tracks as any)?.results || [])
      setResults(safeResults)
      setIsOpen(true)
    } catch (err) {
      setError('Search failed. Check your connection.')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useDebounce(query, 300, performSearch)

  const handleSelect = (track: Track) => {
    setTrack(track)
    setQueue(results, results.findIndex((t) => t.id === track.id))
    play()
    setIsOpen(false)
    onResultClick?.(track)
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Close only if focus leaves the container entirely
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setTimeout(() => setIsOpen(false), 150)
    }
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = (sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Defensive normalisation outside JSX — TypeScript can infer Track[] from state type
  const normalizedResults: Track[] = Array.isArray(results)
    ? results
    : ((results as any)?.results ?? [])

  return (
    <div ref={containerRef} className="relative w-full max-w-xl" onBlur={handleBlur}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        
        <Input
          id="track-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists, tracks, albums…"
          className="pl-9 pr-10 bg-background"
          aria-label="Search music"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          autoComplete="off"
        />

        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <Card
          role="listbox"
          aria-label="Search results"
          className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden shadow-card"
        >
          <ScrollArea className="max-h-80 w-full">
            {error ? (
              <div className="p-4 text-sm text-destructive text-center">{error}</div>
            ) : normalizedResults.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">No tracks found</div>
            ) : (
              <div className="flex flex-col p-1">
                {normalizedResults.map((track) => (
                  <button
                    key={track.id}
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelect(track)}
                    className="w-full flex items-center justify-between p-2 hover:bg-accent hover:text-accent-foreground text-left rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 rounded">
                        <AvatarImage src={track.image || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100'} alt={track.name} />
                        <AvatarFallback className="rounded bg-muted">M</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h5 className="font-medium text-sm truncate max-w-[280px]">{track.name}</h5>
                        <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-2 truncate">
                          {track.artist_name}
                          {track.source === 'youtube' && (
                            <span className="bg-destructive/20 text-destructive px-1 rounded-[2px] text-[9px] font-bold tracking-wider">LIVE</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs flex-shrink-0 ml-2">
                      {formatDuration(track.duration)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      )}
    </div>
  )
}
