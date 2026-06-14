import DOMPurify from 'dompurify'

/**
 * sanitize.ts — XSS prevention wrapper around DOMPurify.
 *
 * Security audit (SAST §4):
 * All user-generated content MUST pass through sanitize() before
 * being stored in state or rendered. React JSX escapes strings by
 * default — we sanitize defensively for belt-and-suspenders safety.
 */

/**
 * Sanitize a user-generated string to plain text.
 * Strips all HTML tags, preserving only text content.
 */
export function sanitize(input: string): string {
  if (typeof input !== 'string') return ''
  const cleaned = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [] as string[],
    ALLOWED_ATTR: [] as string[],
    KEEP_CONTENT: true,
  })
  return cleaned.trim().slice(0, 500)
}

/**
 * Sanitize a username — alphanumeric + common chars only.
 */
export function sanitizeUsername(input: string): string {
  if (typeof input !== 'string') return 'Anonymous'
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [] as string[],
    ALLOWED_ATTR: [] as string[],
    KEEP_CONTENT: true,
  })
    .replace(/[^\w\s\-_.]/g, '')
    .trim()
    .slice(0, 32) || 'Anonymous'
}

/**
 * Sanitize a URL — only allow http/https schemes.
 * Returns empty string for javascript: or data: URIs.
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return ''
  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [] as string[],
    ALLOWED_ATTR: [] as string[],
  })
}
