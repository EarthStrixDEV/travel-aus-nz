import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    // Signed-in pages (trip, prepare) and read-only share links are user data, never indexed.
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...['admin', 'trip', 'prepare', 'shared'].flatMap((p) => [`/th/${p}`, `/en/${p}`])],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
