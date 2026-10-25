import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { cachedContent } from '@/lib/content/cache'
import { STALE_AFTER_MS } from '@/lib/fx/constants'
import { getLatestSnapshot } from '@/lib/fx/queries'
import { createPublicClient } from '@/lib/supabase/public'

const schema = z.object({ base: z.literal('AUD', 'only base=AUD is supported').default('AUD') })

/** GET /api/v1/fx/latest?base=AUD -> { base, rates, fetched_at, source, stale }. Old snapshot -> stale: true, never an empty error. */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response

  try {
    const snapshot = await cachedContent(['fx', 'latest'], 'fx', () => getLatestSnapshot(createPublicClient()))()
    if (!snapshot) return apiError('FX_UNAVAILABLE', 'No exchange rates have been saved yet', 503)
    const stale = Date.now() - new Date(snapshot.fetched_at).getTime() > STALE_AFTER_MS
    return NextResponse.json({ ...snapshot, stale }, { headers: { 'Cache-Control': 'public, s-maxage=3600' } })
  } catch (err) {
    console.error('[fx] latest failed', err)
    return apiError('FX_UNAVAILABLE', 'Exchange rates are unavailable', 503)
  }
}
