import { getTranslations, setRequestLocale } from 'next-intl/server'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { AdminList } from '../_lib/admin-list'
import { presetKey, type PresetKey } from './schema'

export default async function FxReferencePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const [items, presets] = await Promise.all([
    supabase.from('cost_reference_items').select('id, item_i18n, aud, nzd, verified_at, sort').order('sort').order('id'),
    supabase.from('budget_presets').select('country, style, per_day, note_i18n').order('country').order('style'),
  ])
  if (items.error || presets.error) throw new Error('Failed to load FX reference content')
  const name = (v: unknown) => tr(v as Record<string, string> | null, locale as Locale)
  const common = { level: 'h2' as const, editLabel: t('form.edit'), actionsLabel: t('form.actions') }

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{t('fx.title')}</h1>
      <div className="mt-8">
        <AdminList
          {...common}
          title={t('fx.items')}
          addHref="/admin/fx-reference/items/new"
          addLabel={t('fx.addItem')}
          empty={t('fx.emptyItems')}
          columns={[t('fx.item'), t('fx.aud'), t('fx.nzd'), t('fields.verifiedAt'), t('fields.sort')]}
          rows={items.data.map((i) => ({
            key: String(i.id),
            href: `/admin/fx-reference/items/${i.id}`,
            cells: [name(i.item_i18n), i.aud ?? '—', i.nzd ?? '—', i.verified_at, i.sort ?? '—'],
          }))}
        />
        <AdminList
          {...common}
          title={t('fx.presets')}
          addHref="/admin/fx-reference/presets/new"
          addLabel={t('fx.addPreset')}
          empty={t('fx.emptyPresets')}
          columns={[t('fields.country'), t('fx.style'), t('fx.perDay'), t('fx.note')]}
          rows={presets.data.flatMap((p) => {
            if (!p.country || !p.style) return []
            const key = presetKey(p as PresetKey)
            return [
              {
                key,
                href: `/admin/fx-reference/presets/${key}`,
                cells: [p.country, t(`fx.styles.${p.style as PresetKey['style']}`), p.per_day, name(p.note_i18n) || '—'],
              },
            ]
          })}
        />
      </div>
    </>
  )
}
