import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { CityForm, type CityFormValues } from '../city-form'
import { parsePoint } from '../geo'

export default async function CityEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin.cities')

  // "new" creates; anything else must be a positive integer id.
  const isNew = rawId === 'new'
  if (!isNew && !/^[1-9]\d{0,9}$/.test(rawId)) notFound()
  const id = isNew ? null : Number(rawId)

  const supabase = await createClient()
  const { data: regions, error: regionsError } = await supabase
    .from('regions')
    .select('id, country, name_i18n')
    .order('country')
    .order('slug')
  if (regionsError) throw new Error('Failed to load regions')
  const regionOptions = (regions ?? []).map((r) => ({
    value: String(r.id),
    label: `${r.country} · ${tr(r.name_i18n as Record<string, string>, locale as Locale)}`,
  }))

  let values: CityFormValues = {
    region_id: regionOptions[0]?.value ?? '',
    slug: '',
    name_th: '',
    name_en: '',
    timezone: '',
    lng: '',
    lat: '',
    status: 'draft',
  }

  if (id !== null) {
    const { data: city, error } = await supabase.from('cities').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load city')
    if (!city) notFound()
    const names = city.name_i18n as { th?: string; en?: string }
    const point = parsePoint(city.center)
    values = {
      region_id: String(city.region_id),
      slug: city.slug,
      name_th: names.th ?? '',
      name_en: names.en ?? '',
      timezone: city.timezone,
      lng: point ? String(point.lng) : '',
      lat: point ? String(point.lat) : '',
      status: city.status,
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('newTitle') : t('editTitle')}</h1>
      <CityForm id={id} values={values} regions={regionOptions} />
    </>
  )
}
