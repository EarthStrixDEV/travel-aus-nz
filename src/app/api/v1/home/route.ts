import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { parseQuery } from '@/lib/api/validate'
import { getHome } from '@/lib/content/home'

const schema = z.object({
  country: z.enum(['au', 'nz']).default('au'),
  locale: z.enum(['th', 'en']).default('th'),
})

/** GET /api/v1/home?country=au|nz&locale=th|en -> HomeData (ISR-cached under the `home` tag). */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response
  return NextResponse.json(await getHome(parsed.data.locale, parsed.data.country))
}
