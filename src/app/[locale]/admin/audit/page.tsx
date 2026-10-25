import { getTranslations, setRequestLocale } from 'next-intl/server'
import { buttonClass } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import { decodeCursor, encodeCursor } from '@/lib/api/cursor'
import { requireRole } from '@/lib/auth/profile'
import { createServiceClient } from '@/lib/supabase/service'

const PAGE_SIZE = 100

// Cursor values are interpolated into a PostgREST filter, so only accept exact shapes.
const AT_SHAPE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/
const ID_SHAPE = /^\d{1,18}$/

/** A malformed, tampered or foreign cursor falls back to the first page instead of erroring. */
function parseCursor(raw: string | string[] | undefined): { at: string; id: string } | null {
  if (typeof raw !== 'string') return null
  const c = decodeCursor(raw)
  if (!c || typeof c.sort !== 'string') return null
  if (!AT_SHAPE.test(c.sort) || !ID_SHAPE.test(c.id)) return null
  return { at: c.sort, id: c.id }
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ cursor?: string | string[] }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  // The service client bypasses RLS, so guard here too: layouts don't re-run on client navigation.
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin.audit')
  const cursor = parseCursor((await searchParams).cursor)

  let query = createServiceClient()
    .from('audit_log')
    .select('id, table_name, row_id, action, actor, at')
    .order('at', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)
  if (cursor) query = query.or(`at.lt."${cursor.at}",and(at.eq."${cursor.at}",id.lt.${cursor.id})`)

  const { data, error } = await query
  if (error) throw new Error('Failed to load audit log')
  const rows = data ?? []
  const page = rows.slice(0, PAGE_SIZE)
  const last = page[page.length - 1]
  const nextCursor = rows.length > PAGE_SIZE && last?.at ? encodeCursor({ sort: last.at, id: String(last.id) }) : null

  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC', timeZoneName: 'short' })
  const th = 'py-3 pr-4 text-left align-bottom eyebrow text-ink-2'
  const td = 'py-3 pr-4 align-top'

  return (
    <>
      <h1 className="text-3xl font-semibold text-ink">{t('title')}</h1>

      {page.length === 0 ? (
        <p className="mt-8 text-base text-ink-2">{t('empty')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm text-ink">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={th}>{t('at')}</th>
                <th scope="col" className={th}>{t('table')}</th>
                <th scope="col" className={th}>{t('row')}</th>
                <th scope="col" className={th}>{t('action')}</th>
                <th scope="col" className={th}>{t('actor')}</th>
              </tr>
            </thead>
            <tbody>
              {page.map((r) => (
                <tr key={r.id} className="border-b border-line-2">
                  <td className={`${td} whitespace-nowrap text-ink-2`}>
                    {r.at ? <time dateTime={r.at}>{when.format(new Date(r.at))}</time> : '—'}
                  </td>
                  <td className={td}>{r.table_name}</td>
                  <td className={`${td} break-all text-ink-2`}>{r.row_id}</td>
                  <td className={`${td} font-medium`}>{r.action}</td>
                  <td className={`${td} break-all text-ink-2`}>{r.actor ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <div className="mt-6">
          <Link href={{ pathname: '/admin/audit', query: { cursor: nextCursor } }} className={buttonClass('ghost')}>
            {t('older')}
          </Link>
        </div>
      )}
    </>
  )
}
