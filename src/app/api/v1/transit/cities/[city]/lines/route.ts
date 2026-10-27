import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getCityLines } from '@/lib/content/transport'
import { Constants } from '@/lib/supabase/database.types'

const schema = z.object({
  city: z.string().regex(/^[a-z0-9-]{1,80}$/, 'invalid city'),
  mode: z.enum(Constants.public.Enums.transit_mode, 'unknown mode').optional(),
})

/**
 * GET /api/v1/transit/cities/:city/lines?mode= -> { lines: [{ short_name, long_name, mode, stops, end_to_end_min,
 * headway_peak_min, headway_offpeak_min, fare_min, fare_max }] } · 404 unknown city. Cached a day (tag `transport` + CDN).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ city: string }> }) {
  const { city } = await ctx.params
  const query = new URLSearchParams(req.nextUrl.searchParams)
  query.set('city', city)
  const parsed = parseQuery(schema, query)
  if (!parsed.ok) return parsed.response

  try {
    const result = await getCityLines(parsed.data.city, parsed.data.mode)
    if (!result) return apiError('NOT_FOUND', 'City not found', 404)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } })
  } catch (err) {
    console.error('[transit/lines] failed', err)
    return apiError('INTERNAL', 'Transit lines are unavailable', 500)
  }
}
