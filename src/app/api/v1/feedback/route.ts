import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { rateLimit } from '@/lib/api/rate-limit'
import { parseBody } from '@/lib/api/validate'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Same caps as the `content_feedback` check constraints.
const schema = z.object({
  entity: z.string().min(1, 'entity is required').max(120, 'entity must be at most 120 characters'),
  kind: z.enum(['outdated', 'broken', 'unclear'], 'kind must be outdated, broken or unclear'),
  note: z.string().max(1000, 'note must be at most 1000 characters').optional(),
})

/** The signed-in user's id when there is a session, else null. Feedback never requires an account. */
async function sessionUserId(): Promise<string | null> {
  try {
    const { data } = await (await createClient()).auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

/** POST /api/v1/feedback { entity, kind, note? } -> 202. 5 per hour per IP. */
export async function POST(req: Request) {
  const limited = await rateLimit(req, { limit: 5, window: '1 h', prefix: 'feedback' })
  if (limited) return limited

  const parsed = await parseBody(schema, req)
  if (!parsed.ok) return parsed.response
  const { entity, kind, note } = parsed.data

  try {
    const { error } = await createServiceClient()
      .from('content_feedback')
      .insert({ entity, kind, note: note ?? null, user_id: await sessionUserId() })
    if (error) throw error
    return NextResponse.json({ accepted: true }, { status: 202 })
  } catch (err) {
    console.error('[feedback] insert failed', err)
    return apiError('INTERNAL', 'Feedback could not be saved', 500)
  }
}
