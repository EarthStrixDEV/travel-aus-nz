import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { cachedContent } from '@/lib/content/cache'
import { historyQuerySchema, loadHistory } from '@/lib/fx/history'
import { createPublicClient } from '@/lib/supabase/public'

/**
 * GET /api/v1/fx/history?pair=AUD-THB|NZD-THB&range=7d|1m|3m|1y
 * -> { points: [{ day, close }], high, low, change } where `change` is the % move first -> last.
 */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(historyQuerySchema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response
  const { pair, range } = parsed.data
  const [base, quote] = pair.split('-')

  try {
    const history = await cachedContent(['fx-history', pair, range], 'fx', () => loadHistory(createPublicClient(), base, quote, range), 21600)()
    return NextResponse.json(history, { headers: { 'Cache-Control': 'public, s-maxage=21600' } })
  } catch (err) {
    console.error('[fx] history failed', err)
    return apiError('INTERNAL', 'Rate history is unavailable', 500)
  }
}
