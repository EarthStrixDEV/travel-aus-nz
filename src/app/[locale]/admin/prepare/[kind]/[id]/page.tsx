import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import type { Json, Tables } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { SERIAL_PARAM } from '../../../_lib/form'
import { i18nValues, str, type FormValues } from '../../../_lib/values'
import { BlockForm, ChecklistForm, ConnectivityForm, MonthsForm, PackingForm, type BlockItemValues, type MonthValues } from '../../forms'
import { isBlockKey } from '../../schema'

const KINDS = ['checklist', 'packing', 'connectivity', 'months', 'blocks'] as const
type Kind = (typeof KINDS)[number]
const isKind = (k: string): k is Kind => (KINDS as readonly string[]).includes(k)

/** Edit page for Prepare content: `/admin/prepare/<kind>/<id | new>`; months take a region id, blocks a key. */
export default async function PrepareEditPage({ params }: { params: Promise<{ locale: string; kind: string; id: string }> }) {
  const { locale, kind, id: rawId } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')
  if (!isKind(kind)) notFound()
  const db = await createClient()

  function row<T>({ data, error }: { data: T | null; error: unknown }, required: boolean): T | null {
    if (error) throw new Error(`Failed to load ${kind}`)
    if (required && !data) notFound()
    return data
  }

  if (kind === 'blocks') {
    if (!isBlockKey(rawId)) notFound()
    const b = row<Tables<'content_blocks'>>(await db.from('content_blocks').select('*').eq('key', rawId).maybeSingle(), false)
    const body = (b?.body_i18n ?? {}) as Record<string, Json>
    let values: FormValues = { verified_at: str(b?.verified_at) }
    let items: BlockItemValues[] = []
    if (rawId === 'transport_tips') {
      values = { ...values, ...i18nValues(b?.body_i18n, 'body') }
    } else {
      const list = (lang: 'en' | 'th') => (Array.isArray(body[lang]) ? (body[lang] as { title?: string; text?: string; icon?: string }[]) : [])
      const en = list('en')
      const th = list('th')
      items = Array.from({ length: Math.max(en.length, th.length) }, (_, i) => ({
        title_en: str(en[i]?.title),
        text_en: str(en[i]?.text),
        title_th: str(th[i]?.title),
        text_th: str(th[i]?.text),
        icon: str(en[i]?.icon ?? th[i]?.icon),
      }))
    }
    return (
      <>
        <h1 className="text-3xl font-semibold text-ink">{t(`prepare.blockKeys.${rawId}`)}</h1>
        <BlockForm blockKey={rawId} values={values} items={items} />
      </>
    )
  }

  const isNew = rawId === 'new'
  if ((isNew && kind === 'months') || (!isNew && !SERIAL_PARAM.test(rawId))) notFound()
  const id = isNew ? null : Number(rawId)

  if (kind === 'months') {
    const region = row<{ id: number; name_i18n: Json }>(await db.from('regions').select('id, name_i18n').eq('id', id!).maybeSingle(), true)!
    const { data, error } = await db.from('region_months').select('month, comfort, crowds, recommended').eq('region_id', id!)
    if (error) throw new Error('Failed to load months')
    const byMonth = new Map((data ?? []).map((m) => [m.month, m]))
    const months: MonthValues[] = Array.from({ length: 12 }, (_, i) => {
      const m = byMonth.get(i + 1)
      return { comfort: str(m?.comfort), crowds: str(m?.crowds), recommended: !!m?.recommended }
    })
    const name = i18nValues(region.name_i18n, 'name')
    return (
      <>
        <h1 className="text-3xl font-semibold text-ink">{t('prepare.monthsFor', { region: (locale === 'th' ? name.name_th : name.name_en) || name.name_en })}</h1>
        <MonthsForm regionId={region.id} months={months} />
      </>
    )
  }

  const heading = <h1 className="text-3xl font-semibold text-ink">{t(`prepare.${isNew ? 'new' : 'edit'}.${kind}`)}</h1>

  if (kind === 'checklist') {
    const c = id === null ? null : row<Tables<'checklist_templates'>>(await db.from('checklist_templates').select('*').eq('id', id).maybeSingle(), true)
    const values: FormValues = {
      ...i18nValues(c?.title_i18n, 'title'),
      ...i18nValues(c?.note_i18n, 'note'),
      moment: c?.moment ?? '3m',
      slug: str(c?.slug),
      sort: str(c?.sort ?? 0),
    }
    return (
      <>
        {heading}
        <ChecklistForm id={id} values={values} appliesTo={c?.applies_to ?? ['AU', 'NZ']} />
      </>
    )
  }

  if (kind === 'packing') {
    const p = id === null ? null : row<Tables<'packing_items'>>(await db.from('packing_items').select('*').eq('id', id).maybeSingle(), true)
    const values: FormValues = { ...i18nValues(p?.title_i18n, 'title'), season: p?.season ?? 'summer', grp: str(p?.grp), sort: str(p?.sort ?? 0) }
    return (
      <>
        {heading}
        <PackingForm id={id} values={values} />
      </>
    )
  }

  const c = id === null ? null : row<Tables<'connectivity_options'>>(await db.from('connectivity_options').select('*').eq('id', id).maybeSingle(), true)
  const values: FormValues = {
    ...i18nValues(c?.name_i18n, 'name'),
    ...i18nValues(c?.setup_i18n, 'setup'),
    ...i18nValues(c?.best_i18n, 'best'),
    ...i18nValues(c?.watch_i18n, 'watch'),
    cost_text: str(c?.cost_text),
    verified_at: str(c?.verified_at),
  }
  return (
    <>
      {heading}
      <ConnectivityForm id={id} values={values} />
    </>
  )
}
