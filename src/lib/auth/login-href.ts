import { safeNextPath } from './safe-next'

/**
 * Locale-less login href for the i18n `Link` (which adds the locale prefix).
 * `pathname` is the real, locale-prefixed URL path; `search` may start with `?`.
 */
export function loginHref(pathname: string, search: string): string {
  const query = search.replace(/^\?/, '')
  const next = safeNextPath(query ? `${pathname}?${query}` : pathname)
  return `/login?next=${encodeURIComponent(next)}`
}
