import type { ReactNode } from 'react'
import { buttonClass } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'

export type ListRow = { key: string; href: string; cells: ReactNode[] }

const th = 'py-3 pr-4 text-left align-bottom eyebrow text-ink-2'
const td = 'py-3 pr-4 align-middle'

/**
 * Title + "Add" + table of rows with an Edit link, as on the cities list. The first cell is
 * emphasised; `level` lets one page hold several lists (entry, FX reference).
 */
export function AdminList({
  title,
  level = 'h1',
  addHref,
  addLabel,
  empty,
  columns,
  rows,
  editLabel,
  actionsLabel,
}: {
  title: string
  level?: 'h1' | 'h2'
  addHref?: string
  addLabel?: string
  empty: string
  columns: string[]
  rows: ListRow[]
  editLabel: string
  actionsLabel: string
}) {
  const Heading = level
  return (
    <section className={level === 'h2' ? 'mt-12 first:mt-0' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading className={level === 'h1' ? 'text-3xl font-semibold text-ink' : 'text-xl font-semibold text-ink'}>{title}</Heading>
        {addHref && addLabel && (
          <Link href={addHref} className={buttonClass('primary')}>
            {addLabel}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-base text-ink-2">{empty}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm text-ink">
            <thead>
              <tr className="border-b border-line">
                {columns.map((c) => (
                  <th key={c} scope="col" className={th}>
                    {c}
                  </th>
                ))}
                <th scope="col" className={th}>
                  <span className="sr-only">{actionsLabel}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-line-2">
                  {r.cells.map((cell, i) => (
                    <td key={i} className={i === 0 ? `${td} font-medium` : `${td} text-ink-2`}>
                      {cell}
                    </td>
                  ))}
                  <td className={`${td} text-right`}>
                    <Link href={r.href} className="inline-flex min-h-11 items-center font-medium text-copper hover:underline">
                      {editLabel}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
