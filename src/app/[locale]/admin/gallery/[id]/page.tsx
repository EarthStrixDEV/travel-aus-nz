import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { UUID_PARAM } from '../../_lib/form'
import { mediaOptions, placeOptions, regionOptions } from '../../_lib/options'
import { i18nValues, str, type FormValues } from '../../_lib/values'
import { GalleryForm } from '../gallery-form'

export default async function GalleryEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !UUID_PARAM.test(rawId)) notFound()
  const id = isNew ? null : rawId

  const supabase = await createClient()
  const [media, places, regions] = await Promise.all([
    mediaOptions(supabase, t('form.unlicensed')),
    placeOptions(supabase, locale),
    regionOptions(supabase, locale),
  ])

  let values: FormValues = { media_id: '', place_id: '', region_id: '', season: '', sort: '0', status: 'draft' }
  if (id !== null) {
    const { data: g, error } = await supabase.from('gallery_photos').select('*').eq('id', id).maybeSingle()
    if (error) throw new Error('Failed to load gallery photo')
    if (!g) notFound()
    values = {
      ...i18nValues(g.title_i18n, 'title'),
      media_id: g.media_id,
      place_id: g.place_id,
      region_id: str(g.region_id),
      season: str(g.season),
      sort: str(g.sort),
      status: g.status,
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('gallery.newTitle') : t('gallery.editTitle')}</h1>
      <GalleryForm id={id} values={values} options={{ media, places, regions }} />
    </>
  )
}
