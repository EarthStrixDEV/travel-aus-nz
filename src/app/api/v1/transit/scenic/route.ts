import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getTransport } from '@/lib/content/transport'

const schema = z.object({
  country: z.enum(['AU', 'NZ'], 'country must be AU or NZ').optional(),
  locale: z.enum(['th', 'en']).default('th'),
})

/** GET /api/v1/transit/scenic?country=AU|NZ&locale= -> { items: ScenicCard[] } (published only; tag `transport`). */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response
  const { country, locale } = parsed.data

  try {
    const { scenic } = await getTransport(locale)
    const items = country ? scenic.filter((s) => s.country === country.toLowerCase()) : scenic
    return NextResponse.json({ items })
  } catch (err) {
    console.error('[transit/scenic] failed', err)
    return apiError('INTERNAL', 'Scenic routes are unavailable', 500)
  }
}
