import { useTranslations } from 'next-intl'
import { convert, crossRate, formatNumber } from '@/lib/fx/convert'

const QUICK_AUD = [100, 500, 1000]

/** AUD ↔ NZD cross rate straight from the snapshot (the Tasman crossing). */
export function CrossRate({ rates }: { rates: Record<string, number> | null }) {
  const t = useTranslations('money.cross')
  const cross = rates ? crossRate(rates) : NaN
  const ok = Number.isFinite(cross) && cross > 0
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-5 rounded-[10px] border border-line px-5 py-6 md:px-7">
      <div className="min-w-[200px] flex-1">
        <p className="eyebrow text-copper">{t('eyebrow')}</p>
        <h2 className="mt-2 text-lg font-semibold">{t('title')}</h2>
        <p className="mt-1 text-[13px] leading-[1.6] text-ink-2">{t('text')}</p>
      </div>
      <div className="flex flex-col gap-1.5 tabular-nums">
        <p className="text-[22px] font-medium">{t('audToNzd', { rate: ok ? formatNumber(cross, 4) : '—' })}</p>
        <p className="text-sm text-ink-2">{t('nzdToAud', { rate: ok ? formatNumber(1 / cross, 4) : '—' })}</p>
      </div>
      <ul aria-label={t('quick')} className="flex border-l border-line-2 tabular-nums">
        {QUICK_AUD.map((a) => (
          <li key={a} className="flex flex-col gap-1 px-4 md:px-[18px]">
            <span className="text-xs text-ink-2">A${formatNumber(a, 0)}</span>
            <span className="text-[15px] font-medium">NZ${ok && rates ? formatNumber(convert(a, 'AUD', 'NZD', rates)) : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
