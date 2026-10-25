import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getPlace } from '@/lib/content/places'

const schema = z.object({
  locale: z.enum(['th', 'en']).default('th'),
  slug: z.string().regex(/^[a-z0-9-]{1,120}$/, 'invalid slug'),
})

/** GET /api/v1/places/:slug?locale= -> detail + nearest stops (<= 3) + walk geometry + isOpenNow (detail cached, tag `map`). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const query = new URLSearchParams(req.nextUrl.searchParams)
  query.set('slug', slug)
  const parsed = parseQuery(schema, query)
  if (!parsed.ok) return parsed.response

  try {
    const place = await getPlace(parsed.data.slug, parsed.data.locale)
    if (!place) return apiError('NOT_FOUND', 'Place not found', 404)
    return NextResponse.json(place)
  } catch (err) {
    console.error('[places] detail failed', err)
    return apiError('INTERNAL', 'Place is unavailable', 500)
  }
}
