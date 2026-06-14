import { useEffect, useRef } from 'react'

/**
 * useDebounce — fires callback after `delay` ms of no changes to `value`.
 * Used for search input (300ms) per PRD §8.3 DoS protection.
 */
export function useDebounce<T>(
  value: T,
  delay: number,
  callback: (val: T) => void
): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const timer = setTimeout(() => {
      callbackRef.current(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])
}
