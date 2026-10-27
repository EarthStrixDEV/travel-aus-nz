import type { NextRequest } from 'next/server'
import { patchTick } from '@/lib/trip/tick-routes'

/** PATCH /api/v1/me/checklist-items/:templateId `{ trip_id?, done }` -> `{ trip_id, id, done }`. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return patchTick(req, 'checklist', (await ctx.params).id)
}