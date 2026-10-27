import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { requireCron } from '@/lib/cron/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { recomputeStaleLegs } from '@/lib/trip/legs'
import { routePlanner } from '@/lib/trip/recompute'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Every 15 min (vercel.json): retries legs still `stale` 2+ minutes after their last attempt, 50 per run. */
export async function GET(req: Request) {
  const denied = requireCron(req)
  if (denied) return denied

  try {
    return NextResponse.json(await recomputeStaleLegs(createServiceClient(), routePlanner, { olderThanMs: 2 * 60_000, limit: 50 }))
  } catch (err) {
    console.error('[leg-recompute] failed', err)
    return apiError('INTERNAL', 'Leg recompute failed', 500)
  }
}
