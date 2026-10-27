import { NextResponse, type NextRequest } from 'next/server'
import { meRoute, NO_STORE } from '@/lib/api/session'
import { parseBody, parseQuery } from '@/lib/api/validate'
import { savedSchema } from '@/lib/trip/schema'

/** GET /api/v1/me/saved -> { items: [{ entity_type, entity_id, created_at }] }, newest first. */
export async function GET(req: NextRequest) {
  return meRoute(req, { write: false, label: 'saved' }, async ({ user, db }) => {
    const { data, error } = await db
      .from('saved_items')
      .select('entity_type, entity_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ items: data ?? [] }, { headers: NO_STORE })
  })
}

/** POST /api/v1/me/saved `{ entity_type, entity_id }` -> 201 (already saved is fine). */
export async function POST(req: NextRequest) {
  return meRoute(req, { write: true, label: 'saved' }, async ({ user, db }) => {
    const parsed = await parseBody(savedSchema, req)
    if (!parsed.ok) return parsed.response
    const { error } = await db
      .from('saved_items')
      .upsert({ user_id: user.id, ...parsed.data }, { onConflict: 'user_id,entity_type,entity_id', ignoreDuplicates: true })
    if (error) throw error
    return NextResponse.json(parsed.data, { status: 201, headers: NO_STORE })
  })
}

/** DELETE /api/v1/me/saved?entity_type=&entity_id= -> 204. */
export async function DELETE(req: NextRequest) {
  return meRoute(req, { write: true, label: 'saved' }, async ({ user, db }) => {
    const parsed = parseQuery(savedSchema, req.nextUrl.searchParams)
    if (!parsed.ok) return parsed.response
    const { error } = await db
      .from('saved_items')
      .delete()
      .eq('user_id', user.id)
      .eq('entity_type', parsed.data.entity_type)
      .eq('entity_id', parsed.data.entity_id)
    if (error) throw error
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  })
}