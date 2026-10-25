import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { parsePoint } from '../../cities/geo'
import { UUID_PARAM } from '../../_lib/form'
import { cityOptions, cuisineOptions, stopOptions, tagOptions } from '../../_lib/options'
import { i18nValues, str, type FormValues } from '../../_lib/values'
import { PlaceForm, type HourSlot, type StopLink } from '../place-form'

// One literal (not concatenated) so supabase-js infers the embedded row shape.
const PLACE_SELECT =
  '*, hours:place_hours(weekday, open_time, close_time), tags:place_tags(tag_id), stops:place_stop_links(stop_id, rank, walk_min), venue:venues(cuisine_id, dietary, menu_highlights_i18n, drinks_i18n, booking, drinks:venue_drinks(drink))'

/** "17:00:00" -> "17:00" for `<input type="time">`. */
const hhmm = (v: string) => v.slice(0, 5)

export default async function PlaceEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !UUID_PARAM.test(rawId)) notFound()
  const id = isNew ? null : rawId

  const supabase = await createClient()
  const [cities, tags, cuisines, stopsList] = await Promise.all([
    cityOptions(supabase, locale),
    tagOptions(supabase, locale),
    cuisineOptions(supabase, locale),
    stopOptions(supabase),
  ])

  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' })
  // 2026-01-04 is a Sunday: index 0 = Sunday, matching place_hours.weekday.
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(Date.UTC(2026, 0, 4 + i)))

  let values: FormValues = { type: 'attraction', city_id: cities[0]?.value ?? '', status: 'draft', is_closed: 'false' }
  let checked = { tags: [] as string[], dietary: [] as string[], drinks: [] as string[] }
  const hours: HourSlot[][] = Array.from({ length: 7 }, () => [])
  let stops: StopLink[] = []

  if (id !== null) {
    const { data, error } = await supabase.from('places').select(PLACE_SELECT).eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load place')
    if (!data) notFound()
    const p = data
    const venue = Array.isArray(p.venue) ? (p.venue[0] ?? null) : p.venue
    const point = parsePoint(p.geom)
    values = {
      ...i18nValues(p.name_i18n, 'name'),
      ...i18nValues(p.area_i18n, 'area'),
      ...i18nValues(p.desc_i18n, 'desc'),
      ...i18nValues(p.best_time_i18n, 'best_time'),
      ...i18nValues(p.access_i18n, 'access'),
      ...i18nValues(p.price_note_i18n, 'price_note'),
      ...i18nValues(p.hours_note_i18n, 'hours_note'),
      ...i18nValues(venue?.menu_highlights_i18n, 'menu_highlights'),
      ...i18nValues(venue?.drinks_i18n, 'drinks_text'),
      slug: p.slug,
      type: p.type,
      city_id: str(p.city_id),
      category: str(p.category),
      status: p.status,
      lng: point ? String(point.lng) : '',
      lat: point ? String(point.lat) : '',
      price_level: str(p.price_level),
      website: str(p.website),
      verified_at: str(p.verified_at),
      is_closed: String(p.is_closed),
      cuisine_id: str(venue?.cuisine_id),
      booking: str(venue?.booking),
    }
    checked = {
      tags: p.tags.map((x) => String(x.tag_id)),
      dietary: venue?.dietary ?? [],
      drinks: (venue?.drinks ?? []).map((x: { drink: string }) => x.drink),
    }
    for (const h of [...p.hours].sort((a, b) => a.open_time.localeCompare(b.open_time))) {
      hours[h.weekday]?.push({ open: hhmm(h.open_time), close: hhmm(h.close_time) })
    }
    stops = [...p.stops].sort((a, b) => a.rank - b.rank).map((s) => ({ stop_id: String(s.stop_id), walk_min: String(s.walk_min) }))
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('places.newTitle') : t('places.editTitle')}</h1>
      <PlaceForm
        id={id}
        values={values}
        checked={checked}
        hours={hours}
        stops={stops}
        options={{ cities, tags, cuisines, stops: stopsList }}
        weekdays={weekdays}
      />
    </>
  )
}
