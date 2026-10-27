import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { meRoute, NO_STORE, NotFound } from '@/lib/api/session'
import { parseBody } from '@/lib/api/validate'
import { addStop, ownedDay } from '@/lib/trip/mutate'
import { newStopSchema } from '@/lib/trip/schema'

const params = z.object({ id: z.uuid(), day: z.coerce.number().int().min(1).max(60) })

/** POST /api/v1/me/trips/:id/days/:dayNo/stops `{ place_id, time?, note? }` -> 201 `{ id }`; its legs start `stale`. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; day: string }> }) {
  return meRoute(req, { write: true, label: 'stops' }, async ({ user, db }) => {
    const p = params.safeParse(await ctx.params)
    if (!p.success) throw new NotFound()
    const parsed = await parseBody(newStopSchema, req)
    if (!parsed.ok) return parsed.response
    const dayId = await ownedDay(db, user.id, p.data.id, p.data.day)
    const id = await addStop(db, dayId, parsed.data)
    return NextResponse.json({ id }, { status: 201, headers: NO_STORE })
  })
}