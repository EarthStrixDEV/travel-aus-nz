import type { NextRequest } from 'next/server'
import { getTicks, resetTicks } from '@/lib/trip/tick-routes'

type Ctx = { params: Promise<{ id: string }> }

/** GET /api/v1/me/trips/:id/checklist -> { items: [{ template_id, done }] } (ticked only). */
export async function GET(req: NextRequest, ctx: Ctx) {
  return getTicks(req, 'checklist', (await ctx.params).id)
}

/** DELETE /api/v1/me/trips/:id/checklist -> 204: Reset. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return resetTicks(req, 'checklist', (await ctx.params).id)
}