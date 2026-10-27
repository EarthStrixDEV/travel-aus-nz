import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { rateLimit } from '@/lib/api/rate-limit'
import { parseQuery } from '@/lib/api/validate'
import { redisRouteCache } from '@/lib/routing/cache'
import { googleRoutes } from '@/lib/routing/google'
import { parsePointParam, planRoute } from '@/lib/routing/plan'
import { createPublicClient } from '@/lib/supabase/public'

const MODES = ['train', 'metro', 'tram', 'bus', 'coach', 'ferry', 'walk'] as const

const endpoint = z
  .string()
  .trim()
  .refine(
    (s) => /^[a-z0-9-]{1,80}$/.test(s) || parsePointParam(s) !== null,
    'from/to must be a place slug or "lat,lng" in Australia or New Zealand',
  )

/** `YYYY-MM-DDTHH:mm` that names a real calendar minute. */
const depart = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'depart must be YYYY-MM-DDTHH:mm')
  .refine((s) => {
    const [y, mo, d, h, mi] = s.split(/[-T:]/).map(Number)
    const t = new Date(Date.UTC(y, mo - 1, d, h, mi))
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && t.getUTCHours() === h && t.getUTCMinutes() === mi
  }, 'depart is not a valid date and time')

const schema = z.object({
  from: endpoint,
  to: endpoint,
  depart,
  // Comma-joined by `normalise` from `modes[]=a&modes[]=b`.
  modes: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : []))
    .pipe(z.array(z.enum(MODES, 'unknown mode')).max(MODES.length)),
  step_free: z
    .enum(['true', 'false', '1', '0'], 'step_free must be true or false')
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  locale: z.enum(['th', 'en']).default('th'),
})

function normalise(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(params)
  const modes = [...params.getAll('modes[]'), ...params.getAll('modes')].filter(Boolean)
  out.delete('modes[]')
  out.delete('modes')
  if (modes.length) out.set('modes', modes.join(','))
  return out
}

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET /api/v1/routes/plan?from=&to=&depart=&modes[]=&step_free=&locale=
 * -> 200 { options } · 400 VALIDATION · 404 NOT_FOUND · 429 · 503 { error: ROUTING_UNAVAILABLE, fallback }.
 * Not HTTP-cached: Redis holds each from/to/15-minute bucket for 15 minutes.
 */
export async function GET(req: NextRequest) {
  // Before validation and any upstream call, so a flood of requests never reaches Google.
  const limited = await rateLimit(req, { limit: 20, window: '10 m', prefix: 'routes' })
  if (limited) return limited

  const parsed = parseQuery(schema, normalise(req.nextUrl.searchParams))
  if (!parsed.ok) return parsed.response
  const { from, to, depart: departLocal, modes, step_free, locale } = parsed.data

  try {
    const result = await planRoute(
      { from, to, depart: departLocal, modes, stepFree: step_free, locale },
      { provider: googleRoutes, db: createPublicClient(), cache: redisRouteCache() },
    )
    if ('options' in result) return NextResponse.json({ options: result.options }, { headers: NO_STORE })
    if (result.error === 'NOT_FOUND') return apiError('NOT_FOUND', result.message, 404)
    return NextResponse.json(
      { error: { code: 'ROUTING_UNAVAILABLE', message: result.message }, fallback: result.fallback },
      { status: 503, headers: NO_STORE },
    )
  } catch (err) {
    console.error('[routes/plan] failed', err)
    return apiError('INTERNAL', 'Route planning failed', 500)
  }
}
