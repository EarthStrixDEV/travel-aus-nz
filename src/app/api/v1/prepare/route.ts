import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getPrepare } from '@/lib/content/prepare'
import { forCountry } from '@/lib/prepare/data'

const schema = z.object({
  locale: z.enum(['th', 'en']).default('th'),
  country: z.enum(['au', 'nz', 'both']).default('both'),
})

/** GET /api/v1/prepare?country=&locale= -> templates, months, packing, facts, connectivity, transfers (tag `prepare`). */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response
  try {
    return NextResponse.json(forCountry(await getPrepare(parsed.data.locale), parsed.data.country))
  } catch (err) {
    console.error('[prepare] failed', err)
    return apiError('INTERNAL', 'Prepare content is unavailable', 500)
  }
}