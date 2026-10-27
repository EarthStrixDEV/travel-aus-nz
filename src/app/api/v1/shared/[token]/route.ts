import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { rateLimit } from '@/lib/api/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import { loadSharedTrip } from '@/lib/trip/share'

/** GET /api/v1/shared/:token?locale= -> the read-only trip; unknown or revoked -> 404. 60/min per IP. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(req, { limit: 60, window: '1 m', prefix: 'shared' })
  if (limited) return limited
  try {
    const locale = req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'th'
    const trip = await loadSharedTrip(createServiceClient(), (await ctx.params).token, locale)
    if (!trip) return apiError('NOT_FOUND', 'Trip not found', 404)
    return NextResponse.json(trip, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
  } catch (err) {
    console.error('[shared] failed', err)
    return apiError('INTERNAL', 'Trip is unavailable', 500)
  }
}