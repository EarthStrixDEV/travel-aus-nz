import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buttonClass } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { StatusPill } from '../status-pill'

export default async function CitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cities')
    .select('id, slug, name_i18n, timezone, status, regions(name_i18n)')
    .order('id')
  if (error) throw new Error('Failed to load cities')
  const cities = data ?? []

  const th = 'py-3 pr-4 text-left align-bottom eyebrow text-ink-2'
  const td = 'py-3 pr-4 align-middle'

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-ink">{t('cities.title')}</h1>
        <Link href="/admin/cities/new" className={buttonClass('primary')}>
          {t('cities.add')}
        </Link>
      </div>

      {cities.length === 0 ? (
        <p className="mt-8 text-base text-ink-2">{t('cities.empty')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm text-ink">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>{t('cities.name')}</th>
                <th scope="col" className={th}>{t('cities.slug')}</th>
                <th scope="col" className={th}>{t('cities.region')}</th>
                <th scope="col" className={th}>{t('cities.timezone')}</th>
                <th scope="col" className={th}>{t('cities.status')}</th>
                <th scope="col" className={th}>
                  <span className="sr-only">{t('cities.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.id} className="border-b border-line-2">
                  <td className={`${td} font-medium`}>{tr(c.name_i18n as Record<string, string>, locale as Locale)}</td>
                  <td className={`${td} text-ink-2`}>{c.slug}</td>
                  <td className={`${td} text-ink-2`}>
                    {tr((c.regions?.name_i18n ?? null) as Record<string, string> | null, locale as Locale)}
                  </td>
                  <td className={`${td} text-ink-2`}>{c.timezone}</td>
                  <td className={td}>
                    <StatusPill status={c.status} label={t(`status.${c.status}`)} />
                  </td>
                  <td className={`${td} text-right`}>
                    <Link
                      href={`/admin/cities/${c.id}`}
                      className="inline-flex min-h-11 items-center font-medium text-copper hover:underline"
                    >
                      {t('cities.edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
