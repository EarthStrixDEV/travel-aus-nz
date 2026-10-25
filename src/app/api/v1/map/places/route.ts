import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getMapPlaces, parseBbox, PLACE_TYPES } from '@/lib/content/places'
import { createPublicClient } from '@/lib/supabase/public'

const schema = z.object({
  bbox: z.string('bbox is required').transform((s, ctx) => {
    const box = parseBbox(s)
    if (!box) {
      ctx.addIssue({ code: 'custom', message: 'invalid bbox' })
      return z.NEVER
    }
    return box
  }),
  zoom: z.coerce.number('zoom must be a number').min(0, 'zoom must be 0-22').max(22, 'zoom must be 0-22').transform(Math.floor),
  // Comma-joined by `normalise` from `types[]=a&types[]=b`.
  types: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : []))
    .pipe(z.array(z.enum(PLACE_TYPES, 'unknown place type')).max(PLACE_TYPES.length)),
  locale: z.enum(['th', 'en']).default('th'),
})

function normalise(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(params)
  const types = [...params.getAll('types[]'), ...params.getAll('types')].filter(Boolean)
  out.delete('types[]')
  out.delete('types')
  if (types.length) out.set('types', [...new Set(types)].join(','))
  return out
}

/**
 * GET /api/v1/map/places?bbox=minLng,minLat,maxLng,maxLat&zoom=&types[]=&locale=
 * zoom < 13 -> { level: 'clusters', clusters, counts }; >= 13 -> { level: 'places', features (<= 500), counts }.
 * Viewports are unbounded, so this relies on the CDN (s-maxage) rather than the data cache.
 */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, normalise(req.nextUrl.searchParams))
  if (!parsed.ok) return parsed.response

  try {
    const body = await getMapPlaces(createPublicClient(), parsed.data)
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600' },
    })
  } catch (err) {
    console.error('[map] places failed', err)
    return apiError('INTERNAL', 'Map places are unavailable', 500)
  }
}
