import { NextResponse, type NextRequest } from 'next/server'
import { meRoute, NO_STORE } from '@/lib/api/session'
import { currentTripId } from '@/lib/trip/current-trip'

/** GET /api/v1/me/summary -> { saved_count, latest_trip_id } (spec §2 "My Trip · N"). */
export async function GET(req: NextRequest) {
  return meRoute(req, { write: false, label: 'summary' }, async ({ user, db }) => {
    const [{ count, error }, latest] = await Promise.all([
      db.from('saved_items').select('entity_id', { count: 'exact', head: true }).eq('user_id', user.id),
      currentTripId(db, user.id, { create: false }),
    ])
    if (error) throw error
    return NextResponse.json({ saved_count: count ?? 0, latest_trip_id: latest }, { headers: NO_STORE })
  })
}