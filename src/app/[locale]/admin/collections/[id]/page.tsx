import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { UUID_PARAM } from '../../_lib/form'
import { dishOptions, placeOptions } from '../../_lib/options'
import { i18nValues, str, type FormValues } from '../../_lib/values'
import { VENUE_TYPES } from '../../places/schema'
import { CollectionForm } from '../collection-form'

export default async function CollectionEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const isNew = rawId === 'new'
  if (!isNew && !UUID_PARAM.test(rawId)) notFound()
  const id = isNew ? null : rawId

  const supabase = await createClient()
  const [venue, place, dish] = await Promise.all([
    placeOptions(supabase, locale, [...VENUE_TYPES]),
    placeOptions(supabase, locale),
    dishOptions(supabase, locale),
  ])

  let values: FormValues = { slug: '', kind: 'venue', placement: '', status: 'draft' }
  let items: string[] = []
  if (id !== null) {
    const { data: c, error } = await supabase
      .from('collections')
      .select('*, items:collection_items(entity_id, position)')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error('Failed to load collection')
    if (!c) notFound()
    values = {
      ...i18nValues(c.title_i18n, 'title'),
      ...i18nValues(c.sub_i18n, 'sub'),
      slug: c.slug,
      kind: c.kind,
      placement: str(c.placement),
      status: c.status,
    }
    items = [...c.items].sort((a, b) => a.position - b.position).map((i) => i.entity_id)
  }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{isNew ? t('collections.newTitle') : t('collections.editTitle')}</h1>
      <CollectionForm id={id} values={values} items={items} entities={{ venue, place, dish }} />
    </>
  )
}
