const DEV_FALLBACK = 'http://localhost:3000'

type Env = { NEXT_PUBLIC_SITE_URL?: string; NODE_ENV?: string }

/**
 * Public origin used for absolute URLs (canonicals, hreflang, sitemaps, JSON-LD). No trailing slash.
 * Unset: `http://localhost:3000` outside production; a production build fails fast instead of
 * shipping localhost URLs to search engines.
 */
export function siteUrl(env: Env = process.env): string {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) {
    if (env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_SITE_URL is required in production (e.g. https://travelausnz.com): it builds the absolute URLs in sitemaps, canonicals and JSON-LD.')
    }
    return DEV_FALLBACK
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL is not a valid absolute URL: "${raw}"`)
  }
  return url.origin + url.pathname.replace(/\/+$/, '')
}
