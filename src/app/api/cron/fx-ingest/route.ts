import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { requireCron } from '@/lib/cron/auth'
import { CACHE_TAGS } from '@/lib/content/cache'
import { exchangerateHost } from '@/lib/fx/exchangerate-host'
import { frankfurter } from '@/lib/fx/frankfurter'
import { ingestFx } from '@/lib/fx/ingest'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Hourly (vercel.json): primary provider, then the backup, into `fx_snapshots`. */
export async function GET(req: Request) {
  const denied = requireCron(req)
  if (denied) return denied

  try {
    const result = await ingestFx([exchangerateHost, frankfurter], createServiceClient())
    // Nothing written: the API keeps serving the last snapshot (flagged stale after 6 h). Fail the run so it shows up.
    if (!result.written) return apiError('INTERNAL', 'Every FX provider failed; no snapshot written', 502)
    revalidateTag(CACHE_TAGS.fx)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[fx-ingest] failed', err)
    return apiError('INTERNAL', 'FX ingest failed', 500)
  }
}
