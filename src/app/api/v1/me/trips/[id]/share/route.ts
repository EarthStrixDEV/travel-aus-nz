import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { meRoute, NO_STORE, NotFound } from '@/lib/api/session'
import { siteUrl } from '@/lib/seo/site-url'
import { ownedTripId } from '@/lib/trip/current-trip'
import { ensureShareToken, revokeShares } from '@/lib/trip/share'

type Ctx = { params: Promise<{ id: string }> }

async function trip(ctx: Ctx, db: Parameters<typeof ownedTripId>[0], userId: string) {
  const id = (await ctx.params).id
  const owned = z.uuid().safeParse(id).success ? await ownedTripId(db, userId, id) : null
  if (!owned) throw new NotFound()
  return owned
}

/** POST /api/v1/me/trips/:id/share?locale= -> `{ url }`: the live read-only link (created on first use). */
export async function POST(req: NextRequest, ctx: Ctx) {
  return meRoute(req, { write: true, label: 'share' }, async ({ user, db }) => {
    const token = await ensureShareToken(db, await trip(ctx, db, user.id))
    const locale = req.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'th'
    return NextResponse.json({ url: `${siteUrl()}/${locale}/shared/${token}` }, { headers: NO_STORE })
  })
}

/** DELETE /api/v1/me/trips/:id/share -> 204: revokes every live link; old URLs answer 404. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return meRoute(req, { write: true, label: 'share' }, async ({ user, db }) => {
    await revokeShares(db, await trip(ctx, db, user.id))
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  })
}