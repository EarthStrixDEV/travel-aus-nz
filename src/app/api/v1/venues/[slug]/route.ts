import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getVenue } from '@/lib/content/venues'

const schema = z.object({
  locale: z.enum(['th', 'en']).default('th'),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/, 'invalid slug'),
})

/** GET /api/v1/venues/:slug?locale= -> VenueCard detail (cached, tag `venues`). Closed or unpublished venues are 404. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const query = new URLSearchParams(req.nextUrl.searchParams)
  query.set('slug', slug)
  const parsed = parseQuery(schema, query)
  if (!parsed.ok) return parsed.response

  try {
    const venue = await getVenue(parsed.data.slug, parsed.data.locale)
    if (!venue) return apiError('NOT_FOUND', 'Venue not found', 404)
    return NextResponse.json(venue)
  } catch (err) {
    console.error('[venues] detail failed', err)
    return apiError('INTERNAL', 'Venue is unavailable', 500)
  }
}
