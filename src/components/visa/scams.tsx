import { useTranslations } from 'next-intl'

// Fixed accent: the theme copper is under 3:1 on the deep panel in light mode.
const ACCENT = 'text-[#D08A5E]'

export function Scams() {
  const t = useTranslations('visa.scams')
  return (
    <aside aria-label={t('label')} className="flex min-w-0 flex-[2_1_0] flex-col gap-5 rounded-xl bg-deep p-6 text-on-deep md:p-10 print:hidden">
      <div className="flex items-center gap-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D08A5E" strokeWidth="1.4" aria-hidden="true">
          <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
          <path d="M12 8v5M12 16v.5" />
        </svg>
        <p className={`eyebrow ${ACCENT}`}>{t('eyebrow')}</p>
      </div>
      <h2 className="text-[26px] leading-[1.2] font-semibold">{t('title')}</h2>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0 text-sm leading-[1.6] text-on-deep/85">
        {(['i1', 'i2', 'i3'] as const).map((k) => (
          <li key={k} className="flex gap-3">
            <span aria-hidden="true" className="mt-[9px] size-1.5 flex-none rounded-full bg-[#D08A5E]" />
            {t(k)}
          </li>
        ))}
      </ul>
      <div className="border-t border-on-deep/15 pt-[18px]">
        <p className="eyebrow text-on-deep/70">{t('domainTitle')}</p>
        <div className="mt-3.5 flex flex-col gap-2.5 text-sm">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-md border border-on-deep/20 px-3.5 py-3">
            <span>
              immi.homeaffairs<span className={`font-medium ${ACCENT}`}>.gov.au</span>
            </span>
            <span className="text-xs text-on-deep/70">{t('au')}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-md border border-on-deep/20 px-3.5 py-3">
            <span>
              immigration<span className={`font-medium ${ACCENT}`}>.govt.nz</span>
            </span>
            <span className="text-xs text-on-deep/70">{t('nz')}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-md border border-dashed border-on-deep/25 px-3.5 py-3 text-on-deep/60">
            <span className="line-through">fast-eta-visa.example</span>
            <span className="text-xs">{t('fake')}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
