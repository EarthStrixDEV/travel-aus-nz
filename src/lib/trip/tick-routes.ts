import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { rateLimit } from '@/lib/api/rate-limit'
import { NO_STORE, requireApiUser } from '@/lib/api/session'
import { parseBody } from '@/lib/api/validate'
import { currentTripId, ownedTripId } from './current-trip'
import { clearTicks, readTicks, writeTick, type TickKind } from './ticks'

/** Route bodies for `/me/trips/:id/{checklist,packing}` and `/me/{checklist,packing}-items/:id` (spec §12). */

const uuid = z.uuid()
const itemId = z.coerce.number().int().positive().max(2147483647)
const FIELD: Record<TickKind, 'done' | 'packed'> = { checklist: 'done', packing: 'packed' }
// Both bodies normalise to `{ trip_id?, on }`.
type TickBody = { trip_id?: string; on: boolean }
const BODY: Record<TickKind, z.ZodType<TickBody>> = {
  checklist: z.object({ trip_id: uuid.optional(), done: z.boolean() }).transform(({ trip_id, done }) => ({ trip_id, on: done })),
  packing: z.object({ trip_id: uuid.optional(), packed: z.boolean() }).transform(({ trip_id, packed }) => ({ trip_id, on: packed })),
}

const ME_LIMIT = { limit: 60, window: '1 m', prefix: 'me' } as const

/** GET: ids ticked on this trip. Not the user's trip (or deleted) -> 404. */
export async function getTicks(kind: TickKind, rawTripId: string) {
  const auth = await requireApiUser()
  if (auth instanceof NextResponse) return auth
  if (!uuid.safeParse(rawTripId).success) return apiError('NOT_FOUND', 'Trip not found', 404)
  try {
    const tripId = await ownedTripId(auth.db, auth.user.id, rawTripId)
    if (!tripId) return apiError('NOT_FOUND', 'Trip not found', 404)
    const ids = await readTicks(auth.db, kind, tripId)
    return NextResponse.json({ items: ids.map((id) => ({ [kind === 'checklist' ? 'template_id' : 'item_id']: id, [FIELD[kind]]: true })) }, { headers: NO_STORE })
  } catch (err) {
    console.error(`[me/${kind}] read failed`, err)
    return apiError('INTERNAL', 'Could not load your list', 500)
  }
}

/** DELETE: reset the list for this trip. */
export async function resetTicks(req: NextRequest, kind: TickKind, rawTripId: string) {
  const limited = await rateLimit(req, ME_LIMIT)
  if (limited) return limited
  const auth = await requireApiUser()
  if (auth instanceof NextResponse) return auth
  if (!uuid.safeParse(rawTripId).success) return apiError('NOT_FOUND', 'Trip not found', 404)
  try {
    const tripId = await ownedTripId(auth.db, auth.user.id, rawTripId)
    if (!tripId) return apiError('NOT_FOUND', 'Trip not found', 404)
    await clearTicks(auth.db, kind, tripId)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  } catch (err) {
    console.error(`[me/${kind}] reset failed`, err)
    return apiError('INTERNAL', 'Could not reset your list', 500)
  }
}

/**
 * PATCH `{ trip_id?, done | packed }`: tick or untick one item. Without `trip_id` the user's current trip is used,
 * created on first use (plan deviation 6). A `trip_id` that isn't the user's live trip -> 404 and no write.
 */
export async function patchTick(req: NextRequest, kind: TickKind, rawItemId: string) {
  const limited = await rateLimit(req, ME_LIMIT)
  if (limited) return limited
  const auth = await requireApiUser()
  if (auth instanceof NextResponse) return auth

  const item = itemId.safeParse(rawItemId)
  if (!item.success) return apiError('VALIDATION', 'Invalid item id', 400)
  const parsed = await parseBody(BODY[kind], req)
  if (!parsed.ok) return parsed.response
  const { trip_id: requested, on } = parsed.data

  try {
    const tripId = requested
      ? await ownedTripId(auth.db, auth.user.id, requested)
      : await currentTripId(auth.db, auth.user.id, { create: true })
    if (!tripId) return apiError('NOT_FOUND', 'Trip not found', 404)
    await writeTick(auth.db, kind, tripId, item.data, on)
    return NextResponse.json({ trip_id: tripId, id: item.data, [FIELD[kind]]: on }, { headers: NO_STORE })
  } catch (err) {
    // A template / packing item id that doesn't exist is a foreign-key violation.
    if ((err as { code?: string }).code === '23503') return apiError('NOT_FOUND', 'Item not found', 404)
    console.error(`[me/${kind}] write failed`, err)
    return apiError('INTERNAL', 'Could not save your list', 500)
  }
}
