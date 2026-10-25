'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { buttonClass } from '@/components/ui/button'
import { track } from '@/lib/analytics/track'
import {
  nationalityCodes,
  resolveEntry,
  type Country,
  type EntryLink,
  type EntryPermission,
  type EntryResult,
  type EntryRule,
  type Purpose,
  type Stay,
} from '@/lib/entry/helper'
import type { Locale } from '@/lib/i18n/t'
import type { CountryTab } from './country-tabs'

/**
 * The three-question helper (spec §11). Everything happens in this component: the answers live in React state,
 * are resolved against the rule table that came with the page, and are never sent anywhere. The only analytics
 * event is the click on an official link, carrying the country and nothing the visitor typed.
 */

const NOT_LISTED = 'not_listed'
const LOADING_MS = 600
const PURPOSES: Purpose[] = ['tourism', 'work_study']
const STAYS: Stay[] = ['lt1', '1to3', 'gt3']

type Option = { code: string; name: string }
type Committed = { nationality: string; purpose: Purpose; stay: Stay; today: Date }
type Phase = 'empty' | 'loading' | 'result'

const chip = (on: boolean) =>
  `min-h-10 cursor-pointer rounded-full border px-3.5 text-[13px] transition-colors duration-500 max-sm:min-h-[52px] max-sm:w-full ${
    on ? 'border-copper bg-copper-tint font-medium text-copper' : 'border-line text-ink-2 hover:border-ink'
  }`

function ResultCard({
  country,
  result,
  nationality,
  purpose,
  stay,
}: {
  country: Country
  result: EntryResult
  nationality: string
  purpose: Purpose
  stay: Stay
}) {
  const t = useTranslations('visa.helper')
  const tc = useTranslations('visa.country')
  const countryName = tc(country === 'AU' ? 'au' : 'nz')
  const link = result.kind === 'permission' ? result.permission.link : result.link
  const copy = result.kind === 'official_only' ? 'officialOnly' : result.kind === 'work_study' ? 'workStudy' : 'notListed'

  return (
    <article aria-label={countryName} className="flex min-w-0 flex-1 flex-col gap-3.5 rounded-[10px] border border-line bg-bg p-6 md:p-7">
      <p className="eyebrow text-ink-2">{countryName}</p>
      {result.kind === 'permission' ? (
        <>
          <p className="text-sm text-ink-2">
            {t('result.intro', { nationality, purpose: t(`sentence.purpose.${purpose}`), stay: t(`sentence.stay.${stay}`) })}
          </p>
          <h3 className="text-[clamp(26px,2.6vw,34px)] leading-[1.15] font-semibold tracking-[-0.01em]">{result.permission.name}</h3>
          {result.permission.plain ? <p className="text-[15px] leading-[1.65] text-ink-2">{result.permission.plain}</p> : null}
          {stay === 'gt3' ? <p className="rounded-md border border-line-2 px-3.5 py-3 text-sm leading-[1.6]">{t('result.longStay')}</p> : null}
        </>
      ) : (
        <>
          <h3 className="text-[clamp(24px,2.4vw,30px)] leading-[1.15] font-semibold tracking-[-0.01em]">{t(`result.${copy}.title`)}</h3>
          <p className="text-[15px] leading-[1.65] text-ink-2">{t(`result.${copy}.text`)}</p>
        </>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('visa_official_click', { country })}
          className={`${buttonClass('primary')} min-h-[52px]`}
        >
          {t('result.open', { agency: link.agency || link.title })}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        </a>
        <span className="text-xs text-ink-2">{t('result.opens', { domain: link.domain })}</span>
      </div>
      <p className="self-start rounded-full border border-copper px-2.5 py-1 text-[10px] font-medium tracking-[.14em] text-copper uppercase">
        {t('result.disclaimer')}
      </p>
    </article>
  )
}

export function EntryHelper({
  rules,
  permissions,
  links,
  country,
}: {
  rules: EntryRule[]
  permissions: EntryPermission[]
  links: EntryLink[]
  country: CountryTab
}) {
  const t = useTranslations('visa.helper')
  const locale = useLocale() as Locale
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const display = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' })
    } catch {
      return null
    }
  }, [locale])
  const nameOf = (code: string): string => {
    try {
      return display?.of(code) ?? code
    } catch {
      return code
    }
  }
  const notListedLabel = t('notListed')

  const options = useMemo<Option[]>(
    () =>
      nationalityCodes(rules)
        .map((code) => ({ code, name: nameOf(code) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nameOf only reads `display`
    [rules, display, locale],
  )

  const initial = options.find((o) => o.code === 'TH') ?? null
  const [nat, setNat] = useState<string | null>(initial?.code ?? null)
  const [query, setQuery] = useState(initial?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [purpose, setPurpose] = useState<Purpose>('tourism')
  const [stay, setStay] = useState<Stay>('lt1')
  const [step, setStep] = useState(1)
  const [needNat, setNeedNat] = useState(false)
  const [phase, setPhase] = useState<Phase>('empty')
  const [committed, setCommitted] = useState<Committed | null>(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const q = query.trim().toLowerCase()
  // While the box still shows the chosen country, list everything so the visitor can change their mind.
  const filtering = q !== '' && !(nat && nat !== NOT_LISTED && nameOf(nat).toLowerCase() === q)
  const matches = filtering ? options.filter((o) => o.name.toLowerCase().includes(q)) : options
  const items: Option[] = [...matches, { code: NOT_LISTED, name: notListedLabel }]

  function pick(o: Option) {
    setNat(o.code)
    setQuery(o.name)
    setOpen(false)
    setActive(-1)
    setNeedNat(false)
  }

  function onQuery(value: string) {
    setQuery(value)
    setOpen(true)
    setActive(-1)
    setNeedNat(false)
    const v = value.trim().toLowerCase()
    const exact = options.find((o) => o.name.toLowerCase() === v)
    setNat(exact ? exact.code : v === notListedLabel.toLowerCase() ? NOT_LISTED : null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1))
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault()
      pick(items[active])
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  function run() {
    if (!nat) {
      setNeedNat(true)
      setStep(1)
      inputRef.current?.focus()
      return
    }
    setOpen(false)
    setCommitted({ nationality: nat, purpose, stay, today: new Date() })
    clearTimeout(timer.current)
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setPhase('result')
      return
    }
    setPhase('loading')
    timer.current = setTimeout(() => setPhase('result'), LOADING_MS)
  }

  function next() {
    if (step === 1 && !nat) {
      setNeedNat(true)
      inputRef.current?.focus()
    } else if (step < 3) setStep(step + 1)
    else run()
  }

  const countries: Country[] = country === 'au' ? ['AU'] : country === 'nz' ? ['NZ'] : ['AU', 'NZ']
  const results = useMemo(
    () =>
      committed
        ? countries.map((c) => ({
            country: c,
            result: resolveEntry(rules, permissions, { nationality: committed.nationality, purpose: committed.purpose, stay: committed.stay }, c, committed.today, links),
          }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `countries` is derived from `country`
    [committed, country, rules, permissions, links],
  )

  const stepName = (n: number) => t(`names.${(['nationality', 'purpose', 'stay'] as const)[n - 1]}`)
  // One DOM for both layouts: desktop shows all three fields, mobile only the current step.
  const field = (n: number, basis = 'sm:flex-[1_1_260px]') => `${step === n ? 'flex' : 'hidden'} min-w-0 flex-col gap-2.5 sm:flex ${basis}`
  const stepLabel = (n: number) => (
    <>
      <span className="eyebrow text-ink-2 max-sm:hidden">{t('stepDesktop', { n, name: stepName(n) })}</span>
      <span className="eyebrow text-ink-2 sm:hidden">{t('stepMobile', { n, name: stepName(n) })}</span>
    </>
  )

  return (
    <section aria-label={t('label')} className="mt-16 md:mt-24 print:hidden">
      <div className="rounded-xl border border-line bg-surface p-5 shadow-soft md:p-11">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="eyebrow text-copper">{t('eyebrow')}</p>
            <h2 className="mt-2.5 text-[clamp(24px,2.6vw,34px)] font-semibold">{t('title')}</h2>
          </div>
          <p className="flex items-center gap-2 text-[13px] text-ink-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {t('privacy')}
          </p>
        </div>

        <div className="mt-6 sm:mt-8">
          <div role="img" aria-label={t('progress', { n: step })} className="mb-5 flex gap-1.5 sm:hidden">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`h-[3px] flex-1 rounded-full ${n <= step ? 'bg-copper' : 'bg-line'}`} />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:gap-8">
            <div className={field(1)}>
              {stepLabel(1)}
              <div
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-label={t('names.nationality')}
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
                  aria-invalid={needNat || undefined}
                  autoComplete="off"
                  value={query}
                  onChange={(e) => onQuery(e.target.value)}
                  onFocus={() => setOpen(true)}
                  onKeyDown={onKeyDown}
                  className="min-h-[52px] w-full rounded-lg border border-line bg-surface py-0 pr-11 pl-4 text-base font-normal text-ink transition-colors duration-500 focus:border-copper focus:outline-none"
                />
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="pointer-events-none absolute top-[18px] right-4">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                {open ? (
                  <ul
                    id={listId}
                    role="listbox"
                    aria-label={t('names.nationality')}
                    className="absolute inset-x-0 top-[58px] z-10 m-0 max-h-[264px] list-none overflow-y-auto rounded-lg border border-line bg-surface py-1.5 shadow-soft max-sm:static max-sm:mt-2 max-sm:max-h-[220px] max-sm:shadow-none"
                  >
                    {items.map((o, i) => (
                      <li
                        key={o.code}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={o.code === nat}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(o)}
                        className={`flex min-h-11 cursor-pointer items-center justify-between px-4 text-[15px] hover:bg-copper-tint ${i === active || o.code === nat ? 'bg-copper-tint' : ''}`}
                      >
                        {o.name}
                        {o.code === nat ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        ) : null}
                      </li>
                    ))}
                    {filtering && matches.length === 0 ? <li role="presentation" className="px-4 py-3 text-sm text-ink-2">{t('noMatch')}</li> : null}
                  </ul>
                ) : null}
              </div>
              {needNat ? (
                <p role="alert" className="text-[13px] text-copper">
                  {t('needNationality')}
                </p>
              ) : null}
            </div>

            <div className={field(2, 'sm:flex-[0_1_260px]')}>
              {stepLabel(2)}
              <div role="group" aria-label={t('names.purpose')} className="flex flex-wrap gap-2 max-sm:flex-col">
                {PURPOSES.map((p) => (
                  <button key={p} type="button" aria-pressed={purpose === p} onClick={() => setPurpose(p)} className={chip(purpose === p)}>
                    {t(`purposes.${p}`)}
                  </button>
                ))}
              </div>
              <span className="text-xs text-ink-2">{t('purposeNote')}</span>
            </div>

            <div className={field(3)}>
              {stepLabel(3)}
              <div role="group" aria-label={t('names.stay')} className="flex flex-wrap gap-2 max-sm:flex-col">
                {STAYS.map((s) => (
                  <button key={s} type="button" aria-pressed={stay === s} onClick={() => setStay(s)} className={chip(stay === s)}>
                    {t(`stays.${s}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden pt-[26px] sm:block">
              <button type="button" onClick={run} className={`${buttonClass('primary')} min-h-[52px] px-[26px]`}>
                {t('run')}
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-2.5 sm:hidden">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} className={`${buttonClass('ghost')} min-h-[52px]`}>
                {t('back')}
              </button>
            ) : null}
            <button type="button" onClick={next} className={`${buttonClass('primary')} min-h-[52px] flex-1`}>
              {step < 3 ? t('next') : t('run')}
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-line-2 pt-8" aria-live="polite">
          {phase === 'empty' ? (
            <div className="flex items-center gap-5 rounded-[10px] border border-dashed border-line p-7">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true" className="flex-none text-ink-3">
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <circle cx="12" cy="10" r="3" />
                <path d="M8.5 17h7" />
              </svg>
              <div>
                <p className="text-base font-medium">{t('empty.title')}</p>
                <p className="mt-1 text-sm leading-[1.6] text-ink-2">{t('empty.text')}</p>
              </div>
            </div>
          ) : null}
          {phase === 'loading' ? (
            <div aria-busy="true" aria-label={t('loading')} className="flex gap-5 max-md:flex-col">
              {countries.map((c) => (
                <div key={c} className="flex flex-1 flex-col gap-3.5 rounded-[10px] border border-line-2 p-7">
                  <div className="h-2.5 w-[90px] animate-pulse rounded-sm bg-ink/10" />
                  <div className="h-7 w-3/5 animate-pulse rounded-sm bg-ink/10" />
                  <div className="h-3 w-[90%] animate-pulse rounded-sm bg-ink/10" />
                  <div className="h-3 w-[70%] animate-pulse rounded-sm bg-ink/10" />
                  <div className="mt-2 h-11 w-[220px] max-w-full animate-pulse rounded-sm bg-ink/10" />
                </div>
              ))}
            </div>
          ) : null}
          {phase === 'result' && committed ? (
            <div className="flex gap-5 max-md:flex-col">
              {results.map(({ country: c, result }) => (
                <ResultCard
                  key={c}
                  country={c}
                  result={result}
                  nationality={committed.nationality === NOT_LISTED ? notListedLabel : nameOf(committed.nationality)}
                  purpose={committed.purpose}
                  stay={committed.stay}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
