import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { cachedContent } from '@/lib/content/cache'
import { getReference } from '@/lib/fx/queries'
import { createPublicClient } from '@/lib/supabase/public'

const schema = z.object({ locale: z.enum(['th', 'en']).default('th') })

/** GET /api/v1/fx/reference?locale= -> { costs, budgets, tips, verifiedAt }. ISR under the `fx` tag. */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response
  const { locale } = parsed.data

  try {
    const reference = await cachedContent(['fx-reference', locale], 'fx', () => getReference(createPublicClient(), locale))()
    return NextResponse.json(reference)
  } catch (err) {
    console.error('[fx] reference failed', err)
    return apiError('INTERNAL', 'Reference prices are unavailable', 500)
  }
}
