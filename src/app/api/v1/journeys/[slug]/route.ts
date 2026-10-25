import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { cachedContent } from '@/lib/content/cache'
import { getJourneyDetail } from '@/lib/content/journeys'
import { createPublicClient } from '@/lib/supabase/public'

const schema = z.object({
  locale: z.enum(['th', 'en']).default('th'),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/, 'invalid slug'),
})

/** GET /api/v1/journeys/:slug?locale= -> journey card + itinerary [{ day, legs }] */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const query = new URLSearchParams(req.nextUrl.searchParams)
  query.set('slug', slug)
  const parsed = parseQuery(schema, query)
  if (!parsed.ok) return parsed.response

  try {
    const journey = await cachedContent(['journey', parsed.data.locale, parsed.data.slug], 'home', () =>
      getJourneyDetail(createPublicClient(), parsed.data.locale, parsed.data.slug),
    )()
    if (!journey) return apiError('NOT_FOUND', 'Journey not found', 404)
    return NextResponse.json(journey)
  } catch (err) {
    console.error('[journeys] detail failed', err)
    return apiError('INTERNAL', 'Journey is unavailable', 500)
  }
}
