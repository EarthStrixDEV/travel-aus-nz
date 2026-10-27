import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { meRoute, NO_STORE } from '@/lib/api/session'
import { parseBody } from '@/lib/api/validate'
import { listTrips } from '@/lib/trip/load'
import { newTripSchema } from '@/lib/trip/schema'

/** GET /api/v1/me/trips -> { trips }, newest first. */
export async function GET(req: NextRequest) {
  return meRoute(req, { write: false, label: 'trips' }, async ({ user, db }) =>
    NextResponse.json({ trips: await listTrips(db, user.id) }, { headers: NO_STORE }),
  )
}

/** POST /api/v1/me/trips `{ title, start_date?, end_date? }` -> 201 `{ id }` (one day per date; no dates = Day 1). */
export async function POST(req: NextRequest) {
  return meRoute(req, { write: true, label: 'trips' }, async ({ db }) => {
    const parsed = await parseBody(newTripSchema, req)
    if (!parsed.ok) return parsed.response
    const { title, start_date, end_date } = parsed.data
    const { data, error } = await db.rpc('create_trip', { p_title: title, p_start: start_date, p_end: end_date })
    if (error?.code === '22023' || error?.code === '23514') return apiError('VALIDATION', error.message, 400)
    if (error) throw error
    return NextResponse.json({ id: data }, { status: 201, headers: NO_STORE })
  })
}