/**
 * Post-login redirect target. Accepts only same-origin absolute paths:
 * one leading `/`, never `//` or `/\`, and no control characters or backslashes
 * (browsers strip tab/newline from URLs, so `/<TAB>/evil.com` would otherwise
 * become `//evil.com`).
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) return '/'
  if (next[1] === '/') return '/'
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return '/'
  return next
}
