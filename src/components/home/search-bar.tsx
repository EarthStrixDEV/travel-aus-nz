'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { buttonClass } from '@/components/ui/button'
import type { InterestTag } from '@/lib/content/home'
import { Link } from '@/i18n/navigation'
import { track } from '@/lib/analytics/track'

type Result = { kind: 'place' | 'region' | 'journey'; slug: string; name: string; sub: string }
type State = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: 'failed' | 'rateLimited' } | { status: 'done'; results: Result[] }

const HREF: Record<Result['kind'], (slug: string) => string> = {
  place: (slug) => `/map?place=${encodeURIComponent(slug)}`,
  region: (slug) => `/gallery?region=${encodeURIComponent(slug)}`,
  journey: (slug) => `/transport?journey=${encodeURIComponent(slug)}`,
}

const fieldClass =
  'flex flex-col gap-1.5 px-4 py-3 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-copper md:px-6 md:py-4'
const inputClass =
  'w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-[15px] font-normal text-ink outline-none placeholder:text-ink-2'

/** Where / When / Interests search (the hero form). Calls GET /api/v1/search; never sends the raw query to analytics. */
export function SearchBar({ interests }: { interests: InterestTag[] }) {
  const t = useTranslations('home.search')
  const locale = useLocale()
  const [q, setQ] = useState('')
  const [month, setMonth] = useState('')
  const [interest, setInterest] = useState('')
  const [tooShort, setTooShort] = useState(false)
  const [state, setState] = useState<State>({ status: 'idle' })
  const abort = useRef<AbortController | null>(null)

  const months = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    return Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: fmt.format(new Date(Date.UTC(2000, i, 1))) }))
  }, [locale])

  useEffect(() => () => abort.current?.abort(), [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (term.length < 2) {
      setTooShort(true)
      setState({ status: 'idle' })
      return
    }
    setTooShort(false)
    track('search', { q_len: term.length })

    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setState({ status: 'loading' })

    const params = new URLSearchParams({ q: term, locale })
    if (month) params.set('month', month)
    if (interest) params.append('interests[]', interest)
    try {
      const res = await fetch(`/api/v1/search?${params}`, { signal: controller.signal })
      if (!res.ok) {
        setState({ status: 'error', message: res.status === 429 ? 'rateLimited' : 'failed' })
        return
      }
      const body: { results: Result[] } = await res.json()
      setState({ status: 'done', results: body.results })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setState({ status: 'error', message: 'failed' })
    }
  }

  return (
    <div className="mt-6 max-w-[1040px] md:mt-10">
      <form
        role="search"
        aria-label={t('label')}
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col overflow-hidden rounded-[10px] bg-surface text-ink shadow-soft md:flex-row md:flex-wrap md:items-stretch"
      >
        <label className={`${fieldClass} border-b border-line-2 md:flex-[1_1_260px] md:border-r md:border-b-0`}>
          <span className="eyebrow text-ink-2">{t('where')}</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('wherePlaceholder')}
            maxLength={80}
            autoComplete="off"
            aria-invalid={tooShort}
            aria-describedby={tooShort ? 'search-too-short' : undefined}
            className={inputClass}
          />
        </label>
        <div className="flex border-b border-line-2 md:contents">
          <label className={`${fieldClass} flex-1 border-r border-line-2 md:flex-[1_1_220px] md:border-b-0`}>
            <span className="eyebrow text-ink-2">{t('when')}</span>
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputClass} cursor-pointer`}>
              <option value="">{t('anyMonth')}</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`${fieldClass} flex-1 md:flex-[1_1_240px]`}>
            <span className="eyebrow text-ink-2">{t('interests')}</span>
            <select value={interest} onChange={(e) => setInterest(e.target.value)} className={`${inputClass} cursor-pointer`}>
              <option value="">{t('anyInterest')}</option>
              {interests.map((i) => (
                <option key={i.slug} value={i.slug}>
                  {i.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center p-2 md:p-2.5">
          <button type="submit" className={`${buttonClass('primary')} h-12 w-full px-7 md:h-14 md:w-auto`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            {state.status === 'loading' ? t('searching') : t('submit')}
          </button>
        </div>
      </form>

      <div aria-live="polite" className="mt-3 empty:hidden">
        {tooShort && (
          <p id="search-too-short" className="rounded-[10px] bg-surface px-4 py-3 text-sm text-ink shadow-soft">
            {t('tooShort')}
          </p>
        )}
        {state.status === 'error' && (
          <p role="alert" className="rounded-[10px] bg-surface px-4 py-3 text-sm text-ink shadow-soft">
            {t(state.message)}
          </p>
        )}
        {state.status === 'done' && (
          <div role="region" aria-label={t('results')} className="rounded-[10px] bg-surface text-ink shadow-soft">
            {state.results.length === 0 ? (
              <p className="px-4 py-3 text-sm">{t('noResults')}</p>
            ) : (
              <ul className="max-h-60 divide-y divide-line-2 overflow-y-auto">
                {state.results.map((r) => (
                  <li key={`${r.kind}:${r.slug}`}>
                    <Link href={HREF[r.kind](r.slug)} className="flex min-h-11 items-baseline justify-between gap-4 px-4 py-2.5 text-ink hover:text-copper">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium">{r.name}</span>
                        {r.sub && <span className="block truncate text-[13px] text-ink-2">{r.sub}</span>}
                      </span>
                      <span className="eyebrow shrink-0 text-ink-2">{t(`kind.${r.kind}`)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-line-2 px-4 py-1">
              <button type="button" onClick={() => setState({ status: 'idle' })} className="min-h-11 cursor-pointer text-[13px] font-medium text-ink-2 hover:text-ink">
                {t('clear')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
