import React from 'react'
import { Slider } from '../ui/slider'

interface ProgressBarProps {
  position: number   // seconds
  duration: number   // seconds
  onSeek: (seconds: number) => void
  disabled?: boolean
}

export default function ProgressBar({ position, duration, onSeek, disabled }: ProgressBarProps) {
  const safePosition = Number.isFinite(position) ? position : 0
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 100 // fallback max

  return (
    <Slider
      value={[safePosition]}
      max={safeDuration}
      step={0.1}
      disabled={disabled}
      onValueChange={(vals) => {
        if (Array.isArray(vals) && vals.length > 0) {
          onSeek(vals[0])
        } else if (typeof vals === 'number') {
          onSeek(vals)
        }
      }}
      className={`flex-1 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      aria-label="Track progress"
    />
  )
}
