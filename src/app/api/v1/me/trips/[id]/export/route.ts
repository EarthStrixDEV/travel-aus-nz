import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { meRoute, NotFound } from '@/lib/api/session'
import { buildIcs } from '@/lib/trip/ics'
import { loadTrip } from '@/lib/trip/load'

/**
 * GET /api/v1/me/trips/:id/export?format=ics&locale= -> `text/calendar` attachment.
 * PDF is the browser's print (plan deviation 4), so `format=pdf` is not served here.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return meRoute(req, { write: false, label: 'export' }, async ({ user, db }) => {
    if (req.nextUrl.searchParams.get('format') !== 'ics') return apiError('VALIDATION', 'format must be ics', 400)
    const id = (await ctx.params).id
    if (!z.uuid().safeParse(id).success) throw new NotFound()
    const locale = req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'th'
    const trip = await loadTrip(db, user.id, id, locale)
    if (!trip) throw new NotFound()
    return new NextResponse(buildIcs(trip), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="travelausnz-trip.ics"',
        'Cache-Control': 'no-store',
      },
    })
  })
}