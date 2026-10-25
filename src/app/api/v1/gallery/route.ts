import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { paginationSchema } from '@/lib/api/cursor'
import { apiError } from '@/lib/api/errors'
import { parseQuery } from '@/lib/api/validate'
import { getGallery } from '@/lib/content/gallery'
import { filterGallery, paginateGallery, SEASONS, SLUG_PATTERN } from '@/lib/gallery/filter'

const schema = paginationSchema.extend({
  region: z.string().regex(SLUG_PATTERN, 'invalid region').optional(),
  type: z.string().regex(SLUG_PATTERN, 'invalid type').optional(),
  season: z.enum(SEASONS, 'unknown season').optional(),
  locale: z.enum(['th', 'en']).default('th'),
})

/**
 * GET /api/v1/gallery?region=&type=&season=&cursor=&limit=&locale= -> { items: GalleryPhoto[], nextCursor }
 * Each photo carries its place summary, so the lightbox needs no second request. The list comes from the
 * `gallery`-tagged content cache; filtering and paging happen on that list.
 */
export async function GET(req: NextRequest) {
  const parsed = parseQuery(schema, req.nextUrl.searchParams)
  if (!parsed.ok) return parsed.response
  const { region, type, season, locale, cursor, limit } = parsed.data

  // Gallery cursors are (sort, id) with a numeric sort; one minted by another list is not ours.
  if (cursor && typeof cursor.sort !== 'number') return apiError('VALIDATION', 'invalid cursor', 400)

  try {
    const list = filterGallery(await getGallery(locale), { region, type, season })
    return NextResponse.json(paginateGallery(list, { cursor, limit }))
  } catch (err) {
    console.error('[gallery] list failed', err)
    return apiError('INTERNAL', 'The gallery is unavailable', 500)
  }
}
