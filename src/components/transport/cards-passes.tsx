import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import type { CardInfo } from '@/lib/content/transport'

const ICONS = {
  cards: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  passes: (
    <>
      <path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z" />
      <path d="M10 7v12" />
    </>
  ),
  access: (
    <>
      <circle cx="12" cy="4.5" r="1.5" />
      <path d="M9 21l1.5-7H14l2 4M12 7v5h4M8.5 10.5a5 5 0 1 0 6.5 7" />
    </>
  ),
}

function Tip({ icon, title, children }: { icon: keyof typeof ICONS; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-5">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
        {ICONS[icon]}
      </svg>
      <h3 className="text-lg font-semibold">{title}</h3>
      {children}
    </div>
  )
}

/**
 * §7 "Cards, passes & access": the `transit_cards` rows (how to pay, caps, official link), then the editorial
 * `transport_tips` block. Each column falls back to bundled copy when its data is missing.
 */
export function CardsPasses({ cards, tips }: { cards: CardInfo[]; tips: string | null }) {
  const t = useTranslations('transport.tips')
  const body = 'text-sm leading-[1.7] text-ink-2'

  return (
    <section aria-labelledby="transport-tips" className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-24 pb-28 md:pt-[120px] md:pb-[140px]">
      <p className="eyebrow text-copper">{t('eyebrow')}</p>
      <h2 id="transport-tips" className="mt-3.5 text-[28px] leading-[1.1] font-semibold md:text-[clamp(28px,3vw,40px)]">
        {t('title')}
      </h2>
      <div className="mt-11 grid gap-10 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        <Tip icon="cards" title={t('cards')}>
          {cards.length === 0 ? (
            <p className={body}>{t('cardsFallback')}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {cards.map((c) => (
                <li key={`${c.city}:${c.name}`} className={body}>
                  <p>
                    <span className="font-medium text-ink">{c.cityName ? `${c.cityName}: ${c.name}` : c.name}</span>
                    {c.howTo && <> · {c.howTo}</>}
                  </p>
                  {c.caps && <p>{c.caps}</p>}
                  {c.contactless && <p>{t('contactless')}</p>}
                  {c.officialUrl && (
                    <a href={c.officialUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-copper underline-offset-4 hover:underline">
                      {t('official', { name: c.name })}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Tip>
        <Tip icon="passes" title={t('passes')}>
          <p className={`${body} whitespace-pre-line`}>{tips ?? t('passesFallback')}</p>
        </Tip>
        <Tip icon="access" title={t('access')}>
          <p className={body}>{t('accessText')}</p>
        </Tip>
      </div>
    </section>
  )
}
