import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { meRoute, NO_STORE, NotFound } from '@/lib/api/session'
import { parseBody } from '@/lib/api/validate'
import { loadTrip } from '@/lib/trip/load'
import { renameTripSchema } from '@/lib/trip/schema'

type Ctx = { params: Promise<{ id: string }> }
const tripId = async (ctx: Ctx) => {
  const id = (await ctx.params).id
  if (!z.uuid().safeParse(id).success) throw new NotFound()
  return id
}

/** GET /api/v1/me/trips/:id?locale= -> days + stops + legs + saved-unscheduled. Not the user's trip -> 404. */
export async function GET(req: NextRequest, ctx: Ctx) {
  return meRoute(req, { write: false, label: 'trip' }, async ({ user, db }) => {
    const locale = req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'th'
    const trip = await loadTrip(db, user.id, await tripId(ctx), locale)
    if (!trip) throw new NotFound()
    return NextResponse.json(trip, { headers: NO_STORE })
  })
}

/** PATCH /api/v1/me/trips/:id `{ title }` -> 204. Dates are fixed once the days exist. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return meRoute(req, { write: true, label: 'trip' }, async ({ user, db }) => {
    const id = await tripId(ctx)
    const parsed = await parseBody(renameTripSchema, req)
    if (!parsed.ok) return parsed.response
    const { data, error } = await db.from('trips').update({ title: parsed.data.title }).eq('id', id).eq('user_id', user.id).is('deleted_at', null).select('id')
    if (error) throw error
    if (!data?.length) throw new NotFound()
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  })
}

/** DELETE /api/v1/me/trips/:id -> 204 (soft delete: `deleted_at`). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return meRoute(req, { write: true, label: 'trip' }, async ({ user, db }) => {
    const id = await tripId(ctx)
    const { data, error } = await db
      .from('trips')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select('id')
    if (error) throw error
    if (!data?.length) throw new NotFound()
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  })
}