import type { NextRequest } from 'next/server'
import { patchTick } from '@/lib/trip/tick-routes'

/** PATCH /api/v1/me/packing-items/:itemId `{ trip_id?, packed }` -> `{ trip_id, id, packed }`. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return patchTick(req, 'packing', (await ctx.params).id)
}