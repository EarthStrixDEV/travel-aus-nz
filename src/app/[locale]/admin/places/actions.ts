'use server'

import { revalidateTag } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { CACHE_TAGS } from '@/lib/content/cache'
import { createClient } from '@/lib/supabase/server'
import { replaceChildren } from '../_lib/db'
import { dbError, fieldErrors, formToInput, rows, toI18n, uuidId, type MediaMeta, type SaveResult } from '../_lib/form'
import { isVenueType, placeSchema } from './schema'

function revalidatePlaces() {
  revalidateTag(CACHE_TAGS.map)
  revalidateTag(CACHE_TAGS.venues)
  revalidateTag(CACHE_TAGS.home)
}

/**
 * Create (id null) or update a place with its hours, tags, nearest-stop links and, for
 * restaurant/bar/cafe, its venue row + drinks. All writes use the editor's session.
 */
export async function savePlace(id: string | null, formData: FormData): Promise<SaveResult> {
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  const placeId = uuidId(id)
  if (placeId === undefined) return { error: t('errors.invalidId') }

  const input = {
    ...formToInput(formData),
    hours: rows(formData, 'hour', ['weekday', 'open_time', 'close_time']),
    stops: rows(formData, 'stop', ['stop_id', 'walk_min']),
  }
  const supabase = await createClient()

  // A published place exposes its published gallery photos, so their assets must be licensed.
  let media: MediaMeta[] = []
  if (placeId !== null) {
    const { data, error } = await supabase
      .from('gallery_photos')
      .select('media:media_assets(credit, license)')
      .eq('place_id', placeId)
      .eq('status', 'published')
    if (error) return { error: dbError(error, t) }
    media = (data ?? []).flatMap((r) => (r.media ? [r.media] : []))
  }

  const parsed = placeSchema.safeParse({ ...input, media })
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues, t) }
  const d = parsed.data

  const { data: saved, error } = await supabase
    .from('places')
    .upsert({
      ...(placeId !== null && { id: placeId }),
      city_id: d.city_id,
      slug: d.slug,
      type: d.type,
      category: d.category ?? null,
      name_i18n: toI18n(d, 'name')!,
      area_i18n: toI18n(d, 'area'),
      desc_i18n: toI18n(d, 'desc'),
      best_time_i18n: toI18n(d, 'best_time'),
      access_i18n: toI18n(d, 'access'),
      price_note_i18n: toI18n(d, 'price_note'),
      hours_note_i18n: toI18n(d, 'hours_note'),
      geom: `SRID=4326;POINT(${d.lng} ${d.lat})`,
      price_level: d.price_level ?? null,
      website: d.website ?? null,
      is_closed: d.is_closed,
      verified_at: d.verified_at ?? null,
      status: d.status,
    })
    .select('id')
    .single()
  if (error || !saved) return { error: error ? dbError(error, t) : t('errors.saveFailed') }
  const pid = saved.id

  const childError = await saveChildren(supabase, pid, d)
  // The place row itself changed either way, so public caches must not keep the old one.
  revalidatePlaces()
  return childError ? { error: dbError(childError, t) } : {}
}

type Db = Awaited<ReturnType<typeof createClient>>
type Parsed = ReturnType<typeof placeSchema.parse>

async function saveChildren(db: Db, pid: string, d: Parsed) {
  const steps = [
    () => replaceChildren(db, 'place_hours', 'place_id', pid, d.hours.map((h) => ({ place_id: pid, ...h }))),
    () => replaceChildren(db, 'place_tags', 'place_id', pid, [...new Set(d.tags)].map((tag_id) => ({ place_id: pid, tag_id }))),
    () =>
      replaceChildren(
        db,
        'place_stop_links',
        'place_id',
        pid,
        d.stops.map((s, i) => ({ place_id: pid, stop_id: s.stop_id, rank: i + 1, walk_min: s.walk_min })),
      ),
    ...(isVenueType(d.type)
      ? [
          async () =>
            (
              await db.from('venues').upsert({
                place_id: pid,
                cuisine_id: d.cuisine_id ?? null,
                dietary: [...new Set(d.dietary)],
                menu_highlights_i18n: toI18n(d, 'menu_highlights'),
                drinks_i18n: toI18n(d, 'drinks_text'),
                booking: d.booking ?? null,
              })
            ).error,
          () => replaceChildren(db, 'venue_drinks', 'place_id', pid, [...new Set(d.drinks)].map((drink) => ({ place_id: pid, drink }))),
        ]
      : // Type changed away from a venue: drop the venue row (venue_drinks cascade).
        [async () => (await db.from('venues').delete().eq('place_id', pid)).error]),
  ]
  for (const step of steps) {
    const error = await step()
    if (error) return error
  }
  return null
}
