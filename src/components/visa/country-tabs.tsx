'use client'

import { useTranslations } from 'next-intl'
import { Segmented } from '@/components/money/segmented'

export type CountryTab = 'au' | 'nz' | 'both'

/** AU / NZ / Both switch, plus the standing "entry rules change" banner. */
export function CountryTabs({ value, onChange }: { value: CountryTab; onChange: (v: CountryTab) => void }) {
  const t = useTranslations('visa')
  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="eyebrow text-ink-2">{t('country.label')}</p>
        <Segmented<CountryTab>
          label={t('country.label')}
          value={value}
          onChange={onChange}
          options={[
            { value: 'au', label: t('country.au') },
            { value: 'nz', label: t('country.nz') },
            { value: 'both', label: t('country.both') },
          ]}
        />
      </div>
      <div role="note" className="mt-6 flex items-center gap-4 rounded-[10px] border border-copper bg-copper-tint px-5 py-4 md:px-6 md:py-[18px]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true" className="flex-none text-copper">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16v.5" />
        </svg>
        <p className="text-[15px] leading-[1.55]">
          <span className="font-semibold">{t('banner.title')}</span> {t('banner.text')}
        </p>
      </div>
    </div>
  )
}
