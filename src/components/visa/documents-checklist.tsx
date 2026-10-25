'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import type { EntryDocument } from '@/lib/entry/helper'
import type { CountryTab } from './country-tabs'

/** Device-only. Not a saved item and not synced, so it is allowed without an account. */
const STORAGE_KEY = 'tanz:v1:visa-docs'

type Ticks = Record<string, boolean>

function readTicks(): Ticks {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => v === true))
  } catch {
    return {}
  }
}

function writeTicks(ticks: Ticks): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ticks))
  } catch {
    // Storage blocked or full: the ticks still work for this visit.
  }
}

export function DocumentsChecklist({ documents, country }: { documents: EntryDocument[]; country: CountryTab }) {
  const t = useTranslations('visa.documents')
  const [ticks, setTicks] = useState<Ticks>({})

  // After mount, so the prerendered HTML and the first client render agree.
  useEffect(() => {
    setTicks(readTicks())
  }, [])

  const code = country === 'both' ? null : country === 'au' ? 'AU' : 'NZ'
  const items = documents.filter((d) => !code || d.appliesTo.includes(code))
  const done = items.filter((d) => ticks[d.slug]).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0

  function toggle(slug: string) {
    const next = { ...ticks }
    if (next[slug]) delete next[slug]
    else next[slug] = true
    setTicks(next)
    writeTicks(next)
  }

  function print() {
    try {
      window.print()
    } catch {
      // Printing blocked: nothing to do.
    }
  }

  return (
    <div aria-label={t('label')} role="group" className="min-w-0 flex-[3_1_0]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-copper">{t('eyebrow')}</p>
          <h2 className="mt-3 text-[clamp(26px,3vw,40px)] leading-[1.1] font-semibold">{t('title')}</h2>
        </div>
        <div className="flex items-center gap-3.5">
          <span className="text-[13px] text-ink-2" aria-live="polite">
            {t('progress', { done, total: items.length })}
          </span>
          <button
            type="button"
            onClick={print}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-line px-5 text-sm font-medium text-ink transition-colors duration-500 hover:border-ink print:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" />
            </svg>
            {t('print')}
          </button>
        </div>
      </div>
      <div className="mb-2 h-0.5 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
        <span className="block h-full bg-copper transition-[width] duration-1000 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <p className="mb-1 text-xs text-ink-2 print:hidden">{t('device')}</p>
      {items.length ? (
        items.map((d) => {
          const on = !!ticks[d.slug]
          return (
            <button
              key={d.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(d.slug)}
              className="flex w-full cursor-pointer items-start gap-4 border-0 border-t border-line-2 bg-transparent py-[18px] text-left text-ink"
            >
              <span
                className={`mt-px flex size-[22px] flex-none items-center justify-center rounded-[4px] border-[1.5px] transition-colors duration-500 ${on ? 'border-copper text-copper' : 'border-ink'}`}
              >
                {on ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                ) : null}
              </span>
              <span className="flex flex-col gap-1">
                <span className={`text-base font-medium ${on ? 'text-ink-2 line-through decoration-ink-3' : ''}`}>{d.title}</span>
                {d.note ? <span className="text-[13px] leading-[1.6] text-ink-2">{d.note}</span> : null}
              </span>
            </button>
          )
        })
      ) : (
        <p className="border-t border-line-2 pt-5 text-sm text-ink-2">{t('empty')}</p>
      )}
    </div>
  )
}
