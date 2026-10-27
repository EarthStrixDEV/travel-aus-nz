import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getDishes } from '@/lib/content/dishes'
import { filterDishes, parseDishFilter } from '@/lib/dishes/filter'

const schema = z.object({ locale: z.enum(['th', 'en']).default('th') })

/**
 * GET /api/v1/dishes?locale=&country=&region=&type=&price_max=&diet= -> dishes (filtered) + must-try + collections.
 * The catalog is small and cached under the `dishes` tag; the page itself ships it whole and filters on the client.
 */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, new URLSearchParams({ locale: req.nextUrl.searchParams.get('locale') ?? 'th' }))
  if (!parsed.ok) return parsed.response

  try {
    const data = await getDishes(parsed.data.locale)
    const { items } = filterDishes(data.dishes, parseDishFilter(req.nextUrl.searchParams))
    return NextResponse.json({ ...data, dishes: items })
  } catch (err) {
    console.error('[dishes] list failed', err)
    return apiError('INTERNAL', 'Dishes are unavailable', 500)
  }
}
