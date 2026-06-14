import React, { useRef, useCallback } from 'react'

interface ProgressBarProps {
  position: number   // seconds
  duration: number   // seconds
  onSeek: (seconds: number) => void
  disabled?: boolean
}

export default function ProgressBar({ position, duration, onSeek, disabled }: ProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const getSeekValue = useCallback((clientX: number): number => {
    const bar = barRef.current
    if (!bar || !duration) return 0
    const { left, width } = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - left) / width))
    return pct * duration
  }, [duration])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    isDragging.current = true
    onSeek(getSeekValue(e.clientX))

    const handleMouseMove = (ev: MouseEvent) => {
      if (isDragging.current) onSeek(getSeekValue(ev.clientX))
    }
    const handleMouseUp = (ev: MouseEvent) => {
      if (isDragging.current) {
        onSeek(getSeekValue(ev.clientX))
        isDragging.current = false
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Track progress"
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-disabled={disabled}
      onMouseDown={handleMouseDown}
      className={`
        relative flex-1 h-1.5 rounded-full group
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
        bg-surface-border
      `}
    >
      {/* Fill */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-brand-500 transition-none"
        style={{ width: `${pct}%` }}
      />
      {/* Thumb */}
      <div
        className={`
          absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow
          opacity-0 group-hover:opacity-100 transition-opacity duration-150
          ${disabled ? '' : 'cursor-pointer'}
        `}
        style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
      />
    </div>
  )
}
