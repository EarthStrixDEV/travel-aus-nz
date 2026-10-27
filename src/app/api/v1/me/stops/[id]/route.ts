import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { meRoute, NO_STORE, NotFound } from '@/lib/api/session'
import { parseBody } from '@/lib/api/validate'
import { deleteStop, ownedStop, patchStop } from '@/lib/trip/mutate'
import { patchStopSchema } from '@/lib/trip/schema'

type Ctx = { params: Promise<{ id: string }> }
const stopId = async (ctx: Ctx) => {
  const id = (await ctx.params).id
  if (!z.uuid().safeParse(id).success) throw new NotFound()
  return id
}

/** PATCH /api/v1/me/stops/:id `{ time?, note?, day_id?, position? }` -> 204. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  return meRoute(req, { write: true, label: 'stop' }, async ({ user, db }) => {
    const stop = await ownedStop(db, user.id, await stopId(ctx))
    const parsed = await parseBody(patchStopSchema, req)
    if (!parsed.ok) return parsed.response
    await patchStop(db, stop, parsed.data)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  })
}

/** DELETE /api/v1/me/stops/:id -> 204; the place goes back to "Saved, not scheduled". */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return meRoute(req, { write: true, label: 'stop' }, async ({ user, db }) => {
    const stop = await ownedStop(db, user.id, await stopId(ctx))
    await deleteStop(db, user.id, stop)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  })
}