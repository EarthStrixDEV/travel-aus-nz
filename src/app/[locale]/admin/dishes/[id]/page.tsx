import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { UUID_PARAM } from '../../_lib/form'
import { mediaOptions, placeOptions, regionOptions } from '../../_lib/options'
import { i18nValues, str, type FormValues } from '../../_lib/values'
import { DishForm, type DishVenueValues, type PairingValues } from '../dish-form'

export default async function DishEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !UUID_PARAM.test(rawId)) notFound()
  const id = isNew ? null : rawId

  const supabase = await createClient()
  const [media, regions, places] = await Promise.all([
    mediaOptions(supabase, t('form.unlicensed')),
    regionOptions(supabase, locale),
    // Where to try it: restaurants, bars and cafés only.
    placeOptions(supabase, locale, ['restaurant', 'bar', 'cafe']),
  ])

  let values: FormValues = { slug: '', country: 'AU', region_id: '', type: 'savoury', sort: '0', cover_media_id: '', status: 'draft' }
  let dietary: string[] = []
  let pairings: PairingValues[] = []
  let venues: DishVenueValues[] = []
  if (id !== null) {
    const { data: d, error } = await supabase
      .from('dishes')
      .select('*, pairings:dish_pairings(sort, k_i18n, v_i18n), venues:dish_venues(place_id, region_id, rank, price_text, note_i18n)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error('Failed to load dish')
    if (!d) notFound()
    values = {
      ...i18nValues(d.name_i18n, 'name'),
      ...i18nValues(d.line_i18n, 'line'),
      ...i18nValues(d.story_i18n, 'story'),
      ...i18nValues(d.dispute_note_i18n, 'dispute'),
      ...i18nValues(d.taste_i18n, 'taste'),
      ...i18nValues(d.served_i18n, 'served'),
      ...i18nValues(d.allergy_i18n, 'allergy'),
      slug: d.slug,
      country: d.country,
      region_id: str(d.region_id),
      type: d.type,
      price_level: str(d.price_level),
      price_text: str(d.price_text),
      must_try_rank: str(d.must_try_rank),
      sort: str(d.sort),
      cover_media_id: str(d.cover_media_id),
      verified_at: str(d.verified_at),
      status: d.status,
    }
    dietary = d.dietary ?? []
    pairings = [...d.pairings]
      .sort((a, b) => a.sort - b.sort)
      .map((p) => {
        const k = i18nValues(p.k_i18n, 'k')
        const v = i18nValues(p.v_i18n, 'v')
        return { k_th: k.k_th, k_en: k.k_en, v_th: v.v_th, v_en: v.v_en }
      })
    venues = [...d.venues]
      .sort((a, b) => a.rank - b.rank)
      .map((v) => {
        const note = i18nValues(v.note_i18n, 'note')
        return { place_id: v.place_id, region_id: str(v.region_id), rank: str(v.rank), price_text: str(v.price_text), note_th: note.note_th, note_en: note.note_en }
      })
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('dishes.newTitle') : t('dishes.editTitle')}</h1>
      <DishForm id={id} values={values} dietary={dietary} pairings={pairings} venues={venues} regions={regions} places={places} media={media} />
    </>
  )
}
