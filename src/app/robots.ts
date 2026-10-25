import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/th/admin', '/en/admin', '/api/'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
