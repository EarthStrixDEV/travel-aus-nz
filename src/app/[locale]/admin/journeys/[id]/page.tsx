import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { UUID_PARAM } from '../../_lib/form'
import { mediaOptions } from '../../_lib/options'
import { i18nValues, str, type FormValues } from '../../_lib/values'
import { JourneyForm, type LegValues } from '../journey-form'

export default async function JourneyEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !UUID_PARAM.test(rawId)) notFound()
  const id = isNew ? null : rawId

  const supabase = await createClient()
  const media = await mediaOptions(supabase, t('form.unlicensed'))

  let values: FormValues = { slug: '', kind: 'itinerary', country: '', cover_media_id: '', status: 'draft' }
  let modes: string[] = []
  let legs: LegValues[] = []
  if (id !== null) {
    const { data: j, error } = await supabase
      .from('journeys')
      .select('*, legs:journey_legs(seq, day, mode, from_name, to_name, operator, duration_min, frequency_text)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error('Failed to load journey')
    if (!j) notFound()
    values = {
      ...i18nValues(j.title_i18n, 'title'),
      ...i18nValues(j.line_i18n, 'line'),
      slug: j.slug,
      kind: j.kind,
      country: str(j.country),
      from_name: str(j.from_name),
      to_name: str(j.to_name),
      days: str(j.days),
      price_from: str(j.price_from),
      currency: str(j.currency),
      cover_media_id: str(j.cover_media_id),
      status: j.status,
    }
    modes = j.modes ?? []
    legs = [...j.legs]
      .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
      .map((l) => ({
        mode: l.mode,
        from_name: str(l.from_name),
        to_name: str(l.to_name),
        operator: str(l.operator),
        duration_min: str(l.duration_min),
        frequency_text: str(l.frequency_text),
        day: str(l.day),
      }))
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('journeys.newTitle') : t('journeys.editTitle')}</h1>
      <JourneyForm id={id} values={values} modes={modes} legs={legs} media={media} />
    </>
  )
}
