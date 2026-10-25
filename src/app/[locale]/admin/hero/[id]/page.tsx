import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { SERIAL_PARAM } from '../../_lib/form'
import { mediaOptions, placeOptions } from '../../_lib/options'
import { i18nValues, str, type FormValues } from '../../_lib/values'
import { HeroForm } from '../hero-form'

export default async function HeroEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !SERIAL_PARAM.test(rawId)) notFound()
  const id = isNew ? null : Number(rawId)

  const supabase = await createClient()
  const [media, places] = await Promise.all([mediaOptions(supabase, t('form.unlicensed')), placeOptions(supabase, locale)])

  let values: FormValues = { media_id: '', place_id: '', sort: '0', active: 'true' }
  if (id !== null) {
    const { data: s, error } = await supabase.from('hero_slides').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load hero slide')
    if (!s) notFound()
    values = {
      ...i18nValues(s.caption_i18n, 'caption'),
      media_id: str(s.media_id),
      place_id: str(s.place_id),
      sort: str(s.sort),
      active: String(s.active ?? false),
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('hero.newTitle') : t('hero.editTitle')}</h1>
      <HeroForm id={id} values={values} options={{ media, places }} />
    </>
  )
}
