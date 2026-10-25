import { useTranslations } from 'next-intl'
import type { EntryLink } from '@/lib/entry/helper'

export function OfficialSources({ links }: { links: EntryLink[] }) {
  const t = useTranslations('visa.sources')
  const tc = useTranslations('visa.country')
  return (
    <div aria-label={t('label')} role="group" className="min-w-0 flex-[2_1_0]">
      <p className="eyebrow text-copper">{t('eyebrow')}</p>
      <h2 className="mt-3 mb-6 text-[clamp(26px,3vw,40px)] leading-[1.1] font-semibold">{t('title')}</h2>
      {links.map((l) => (
        <a
          key={l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-5 border-t border-line-2 py-5 text-ink hover:text-copper"
        >
          <span className="flex flex-col gap-1">
            {l.country ? <span className="eyebrow text-[10px] text-ink-2">{tc(l.country === 'AU' ? 'au' : 'nz')}</span> : null}
            <span className="text-[17px] font-medium">{l.title}</span>
            <span className="text-[13px] text-ink-2">{l.domain}</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" role="img" aria-label={t('newTab')}>
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        </a>
      ))}
      <p className="mt-4 text-xs leading-[1.6] text-ink-2">{t('independent')}</p>
    </div>
  )
}
