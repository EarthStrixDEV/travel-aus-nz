import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { meRoute, NO_STORE, NotFound } from '@/lib/api/session'
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

async function owned(db: Parameters<typeof ownedTripId>[0], userId: string, rawTripId: string): Promise<string> {
  const tripId = uuid.safeParse(rawTripId).success ? await ownedTripId(db, userId, rawTripId) : null
  if (!tripId) throw new NotFound()
  return tripId
}

/** GET: ids ticked on this trip. Not the user's trip (or deleted) -> 404. */
export function getTicks(req: Request, kind: TickKind, rawTripId: string) {
  return meRoute(req, { write: false, label: kind }, async ({ user, db }) => {
    const ids = await readTicks(db, kind, await owned(db, user.id, rawTripId))
    const key = kind === 'checklist' ? 'template_id' : 'item_id'
    return NextResponse.json({ items: ids.map((id) => ({ [key]: id, [FIELD[kind]]: true })) }, { headers: NO_STORE })
  })
}

/** DELETE: reset the list for this trip. */
export function resetTicks(req: Request, kind: TickKind, rawTripId: string) {
  return meRoute(req, { write: true, label: kind }, async ({ user, db }) => {
    await clearTicks(db, kind, await owned(db, user.id, rawTripId))
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  })
}

/**
 * PATCH `{ trip_id?, done | packed }`: tick or untick one item. Without `trip_id` the user's current trip is used,
 * created on first use (plan deviation 6). A `trip_id` that isn't the user's live trip -> 404 and no write.
 */
export function patchTick(req: NextRequest, kind: TickKind, rawItemId: string) {
  return meRoute(req, { write: true, label: kind }, async ({ user, db }) => {
    const item = itemId.safeParse(rawItemId)
    if (!item.success) return apiError('VALIDATION', 'Invalid item id', 400)
    const parsed = await parseBody(BODY[kind], req)
    if (!parsed.ok) return parsed.response
    const { trip_id: requested, on } = parsed.data

    const tripId = requested ? await owned(db, user.id, requested) : await currentTripId(db, user.id, { create: true })
    try {
      await writeTick(db, kind, tripId!, item.data, on)
    } catch (err) {
      // A template / packing item id that doesn't exist is a foreign-key violation.
      if ((err as { code?: string }).code === '23503') throw new NotFound()
      throw err
    }
    return NextResponse.json({ trip_id: tripId, id: item.data, [FIELD[kind]]: on }, { headers: NO_STORE })
  })
}
