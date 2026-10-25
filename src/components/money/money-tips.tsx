import { useTranslations } from 'next-intl'
import type { MoneyTip } from '@/lib/fx/queries'

// One icon per tip slot (card, cash, tipping, fees, ATM, GST refund); extra tips reuse them in order.
const ICONS = [
  <g key="card">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <path d="M3 10h18M7 15h4" />
  </g>,
  <g key="cash">
    <rect x="3" y="7" width="18" height="10" rx="1.5" />
    <circle cx="12" cy="12" r="2.5" />
  </g>,
  <path key="tipping" d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />,
  <g key="fees">
    <path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
    <path d="M9 10l6 6M15 10l-6 6" />
  </g>,
  <path key="atm" d="M3 10l9-6 9 6M5 20h14M7 11v8M12 11v8M17 11v8" />,
  <g key="gst">
    <path d="M2 16l20-6-3-3-6 2-6-5-2 1 4 6-5 2-2-1-1 1z" />
    <path d="M3 21h18" />
  </g>,
]

export function MoneyTips({ tips }: { tips: MoneyTip[] }) {
  const t = useTranslations('money.tips')
  return (
    <section aria-label={t('label')} className="mt-24 md:mt-[120px]">
      <p className="eyebrow text-copper">{t('eyebrow')}</p>
      <h2 className="mt-3 text-[clamp(26px,3vw,40px)] leading-[1.1] font-semibold">{t('title')}</h2>
      <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
        {tips.map((tip, i) => (
          <li key={`${i}-${tip.title}`} className="flex flex-col gap-2.5 border-t border-line pt-5">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              {ICONS[i % ICONS.length]}
            </svg>
            <h3 className="text-[17px] font-semibold">{tip.title}</h3>
            <p className="text-sm leading-[1.65] text-ink-2">{tip.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-14 max-w-[880px] rounded-lg border border-line-2 px-5 py-4 text-xs leading-[1.7] text-ink-2">{t('notice')}</p>
    </section>
  )
}
