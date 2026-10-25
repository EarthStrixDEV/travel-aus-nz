import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getEntry } from '@/lib/content/entry'

const schema = z.object({ locale: z.enum(['th', 'en']).default('th') })

/**
 * GET /api/v1/entry?locale= -> { rules, permissions, links, documents, faqs, timeline, last_verified_at }
 * The whole rule table, resolved in the browser. Cached under the `entry` tag (see `getEntry`).
 */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response

  try {
    return NextResponse.json(await getEntry(parsed.data.locale))
  } catch (err) {
    console.error('[entry] load failed', err)
    return apiError('INTERNAL', 'Entry information is unavailable', 500)
  }
}
