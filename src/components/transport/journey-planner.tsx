'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { buttonClass } from '@/components/ui/button'
import { track } from '@/lib/analytics/track'
import type { JourneyCard } from '@/lib/content/journeys'
import type { TransitMode } from '@/lib/content/shared'
import type { TransportCity } from '@/lib/content/transport'
import { formatMoney } from '@/lib/format/money'
import type { RouteOption } from '@/lib/routing/types'
import { formatClock, ModeIcon, ModeStroke, RouteLegs, useDurationText } from './route-legs'
import { fareRange, RouteOptions } from './route-options'

// ---- inputs --------------------------------------------------------------------------------

/** What the field shows, and what is sent: a place slug, a `lat,lng`, or null until a place is chosen. */
type Endpoint = { text: string; value: string | null }

const EMPTY: Endpoint = { text: '', value: null }
const POINT = /^\s*-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*$/
const SLUG = /^[a-z0-9-]{1,80}$/
const DEPART = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** A typed `lat,lng` is usable as-is; anything else needs a pick from the suggestions. */
const typed = (text: string): Endpoint => ({ text, value: POINT.test(text) ? text.replace(/\s/g, '') : null })

/** `?from=central-station` -> "central station" for the field; the slug itself is what gets sent. */
function fromParam(raw: string | null): Endpoint | null {
  if (!raw) return null
  if (POINT.test(raw)) return typed(raw)
  return SLUG.test(raw) ? { text: raw.replace(/-/g, ' '), value: raw } : null
}

/** Now, as `YYYY-MM-DDTHH:mm` wall time in `timeZone` (the value a datetime-local input takes). */
export function nowInZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now)
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? '00'
  return `${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}`
}

type Chip = 'train' | 'tram' | 'bus' | 'ferry'
const CHIPS: { key: Chip; modes: TransitMode[] }[] = [
  { key: 'train', modes: ['train', 'metro'] },
  { key: 'tram', modes: ['tram'] },
  { key: 'bus', modes: ['bus', 'coach'] },
  { key: 'ferry', modes: ['ferry'] },
]
const ALL_CHIPS: Record<Chip, boolean> = { train: true, tram: true, bus: true, ferry: true }

type ErrorKey = 'fromRequired' | 'toRequired' | 'pick' | 'departRequired' | 'modesRequired'
type FieldErrors = Partial<Record<'from' | 'to' | 'depart' | 'modes', ErrorKey>>

type Result =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'results'; options: RouteOption[] }
  | { status: 'empty' }
  | { status: 'unavailable'; fallback: JourneyCard | null }
  | { status: 'rateLimited' | 'notFound' | 'invalid' | 'failed' }

type Query = { from: string; to: string; depart: string; city: TransportCity; chips: Record<Chip, boolean>; stepFree: boolean }

// ---- place autocomplete --------------------------------------------------------------------

type Suggestion = { slug: string; name: string; sub: string }

const fieldClass = 'flex min-w-0 flex-col gap-1.5 px-5 py-3.5 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-copper'
const inputClass = 'w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-base font-normal text-ink outline-none placeholder:text-ink-3'

/**
 * Combobox over GET /api/v1/search (places only). Typing clears the chosen place; picking one (click, or arrows +
 * Enter) sets the slug that will be sent.
 */
function PlaceField({
  label,
  placeholder,
  value,
  onChange,
  error,
  className = '',
}: {
  label: string
  placeholder: string
  value: Endpoint
  onChange: (v: Endpoint) => void
  error?: string
  className?: string
}) {
  const t = useTranslations('transport.planner')
  const locale = useLocale()
  const id = useId()
  const listId = `${id}-list`
  const errorId = `${id}-error`
  const [items, setItems] = useState<Suggestion[] | null>(null)
  const [active, setActive] = useState(-1)
  const [open, setOpen] = useState(false)
  const abort = useRef<AbortController | null>(null)

  const term = value.text.trim()
  const shouldSearch = open && value.value === null && term.length >= 2 && !POINT.test(term)

  useEffect(() => {
    if (!shouldSearch) return
    const timer = setTimeout(async () => {
      abort.current?.abort()
      const controller = new AbortController()
      abort.current = controller
      try {
        const res = await fetch(`/api/v1/search?${new URLSearchParams({ q: term.slice(0, 80), locale })}`, { signal: controller.signal })
        if (!res.ok) return setItems([])
        const body: { results: (Suggestion & { kind: string })[] } = await res.json()
        setItems(body.results.filter((r) => r.kind === 'place').slice(0, 8))
        setActive(-1)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setItems([])
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [shouldSearch, term, locale])

  useEffect(() => () => abort.current?.abort(), [])

  const expanded = open && value.value === null && items !== null && term.length >= 2

  function pick(s: Suggestion) {
    onChange({ text: s.name, value: s.slug })
    setOpen(false)
    setItems(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!expanded || !items?.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1))
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault()
      pick(items[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={`relative ${fieldClass} ${className}`}>
      <label htmlFor={id} className="eyebrow text-ink-2">
        {label}
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        autoComplete="off"
        maxLength={80}
        placeholder={placeholder}
        value={value.text}
        onChange={(e) => {
          onChange(typed(e.target.value))
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={inputClass}
      />
      {error && (
        <p id={errorId} className="text-[13px] font-normal text-copper">
          {error}
        </p>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label={t('suggestions')}
        hidden={!expanded}
        className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-[10px] border border-line bg-surface py-1 shadow-soft"
      >
        {items?.length === 0 && <li className="px-4 py-2.5 text-sm text-ink-2">{t('noSuggestions')}</li>}
        {items?.map((s, i) => (
          <li
            key={s.slug}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(s)}
            className={`flex min-h-11 cursor-pointer flex-col justify-center px-4 py-2 ${i === active ? 'bg-copper-tint text-copper' : 'text-ink hover:text-copper'}`}
          >
            <span className="truncate text-[15px] font-medium">{s.name}</span>
            {s.sub && <span className="truncate text-[13px] text-ink-2">{s.sub}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- results -------------------------------------------------------------------------------

function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className="mt-10 flex flex-wrap gap-8">
      <div className="flex max-w-[460px] flex-[1_1_320px] flex-col gap-3">
        <span className="h-3 w-24 animate-pulse rounded bg-ph-1" />
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-[118px] animate-pulse rounded-lg border border-line bg-surface" />
        ))}
      </div>
      <span className="h-[360px] flex-[2_1_480px] animate-pulse rounded-[10px] border border-line bg-surface" />
    </div>
  )
}

/** Message box in the Map empty-state style. */
function Notice({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return (
    <p role={alert ? 'alert' : 'status'} className="mt-10 rounded-[10px] border border-line bg-surface px-5 py-4 text-sm text-ink-2">
      {children}
    </p>
  )
}

function FallbackJourney({ journey }: { journey: JourneyCard }) {
  const t = useTranslations('transport')
  const tMode = useTranslations('transport.mode')
  const modes = [...new Set(journey.modes)]
  return (
    <article className="mt-4 flex max-w-[640px] flex-col gap-3 rounded-[10px] border border-line bg-surface px-6 py-5">
      {modes.length > 0 && (
        <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-2">
          {modes.map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5">
              <ModeIcon mode={m} size={13} />
              {tMode(m)}
            </span>
          ))}
        </p>
      )}
      <h3 className="text-[21px] leading-[1.25] font-semibold">{journey.title}</h3>
      {journey.line && <p className="text-[15px] leading-[1.65] text-ink-2">{journey.line}</p>}
      {(journey.from || journey.to) && (
        <p className="flex items-center gap-3 text-[13px] text-ink-2">
          <span>{journey.from}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-ink" />
          <span>{journey.to}</span>
        </p>
      )}
      <p className="flex justify-between gap-4 border-t border-line-2 pt-3 text-sm text-ink-2">
        <span>{journey.days !== null ? t('results.days', { count: journey.days }) : null}</span>
        {journey.priceFrom !== null && journey.currency && (
          <span className="font-medium text-ink">{t('results.priceFrom', { price: formatMoney(journey.priceFrom, journey.currency) })}</span>
        )}
      </p>
    </article>
  )
}

function Results({ options, timeZone }: { options: RouteOption[]; timeZone: string }) {
  const t = useTranslations('transport.results')
  const locale = useLocale()
  const duration = useDurationText()
  const [selected, setSelected] = useState(0)
  const sel = options[Math.min(selected, options.length - 1)]
  const fare = fareRange(sel.fare_min, sel.fare_max, sel.currency)

  return (
    <div className="mt-10 flex flex-wrap gap-8">
      <div className="max-w-[460px] min-w-0 flex-[1_1_320px]">
        <RouteOptions options={options} selected={selected} onSelect={setSelected} timeZone={timeZone} />
      </div>
      <section
        aria-labelledby="selected-route"
        className="min-w-0 flex-[2_1_480px] rounded-[10px] border border-line bg-surface px-5 py-6 md:px-9 md:py-8"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-2 pb-5">
          <div>
            <p className="eyebrow text-copper">{t('selected')}</p>
            <h2 id="selected-route" className="mt-2 text-[22px] font-semibold tabular-nums md:text-[26px]">
              {formatClock(sel.depart, timeZone, locale)} → {formatClock(sel.arrive, timeZone, locale)} · {duration(sel.duration_min)}
            </h2>
          </div>
          <div className="md:text-right">
            <p className="text-[15px] font-medium">{fare ?? t('checkFare')}</p>
            {sel.card && <p className="text-[13px] text-ink-2">{sel.card}</p>}
          </div>
        </div>
        <RouteLegs option={sel} timeZone={timeZone} />
      </section>
    </div>
  )
}

// ---- planner -------------------------------------------------------------------------------

/**
 * §7 journey planner: From / To (place autocomplete or lat,lng) / Depart, mode chips, step-free, Find routes ->
 * GET /api/v1/routes/plan. The query mirrors into `?from=&to=&depart=` and a page opened with from+to runs it at
 * once (Prepare deep-links here). Times come back as UTC and are shown in the selected city's timezone.
 */
export function JourneyPlanner({ cities }: { cities: TransportCity[] }) {
  const t = useTranslations('transport')
  const locale = useLocale()
  const [citySlug, setCitySlug] = useState(cities[0]?.slug ?? '')
  const [from, setFrom] = useState<Endpoint>(EMPTY)
  const [to, setTo] = useState<Endpoint>(EMPTY)
  const [depart, setDepart] = useState('')
  const [chips, setChips] = useState(ALL_CHIPS)
  const [stepFree, setStepFree] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [result, setResult] = useState<Result>({ status: 'idle' })
  const [shownZone, setShownZone] = useState(cities[0]?.timezone ?? 'Australia/Sydney')
  const abort = useRef<AbortController | null>(null)
  const ids = { city: useId(), depart: useId(), departError: useId(), modesError: useId(), note: useId() }

  const city = cities.find((c) => c.slug === citySlug) ?? cities[0]

  async function run(q: Query) {
    const modes = CHIPS.filter((c) => q.chips[c.key]).flatMap((c) => c.modes)
    track('route_plan', { modes_count: CHIPS.filter((c) => q.chips[c.key]).length, step_free: q.stepFree })

    const params = new URLSearchParams({ from: q.from, to: q.to, depart: q.depart, locale })
    for (const m of modes) params.append('modes[]', m)
    if (q.stepFree) params.set('step_free', 'true')

    const shown = new URLSearchParams({ from: q.from, to: q.to, depart: q.depart })
    if (q.city.slug !== cities[0]?.slug) shown.set('city', q.city.slug)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${shown}`)

    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setShownZone(q.city.timezone)
    setResult({ status: 'loading' })
    try {
      const res = await fetch(`/api/v1/routes/plan?${params}`, { signal: controller.signal })
      if (res.ok) {
        const body: { options: RouteOption[] } = await res.json()
        return setResult(body.options.length ? { status: 'results', options: body.options } : { status: 'empty' })
      }
      if (res.status === 503) {
        const body: { fallback?: JourneyCard | null } = await res.json().catch(() => ({}))
        return setResult({ status: 'unavailable', fallback: body.fallback ?? null })
      }
      setResult({ status: res.status === 429 ? 'rateLimited' : res.status === 404 ? 'notFound' : res.status === 400 ? 'invalid' : 'failed' })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setResult({ status: 'failed' })
    }
  }

  // Deep link: read the query once on mount (not useSearchParams, so the page stays static), then run it.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const c = cities.find((x) => x.slug === p.get('city')) ?? cities[0]
    if (c) setCitySlug(c.slug)
    const d = DEPART.test(p.get('depart') ?? '') ? p.get('depart')! : nowInZone(c?.timezone ?? 'Australia/Sydney')
    setDepart(d)
    const f = fromParam(p.get('from'))
    const tt = fromParam(p.get('to'))
    if (f) setFrom(f)
    if (tt) setTo(tt)
    if (c && f?.value && tt?.value) void run({ from: f.value, to: tt.value, depart: d, city: c, chips: ALL_CHIPS, stepFree: false })
    return () => abort.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: FieldErrors = {}
    if (!from.text.trim()) next.from = 'fromRequired'
    else if (!from.value) next.from = 'pick'
    if (!to.text.trim()) next.to = 'toRequired'
    else if (!to.value) next.to = 'pick'
    if (!DEPART.test(depart)) next.depart = 'departRequired'
    if (!CHIPS.some((c) => chips[c.key])) next.modes = 'modesRequired'
    setErrors(next)
    if (Object.keys(next).length || !city || !from.value || !to.value) return
    void run({ from: from.value, to: to.value, depart, city, chips, stepFree })
  }

  // Loading and result counts are announced here; the notices below are themselves live (status / alert).
  const announce =
    result.status === 'loading' ? t('results.loading') : result.status === 'results' ? t('results.found', { count: result.options.length }) : ''

  return (
    <section aria-label={t('planner.label')} className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)]">
      <form
        noValidate
        onSubmit={onSubmit}
        className="flex flex-col rounded-[10px] border border-line bg-surface text-ink shadow-soft md:flex-row md:flex-wrap md:items-stretch"
      >
        <div className="flex items-stretch border-b border-line-2 md:flex-[2_1_480px] md:border-r md:border-b-0">
          <PlaceField
            label={t('planner.from')}
            placeholder={t('planner.fromPlaceholder')}
            value={from}
            onChange={setFrom}
            error={errors.from && t(`planner.errors.${errors.from}`)}
            className="flex-1"
          />
          <div className="flex items-center px-1">
            <button
              type="button"
              aria-label={t('planner.swap')}
              onClick={() => {
                setFrom(to)
                setTo(from)
              }}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-line bg-bg text-ink transition-colors duration-500 hover:border-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                <path d="M7 4l-3 3 3 3M4 7h13M17 20l3-3-3-3M20 17H7" />
              </svg>
            </button>
          </div>
          <PlaceField
            label={t('planner.to')}
            placeholder={t('planner.toPlaceholder')}
            value={to}
            onChange={setTo}
            error={errors.to && t(`planner.errors.${errors.to}`)}
            className="flex-1"
          />
        </div>
        <div className="flex border-b border-line-2 md:contents">
          <div className={`${fieldClass} flex-[0_1_140px] border-r border-line-2 md:border-b-0`}>
            <label htmlFor={ids.city} className="eyebrow text-ink-2">
              {t('planner.city')}
            </label>
            <select
              id={ids.city}
              value={citySlug}
              onChange={(e) => setCitySlug(e.target.value)}
              aria-describedby={ids.note}
              className={`${inputClass} cursor-pointer`}
            >
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className={`${fieldClass} flex-1 md:flex-[0_1_240px] md:border-r md:border-line-2`}>
            <label htmlFor={ids.depart} className="eyebrow text-ink-2">
              {t('planner.depart')}
            </label>
            <input
              id={ids.depart}
              type="datetime-local"
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
              aria-invalid={errors.depart ? true : undefined}
              aria-describedby={errors.depart ? `${ids.departError} ${ids.note}` : ids.note}
              className={inputClass}
            />
            {errors.depart && (
              <p id={ids.departError} className="text-[13px] font-normal text-copper">
                {t(`planner.errors.${errors.depart}`)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center p-2.5">
          <button type="submit" className={`${buttonClass('primary')} h-14 w-full px-7 md:w-auto`}>
            {result.status === 'loading' ? t('planner.searching') : t('planner.submit')}
          </button>
        </div>
      </form>
      <p id={ids.note} className="mt-2 text-xs text-ink-2">
        {t('planner.timeNote', { city: city?.name ?? '' })}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
        <div role="group" aria-label={t('planner.modes')} aria-describedby={errors.modes ? ids.modesError : undefined} className="flex flex-wrap items-center gap-2">
          <span aria-hidden="true" className="eyebrow mr-2 text-ink-2">
            {t('planner.modes')}
          </span>
          {CHIPS.map(({ key, modes }) => (
            <button
              key={key}
              type="button"
              aria-pressed={chips[key]}
              onClick={() => setChips((c) => ({ ...c, [key]: !c[key] }))}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] transition-colors duration-500 ${
                chips[key] ? 'border-copper bg-copper-tint font-medium text-copper' : 'border-line text-ink-2 hover:border-ink hover:text-ink'
              }`}
            >
              <ModeIcon mode={modes[0]} size={15} />
              <ModeStroke mode={modes[0]} className="w-[22px]" />
              {t(`planner.chip.${key}`)}
            </button>
          ))}
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] text-ink md:ml-auto">
          <input
            type="checkbox"
            checked={stepFree}
            onChange={(e) => setStepFree(e.target.checked)}
            aria-describedby={`${ids.note}-sf`}
            className="size-4 accent-copper"
          />
          {t('planner.stepFree')}
        </label>
      </div>
      {errors.modes && (
        <p id={ids.modesError} className="mt-2 text-[13px] text-copper">
          {t(`planner.errors.${errors.modes}`)}
        </p>
      )}
      <p id={`${ids.note}-sf`} className="mt-1 text-xs text-ink-2 md:text-right">
        {t('planner.stepFreeNote')}
      </p>

      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {result.status === 'loading' && <ResultsSkeleton />}
      {result.status === 'results' && <Results key={result.options.map((o) => o.depart).join()} options={result.options} timeZone={shownZone} />}
      {result.status === 'empty' && <Notice>{t('results.noResult')}</Notice>}
      {(result.status === 'rateLimited' || result.status === 'notFound' || result.status === 'invalid' || result.status === 'failed') && (
        <Notice alert>{t(`results.${result.status}`)}</Notice>
      )}
      {result.status === 'unavailable' && (
        <div className="mt-10">
          <p role="alert" className="rounded-[10px] border border-copper bg-copper-tint px-5 py-4 text-sm text-ink">
            {t('results.unavailable')}
          </p>
          {result.fallback && (
            <>
              <p className="mt-6 text-sm text-ink-2">{t('results.fallbackLead')}</p>
              <FallbackJourney journey={result.fallback} />
            </>
          )}
        </div>
      )}
    </section>
  )
}
