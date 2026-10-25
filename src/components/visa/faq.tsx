'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import type { EntryFaq } from '@/lib/entry/helper'

/** Accordion. Every answer stays in the HTML (hidden when closed) so the whole FAQ is crawlable. */
export function Faq({ faqs }: { faqs: EntryFaq[] }) {
  const t = useTranslations('visa.faq')
  const base = useId()
  const [open, setOpen] = useState<number>(0)

  return (
    <div aria-label={t('label')} role="group" className="min-w-0 flex-[3_1_0]">
      <p className="eyebrow text-copper">{t('eyebrow')}</p>
      <h2 className="mt-3 mb-6 text-[clamp(26px,3vw,40px)] leading-[1.1] font-semibold">{t('title')}</h2>
      {faqs.map((f, i) => {
        const isOpen = open === i
        return (
          <div key={f.id} className="border-t border-line">
            <h3 className="m-0">
              <button
                type="button"
                id={`${base}-q${i}`}
                aria-expanded={isOpen}
                aria-controls={`${base}-a${i}`}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent py-4 text-left text-[17px] font-medium text-ink"
              >
                {f.q}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden="true"
                  className={`flex-none transition-transform duration-700 ${isOpen ? 'rotate-45' : ''}`}
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </h3>
            <div id={`${base}-a${i}`} role="region" aria-labelledby={`${base}-q${i}`} hidden={!isOpen}>
              <p className="pr-10 pb-[22px] text-[15px] leading-[1.7] text-ink-2">{f.a}</p>
            </div>
          </div>
        )
      })}
      <div className="border-t border-line" />
    </div>
  )
}
