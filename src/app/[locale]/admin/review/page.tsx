import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { requireRole } from '@/lib/auth/profile'
import { t as tr, type Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ruleKey, type RuleKey } from '../entry/schema'
import { resolveFeedback } from './actions'

type Feedback = { id: number; entity: string | null; kind: string | null; note: string | null; created_at: string | null }

/** content_feedback is service-role only; a missing/invalid key must not take the whole queue down. */
async function loadFeedback(): Promise<Feedback[] | null> {
  try {
    const { data, error } = await createServiceClient()
      .from('content_feedback')
      .select('id, entity, kind, note, created_at')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(200)
    return error ? null : data
  } catch {
    return null
  }
}

const th = 'py-3 pr-4 text-left align-bottom eyebrow text-ink-2'
const td = 'py-3 pr-4 align-top'
const link = 'inline-flex min-h-11 items-center font-medium text-copper hover:underline'

export default async function ReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  // The service client bypasses RLS, so guard here too: layouts don't re-run on client navigation.
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  const supabase = await createClient()
  const [permissions, rules, feedback] = await Promise.all([
    supabase.from('permission_types').select('id, country, name_i18n').eq('needs_review', true).order('id'),
    supabase.from('entry_rules').select('nationality, country, purpose, stay').eq('needs_review', true).order('nationality'),
    loadFeedback(),
  ])
  if (permissions.error || rules.error) throw new Error('Failed to load review queue')

  const entryRows = [
    ...permissions.data.map((p) => ({
      key: `p${p.id}`,
      label: `${t('entry.permissions')} · ${p.country} · ${tr(p.name_i18n as Record<string, string> | null, locale as Locale)}`,
      href: `/admin/entry/permissions/${p.id}`,
    })),
    ...rules.data.map((r) => {
      const key = ruleKey(r as RuleKey)
      return { key: `r${key}`, label: `${t('entry.rules')} · ${key}`, href: `/admin/entry/rules/${key}` }
    }),
  ]
  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC', timeZoneName: 'short' })

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{t('review.title')}</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-ink">{t('review.entry')}</h2>
        {entryRows.length === 0 ? (
          <p className="mt-4 text-base text-ink-2">{t('review.entryEmpty')}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line-2 border-y border-line-2">
            {entryRows.map((r) => (
              <li key={r.key} className="flex flex-wrap items-center justify-between gap-4 py-1 text-sm text-ink">
                <span>{r.label}</span>
                <Link href={r.href} className={link}>
                  {t('review.open')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-ink">{t('review.feedback')}</h2>
        {feedback === null ? (
          <p role="alert" className="mt-4 text-[13px] text-copper">
            {t('review.feedbackError')}
          </p>
        ) : feedback.length === 0 ? (
          <p className="mt-4 text-base text-ink-2">{t('review.feedbackEmpty')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm text-ink">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={th}>{t('review.at')}</th>
                  <th scope="col" className={th}>{t('review.entity')}</th>
                  <th scope="col" className={th}>{t('review.kind')}</th>
                  <th scope="col" className={th}>{t('review.note')}</th>
                  <th scope="col" className={th}>
                    <span className="sr-only">{t('form.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((f) => (
                  <tr key={f.id} className="border-b border-line-2">
                    <td className={`${td} whitespace-nowrap text-ink-2`}>
                      {f.created_at ? <time dateTime={f.created_at}>{when.format(new Date(f.created_at))}</time> : '—'}
                    </td>
                    <td className={`${td} break-all`}>{f.entity ?? '—'}</td>
                    <td className={`${td} text-ink-2`}>{f.kind ?? '—'}</td>
                    <td className={`${td} text-ink-2`}>{f.note ?? '—'}</td>
                    <td className={`${td} text-right`}>
                      <form action={resolveFeedback}>
                        <input type="hidden" name="id" value={f.id} />
                        <Button type="submit" variant="ghost">
                          {t('review.resolve')}
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
