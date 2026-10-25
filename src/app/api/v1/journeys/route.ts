import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { paginationSchema } from '@/lib/api/cursor'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { cachedContent } from '@/lib/content/cache'
import { listJourneys } from '@/lib/content/journeys'
import { createPublicClient } from '@/lib/supabase/public'

const MODES = ['train', 'metro', 'tram', 'bus', 'coach', 'ferry', 'walk'] as const

const schema = paginationSchema.extend({
  country: z.enum(['au', 'nz']).optional(),
  locale: z.enum(['th', 'en']).default('th'),
  // Comma-joined by `normalise` from `mode[]=a&mode[]=b`.
  mode: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : []))
    .pipe(z.array(z.enum(MODES, 'unknown mode')).max(MODES.length)),
})

function normalise(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(params)
  const modes = [...params.getAll('mode[]'), ...params.getAll('mode')].filter(Boolean)
  out.delete('mode[]')
  out.delete('mode')
  if (modes.length) out.set('mode', modes.join(','))
  return out
}

/** GET /api/v1/journeys?country=&mode[]=&cursor=&limit=&locale= -> { items: JourneyCard[], nextCursor } */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, normalise(req.nextUrl.searchParams))
  if (!parsed.ok) return parsed.response
  const { country, locale, mode, cursor, limit } = parsed.data

  try {
    const page = await cachedContent(
      ['journeys', locale, country ?? '', mode.join(','), String(cursor?.sort ?? ''), String(limit)],
      'home',
      () => listJourneys(createPublicClient(), locale, { country, modes: mode, cursor, limit }),
    )()
    return NextResponse.json(page)
  } catch (err) {
    console.error('[journeys] list failed', err)
    return apiError('INTERNAL', 'Journeys are unavailable', 500)
  }
}
