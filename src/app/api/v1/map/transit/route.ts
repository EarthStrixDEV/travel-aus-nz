import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { cachedContent } from '@/lib/content/cache'
import { loadTransit } from '@/lib/content/places'
import { createPublicClient } from '@/lib/supabase/public'

const MODES = ['train', 'metro', 'tram', 'bus', 'coach', 'ferry', 'walk'] as const

const schema = z.object({
  city_id: z.coerce.number('city_id must be a number').int('city_id must be an integer').positive('city_id must be positive'),
  // Comma-joined by `normalise` from `modes[]=a&modes[]=b`.
  modes: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : []))
    .pipe(z.array(z.enum(MODES, 'unknown mode')).max(MODES.length)),
})

function normalise(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(params)
  const modes = [...params.getAll('modes[]'), ...params.getAll('modes')].filter(Boolean)
  out.delete('modes[]')
  out.delete('modes')
  if (modes.length) out.set('modes', [...new Set(modes)].join(','))
  return out
}

/** GET /api/v1/map/transit?city_id=&modes[]= -> { lines: GeoJSON (shape, mode, short_name), stations: GeoJSON } */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, normalise(req.nextUrl.searchParams))
  if (!parsed.ok) return parsed.response
  const { city_id, modes } = parsed.data

  try {
    const body = await cachedContent(['map-transit', String(city_id), [...modes].sort().join(',')], 'map', () =>
      loadTransit(createPublicClient(), city_id, modes),
    )()
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('[map] transit failed', err)
    return apiError('INTERNAL', 'Transit is unavailable', 500)
  }
}
