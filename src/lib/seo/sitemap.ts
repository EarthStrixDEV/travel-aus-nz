import { locales, type Locale } from '@/lib/i18n/t'
import { localeUrls, localizedUrl } from './metadata'
import { siteUrl } from './site-url'

export const SITEMAP_KINDS = ['destinations', 'venues', 'gallery', 'dishes'] as const
export type SitemapKind = (typeof SITEMAP_KINDS)[number]

export const isSitemapKind = (s: string): s is SitemapKind => (SITEMAP_KINDS as readonly string[]).includes(s)

export type SitemapEntry = { loc: string; alternates: Record<Locale, string> }

/** Slugs of published attractions (`places`), venues and dishes. */
export type SitemapSlugs = { places: string[]; venues: string[]; dishes?: string[] }

const q = encodeURIComponent

/** One entry per locale for a path; each carries the full th/en alternate set. */
function perLocale(path: string): SitemapEntry[] {
  const alternates = localeUrls(path)
  return locales.map((l) => ({ loc: localizedUrl(l, path), alternates }))
}

/** Bare section pages ride along with their kind so the listing pages themselves are crawlable, not only their deep links. */
export function sitemapEntries(kind: SitemapKind, slugs: SitemapSlugs): SitemapEntry[] {
  switch (kind) {
    case 'destinations':
      return ['', '/map', '/transport', '/money', '/visa', ...slugs.places.map((s) => `/map?place=${q(s)}`)].flatMap(perLocale)
    case 'venues':
      return ['/eat-drink', ...slugs.venues.map((s) => `/eat-drink?venue=${q(s)}`)].flatMap(perLocale)
    case 'gallery':
      return perLocale('/gallery')
    case 'dishes':
      return ['/dishes', ...(slugs.dishes ?? []).map((s) => `/dishes/${q(s)}`)].flatMap(perLocale)
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export function urlsetXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const links = locales.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${esc(e.alternates[l])}"/>`).join('')
      return `<url><loc>${esc(e.loc)}</loc>${links}</url>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>\n`
}

export function sitemapIndexXml(): string {
  const items = SITEMAP_KINDS.map((k) => `<sitemap><loc>${esc(`${siteUrl()}/sitemaps/${k}.xml`)}</loc></sitemap>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>\n`
}
