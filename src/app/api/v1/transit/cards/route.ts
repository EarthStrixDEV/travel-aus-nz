import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getTransport } from '@/lib/content/transport'

const schema = z.object({
  city: z.string().regex(/^[a-z0-9-]{1,80}$/, 'invalid city').optional(),
  locale: z.enum(['th', 'en']).default('th'),
})

/** GET /api/v1/transit/cards?city=&locale= -> { items: CardInfo[] } (name, how to buy, caps, official link; tag `transport`). */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response
  const { city, locale } = parsed.data

  try {
    const { cards } = await getTransport(locale)
    return NextResponse.json({ items: city ? cards.filter((c) => c.city === city) : cards })
  } catch (err) {
    console.error('[transit/cards] failed', err)
    return apiError('INTERNAL', 'Transit cards are unavailable', 500)
  }
}
