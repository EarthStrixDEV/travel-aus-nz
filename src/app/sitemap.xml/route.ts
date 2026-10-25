import { sitemapIndexXml } from '@/lib/seo/sitemap'

// `sitemap.ts` can only emit a <urlset>, so the index is a route handler at the same URL.
export const dynamic = 'force-static'

export function GET() {
  return new Response(sitemapIndexXml(), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } })
}
