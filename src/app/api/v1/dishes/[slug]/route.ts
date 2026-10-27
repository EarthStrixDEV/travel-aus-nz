import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getDish } from '@/lib/content/dishes'
import { pickVenueRegion } from '@/lib/dishes/filter'

const schema = z.object({
  locale: z.enum(['th', 'en']).default('th'),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/, 'invalid slug'),
  region: z.string().regex(/^[a-z0-9-]{1,60}$/, 'invalid region').optional(),
})

/**
 * GET /api/v1/dishes/:slug?locale=&region= -> detail + pairings + the venues of that region (or the dish's home
 * region, see `pickVenueRegion`). Unknown or unpublished dishes are 404.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const query = new URLSearchParams(req.nextUrl.searchParams)
  query.set('slug', slug)
  const parsed = parseQuery(schema, query)
  if (!parsed.ok) return parsed.response

  try {
    const dish = await getDish(parsed.data.slug, parsed.data.locale)
    if (!dish) return apiError('NOT_FOUND', 'Dish not found', 404)
    const { venuesByRegion, ...rest } = dish
    const where = pickVenueRegion(venuesByRegion, parsed.data.region, dish.region?.slug ?? null)
    return NextResponse.json({ ...rest, region_venues: where })
  } catch (err) {
    console.error('[dishes] detail failed', err)
    return apiError('INTERNAL', 'Dish is unavailable', 500)
  }
}
