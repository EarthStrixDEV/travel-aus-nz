import type { NextRequest } from 'next/server'
import { getTicks, resetTicks } from '@/lib/trip/tick-routes'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/v1/me/trips/:id/packing -> { items: [{ item_id, packed }] } (packed only). */
export async function GET(req: NextRequest, ctx: Ctx) {
  return getTicks(req, 'packing', (await ctx.params).id)
}

/** DELETE /api/v1/me/trips/:id/packing -> 204: Reset. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return resetTicks(req, 'packing', (await ctx.params).id)
}