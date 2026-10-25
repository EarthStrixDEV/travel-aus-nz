import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { rateLimit } from '@/lib/api/rate-limit'
import { parseQuery } from '@/lib/api/validate'
import { createPublicClient } from '@/lib/supabase/public'

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/, 'invalid slug')

const schema = z.object({
  q: z.string().trim().min(2, 'q must be 2 to 80 characters').max(80, 'q must be 2 to 80 characters'),
  locale: z.enum(['th', 'en']).default('th'),
  region: slug.optional(),
  month: z.coerce.number().int().min(1, 'month must be 1 to 12').max(12, 'month must be 1 to 12').optional(),
  // Comma-joined by `normalise` from `interests[]=a&interests[]=b`.
  interests: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : []))
    .pipe(z.array(slug).max(10, 'at most 10 interests')),
})

/** Folds the repeated `interests[]` / `interests` keys into one comma-joined value (parseQuery keeps one value per key). */
function normalise(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(params)
  const interests = [...params.getAll('interests[]'), ...params.getAll('interests')].filter(Boolean)
  out.delete('interests[]')
  out.delete('interests')
  if (interests.length) out.set('interests', interests.join(','))
  return out
}

/** GET /api/v1/search?q=&locale=&region=&month=&interests[]= -> { results: [{ kind, slug, name, sub }] } */
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, { limit: 30, window: '1 m', prefix: 'search' })
  if (limited) return limited

  const parsed = parseQuery(schema, normalise(req.nextUrl.searchParams))
  if (!parsed.ok) return parsed.response
  const { q, locale, region, month, interests } = parsed.data

  const { data, error } = await createPublicClient().rpc('search_content', {
    q,
    p_locale: locale,
    p_region: region,
    p_month: month,
    p_interests: interests.length ? interests : undefined,
  })
  if (error) {
    console.error('[search] search_content failed', error)
    return apiError('INTERNAL', 'Search is unavailable', 500)
  }
  return NextResponse.json({ results: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}
