import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { CACHE_TAGS } from '@/lib/content/cache'
import { requireCron } from '@/lib/cron/auth'
import { checkLinks } from '@/lib/entry/link-check'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Sequential GETs, up to 10 s each.
export const maxDuration = 60

/** Daily 02:00 UTC (vercel.json): probe every `official_links` row, flag broken/changed pages for review. */
export async function GET(req: Request) {
  const denied = requireCron(req)
  if (denied) return denied

  try {
    const result = await checkLinks(createServiceClient(), fetch)
    // `needs_review` decides whether the helper names a permission, so the cached payload has to refresh.
    if (result.flagged) revalidateTag(CACHE_TAGS.entry)
    // Links that could not be recorded at all (database errors): fail the run so it shows up, like fx-ingest.
    if (result.errors) return apiError('INTERNAL', `Link check finished with ${result.errors} error(s); ${result.checked} link(s) recorded`, 502)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[link-check] failed', err)
    return apiError('INTERNAL', 'Link check failed', 500)
  }
}
