import { getSeoPlaces } from '@/lib/content/seo'
import { isSitemapKind, SITEMAP_KINDS, sitemapEntries, urlsetXml, type SitemapKind } from '@/lib/seo/sitemap'

// Served at /sitemaps/<kind>.xml. Static with hourly ISR; the places are cached under the `map` / `venues` tags.
export const dynamic = 'force-static'
export const dynamicParams = false
export const revalidate = 3600

export function generateStaticParams() {
  return SITEMAP_KINDS.map((k) => ({ kind: `${k}.xml` }))
}

async function slugsFor(kind: SitemapKind) {
  // Slugs are locale-independent; `en` is only the cache key.
  const [places, venues] = await Promise.all([
    kind === 'destinations' ? getSeoPlaces('attractions', 'en') : [],
    kind === 'venues' ? getSeoPlaces('venues', 'en') : [],
  ])
  return { places: places.map((p) => p.slug), venues: venues.map((p) => p.slug) }
}

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const kind = (await params).kind.replace(/\.xml$/, '')
  if (!isSitemapKind(kind)) return new Response('Not found', { status: 404 })
  return new Response(urlsetXml(sitemapEntries(kind, await slugsFor(kind))), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
