import { useLocale, useTranslations } from 'next-intl'
import { convert, formatHome } from '@/lib/fx/convert'
import { formatMonthYear } from '@/lib/fx/format'
import type { CostItem } from '@/lib/fx/queries'
import type { Locale } from '@/lib/i18n/t'
import { formatMoney } from '@/lib/format/money'
import { PlaceholderTag } from './placeholder-tag'

/** Typical prices in local A$ / NZ$, each converted to the home currency with the snapshot on the page. */
export function CostTable({
  costs,
  verifiedAt,
  home,
  rates,
}: {
  costs: CostItem[]
  verifiedAt: string | null
  home: string
  rates: Record<string, number> | null
}) {
  const t = useTranslations('money.cost')
  const locale = useLocale() as Locale
  if (!costs.length) return null

  const local = (amount: number | null, currency: 'AUD' | 'NZD') => (amount === null ? '—' : formatMoney(amount, currency))
  const inHome = (amount: number | null, currency: 'AUD' | 'NZD') =>
    amount === null || !rates ? '—' : formatHome(convert(amount, currency, home, rates), home)
  const homeHeading = t('inHome', { home })

  return (
    <section aria-label={t('label')} className="mt-24 md:mt-[120px]">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
        <div>
          <p className="eyebrow text-copper">{t('eyebrow')}</p>
          <h2 className="mt-3 flex flex-wrap items-center gap-3 text-[clamp(26px,3vw,40px)] leading-[1.1] font-semibold">
            {t('title')}
            <PlaceholderTag />
          </h2>
        </div>
        <p className="text-[13px] text-ink-2">{t('sub', { month: verifiedAt ? formatMonthYear(verifiedAt, locale) : '', home })}</p>
      </div>

      <table className="mt-2 w-full border-collapse tabular-nums max-md:hidden">
        <thead>
          <tr className="text-right text-[11px] font-medium tracking-[.2em] text-ink-2 uppercase">
            <th scope="col" className="border-b border-line pt-6 pb-3.5 text-left font-medium">
              {t('item')}
            </th>
            <th scope="col" className="border-b border-line pt-6 pb-3.5 font-medium">
              {t('australia')}
            </th>
            <th scope="col" className="border-b border-line pt-6 pb-3.5 font-medium">
              {homeHeading}
            </th>
            <th scope="col" className="border-b border-line pt-6 pb-3.5 font-medium">
              {t('newZealand')}
            </th>
            <th scope="col" className="border-b border-line pt-6 pb-3.5 font-medium">
              {homeHeading}
            </th>
          </tr>
        </thead>
        <tbody>
          {costs.map((c) => (
            <tr key={c.id} className="text-right text-[15px]">
              <td className="border-b border-line-2 py-[18px] text-left">
                <span className="font-medium">{c.item}</span>
                {c.note ? <span className="mt-0.5 block text-[13px] text-ink-2">{c.note}</span> : null}
              </td>
              <td className="border-b border-line-2 py-[18px]">{local(c.aud, 'AUD')}</td>
              <td className="border-b border-line-2 py-[18px] text-sm text-ink-2">{inHome(c.aud, 'AUD')}</td>
              <td className="border-b border-line-2 py-[18px]">{local(c.nzd, 'NZD')}</td>
              <td className="border-b border-line-2 py-[18px] text-sm text-ink-2">{inHome(c.nzd, 'NZD')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="md:hidden">
        {costs.map((c) => (
          <li key={c.id} className="border-b border-line-2 py-4 tabular-nums">
            <p className="text-[15px] font-medium">{c.item}</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-ink-2">{t('australia')}</p>
                <p className="text-sm">{local(c.aud, 'AUD')}</p>
                <p className="text-xs text-ink-2">{inHome(c.aud, 'AUD')}</p>
              </div>
              <div>
                <p className="text-xs text-ink-2">{t('newZealand')}</p>
                <p className="text-sm">{local(c.nzd, 'NZD')}</p>
                <p className="text-xs text-ink-2">{inHome(c.nzd, 'NZD')}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
