import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { encodeCursor, paginationSchema } from '@/lib/api/cursor'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getVenues } from '@/lib/content/venues'
import { filterVenues, SLUG_PATTERN, type VenueFilter } from '@/lib/venues/filter'

const slug = (what: string) => z.string().regex(SLUG_PATTERN, `invalid ${what}`)

const schema = paginationSchema.extend({
  locale: z.enum(['th', 'en']).default('th'),
  kind: z.enum(['restaurant', 'bar']).default('restaurant'),
  city: slug('city').optional(),
  price_max: z.coerce.number().int().min(1).max(4).optional(),
  drink: slug('drink').optional(),
  mood: slug('mood').optional(),
  cuisine: slug('cuisine').optional(),
  // Comma-joined by `normalise` from `diet[]=a&diet=b`.
  diet: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',') : []))
    .pipe(z.array(slug('diet')).max(8)),
})

function normalise(params: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(params)
  const diet = [...params.getAll('diet[]'), ...params.getAll('diet')].flatMap((s) => s.split(',')).filter(Boolean)
  out.delete('diet[]')
  out.delete('diet')
  if (diet.length) out.set('diet', [...new Set(diet)].join(','))
  return out
}

/**
 * GET /api/v1/venues?kind=&city=&price_max=&drink=&mood=&diet[]=&cuisine=&cursor=&limit=&locale=
 *   -> { items: VenueCard[], facets, nextCursor }
 * Server-side mirror of the page's client filter (same `filterVenues`). Items are ordered by slug; facet
 * counts cover the whole filtered set, not just the page.
 */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, normalise(req.nextUrl.searchParams))
  if (!parsed.ok) return parsed.response
  const { locale, kind, city, price_max, drink, mood, cuisine, diet, cursor, limit } = parsed.data

  const filter: VenueFilter = { kind, city, priceMax: price_max as VenueFilter['priceMax'], drink, mood, diet, cuisine }

  try {
    const catalog = await getVenues(locale, city)
    const { items, facets } = filterVenues(catalog, filter)
    const sorted = [...items].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    const after = cursor ? sorted.filter((v) => v.slug > String(cursor.sort)) : sorted
    const page = after.slice(0, limit)
    const last = page[page.length - 1]
    return NextResponse.json({
      items: page,
      facets,
      nextCursor: after.length > limit && last ? encodeCursor({ sort: last.slug, id: last.id }) : null,
    })
  } catch (err) {
    console.error('[venues] list failed', err)
    return apiError('INTERNAL', 'Venues are unavailable', 500)
  }
}
