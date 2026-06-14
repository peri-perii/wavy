import { useState, useCallback, useRef } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import { searchTracks } from '../../api/jamendo'
import { Track } from '../../store/playerStore'
import { usePlayerStore } from '../../store/playerStore'

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
      setResults(tracks)
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

  return (
    <div ref={containerRef} className="relative w-full max-w-xl" onBlur={handleBlur}>
      {/* Input */}
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          id="track-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists, tracks, albums…"
          className="input pl-9 pr-4"
          aria-label="Search music"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          autoComplete="off"
        />

        {isLoading && (
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin w-4 h-4 text-brand-500"
            viewBox="0 0 24 24" fill="none"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
          </svg>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Search results"
          className="
            absolute top-full left-0 right-0 mt-2 z-50
            glass-card rounded-xl overflow-hidden
            max-h-80 overflow-y-auto
            animate-fade-in shadow-card
          "
        >
          {error ? (
            <div className="p-4 text-sm text-rose-400 text-center">{error}</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No tracks found</div>
          ) : (
            results.map((track) => (
              <button
                key={track.id}
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(track)}
                className="w-full track-card text-left border-b border-surface-border/50 last:border-0"
              >
                <img
                  src={track.image || '/placeholder-art.png'}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover bg-surface-raised flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{track.name}</p>
                  <p className="text-xs text-gray-400 truncate">{track.artist_name}</p>
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatDuration(track.duration)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
