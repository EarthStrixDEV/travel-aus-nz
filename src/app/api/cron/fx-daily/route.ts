import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { requireCron } from '@/lib/cron/auth'
import { CACHE_TAGS } from '@/lib/content/cache'
import { rollDailyCloses } from '@/lib/fx/ingest'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** 00:10 UTC (vercel.json): closes for the previous UTC day into `fx_daily`, prune snapshots older than 30 days. */
export async function GET(req: Request) {
  const denied = requireCron(req)
  if (denied) return denied

  try {
    const result = await rollDailyCloses(createServiceClient())
    revalidateTag(CACHE_TAGS.fx)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[fx-daily] failed', err)
    return apiError('INTERNAL', 'FX daily roll-up failed', 500)
  }
}
