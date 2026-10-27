'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ModeIcon, useDurationText } from '@/components/transport/route-legs'
import { Button, IconButton } from '@/components/ui/button'
import type { TripData, TripDay, TripStop } from '@/lib/trip/model'
import { formatTripDates } from './trip-list'
import { useTripAction } from './use-trip-action'

const DayMap = dynamic(() => import('./day-map'), { ssr: false, loading: () => <div className="aspect-[4/3] rounded-[10px] bg-ph-1" /> })

function dayLabel(day: TripDay, locale: string) {
  return day.date ? new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T00:00:00Z`)) : null
}

function Leg({ stop, onRetry }: { stop: TripStop; onRetry: () => void }) {
  const t = useTranslations('trip.leg')
  const leg = stop.legToNext
  if (!leg) return null
  return (
    <div className="ml-[13px] flex min-h-10 items-center gap-3 border-l border-dashed border-line py-2 pl-6 text-[13px] text-ink-2">
      {leg.status === 'ok' && leg.mode && <ModeIcon mode={leg.mode} size={15} />}
      {leg.status === 'ok' && <span>{leg.summary}</span>}
      {leg.status === 'stale' && <span aria-live="polite">{t('calculating')}</span>}
      {leg.status === 'failed' && (
        <>
          <span>{t('failed')}</span>
          <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer text-copper hover:underline">
            {t('retry')}
          </button>
        </>
      )}
    </div>
  )
}

function StopRow({
  stop,
  index,
  count,
  days,
  dayId,
  run,
}: {
  stop: TripStop
  index: number
  count: number
  days: TripDay[]
  dayId: string
  run: ReturnType<typeof useTripAction>['run']
}) {
  const t = useTranslations('trip')
  const [editing, setEditing] = useState(false)
  const name = stop.place.name
  const url = `/api/v1/me/stops/${stop.id}`

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const time = String(fd.get('time') ?? '')
    const note = String(fd.get('note') ?? '')
    if (await run(url, { method: 'PATCH', body: { time: time || null, note: note || null } })) setEditing(false)
  }

  return (
    <li>
      <div className="flex items-start gap-4 border-t border-line-2 py-4">
        <span aria-hidden="true" className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-full border-[1.5px] border-ink text-[13px] font-semibold">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink-2 tabular-nums">
            {stop.time && <span className="mr-2 font-medium text-ink">{stop.time}</span>}
            {t.has(`type.${stop.place.type}`) ? t(`type.${stop.place.type}`) : stop.place.type}
          </p>
          <p className="text-lg font-medium">{name}</p>
          {stop.note && <p className="text-sm text-ink-2">{stop.note}</p>}
          {editing && (
            <form onSubmit={onSave} className="mt-3 flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-[13px] text-ink-2">
                {t('stop.time')}
                <input type="time" name="time" defaultValue={stop.time ?? ''} className="h-11 border-b border-line bg-transparent text-[15px] text-ink" />
              </label>
              <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px] text-ink-2">
                {t('stop.note')}
                <input name="note" maxLength={280} defaultValue={stop.note} placeholder={t('stop.notePlaceholder')} className="h-11 border-b border-line bg-transparent text-[15px] text-ink" />
              </label>
              <Button type="submit" variant="ghost">
                {t('stop.save')}
              </Button>
            </form>
          )}
        </div>
        <div className="flex flex-none flex-wrap items-center justify-end gap-1">
          <IconButton label={t('stop.edit', { name })} aria-expanded={editing} onClick={() => setEditing((v) => !v)}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4" />
            </svg>
          </IconButton>
          <IconButton label={t('stop.up', { name })} disabled={index === 0} onClick={() => run(url, { method: 'PATCH', body: { position: index } })}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </IconButton>
          <IconButton label={t('stop.down', { name })} disabled={index === count - 1} onClick={() => run(url, { method: 'PATCH', body: { position: index + 2 } })}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </IconButton>
          {days.length > 1 && (
            <label className="flex items-center">
              <span className="sr-only">{t('stop.moveTo')}</span>
              <select
                value={dayId}
                onChange={(e) => run(url, { method: 'PATCH', body: { day_id: e.target.value, position: 200 } })}
                className="h-11 cursor-pointer rounded-full border border-line bg-transparent px-2 text-[13px] text-ink"
              >
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {t('stop.toDay', { n: d.dayNo })}
                  </option>
                ))}
              </select>
            </label>
          )}
          <IconButton label={t('stop.remove', { name })} onClick={() => run(url, { method: 'DELETE' })}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>
      </div>
      {/* Retry: re-setting the time marks the leg stale again and queues a new calculation. */}
      <Leg stop={stop} onRetry={() => run(url, { method: 'PATCH', body: { time: stop.time } })} />
    </li>
  )
}

/**
 * My Trip (spec §13): header, day tabs, the day's stops with legs, the day map (or the off-map card), and
 * "Saved, not scheduled". Every change is a `/api/v1/me/*` call followed by a server re-render.
 */
export function TripView({ trip, styleUrl, header }: { trip: TripData; styleUrl: string | null; header?: React.ReactNode }) {
  const t = useTranslations('trip')
  const locale = useLocale()
  const router = useRouter()
  const duration = useDurationText()
  const { run, failed, pending } = useTripAction()
  const [dayIndex, setDayIndex] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const day = trip.days[Math.min(dayIndex, trip.days.length - 1)]

  function onTabKey(e: KeyboardEvent, i: number) {
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!move) return
    e.preventDefault()
    const next = (i + move + trip.days.length) % trip.days.length
    setDayIndex(next)
    tabRefs.current[next]?.focus()
  }

  async function deleteTrip() {
    if (await run(`/api/v1/me/trips/${trip.id}`, { method: 'DELETE' })) router.push(`/${locale}/trip`)
  }

  const dates = formatTripDates(trip.startDate, trip.endDate, locale)

  return (
    <div aria-busy={pending}>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-copper">
            {t('eyebrow')}
            {dates && ` · ${dates}`}
          </p>
          <h1 className="mt-3 text-[clamp(36px,4.5vw,60px)] leading-[1.05] font-semibold tracking-[-0.02em]">{trip.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {header}
          {confirmDelete ? (
            <span role="group" aria-label={t('header.deleteConfirm')} className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{t('header.deleteConfirm')}</span>
              <Button variant="ghost" onClick={deleteTrip}>
                {t('header.deleteYes')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t('header.cancel')}
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              {t('header.delete')}
            </Button>
          )}
        </div>
      </header>

      {failed && (
        <p role="alert" className="mt-6 rounded-[10px] border border-copper bg-copper-tint px-5 py-4 text-sm">
          {t('error')}
        </p>
      )}

      <div role="tablist" aria-label={t('days.label')} className="mt-10 flex gap-8 overflow-x-auto border-b border-line print:hidden">
        {trip.days.map((d, i) => (
          <button
            key={d.id}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`trip-day-tab-${i}`}
            aria-selected={i === dayIndex}
            aria-controls="trip-day-panel"
            tabIndex={i === dayIndex ? 0 : -1}
            onClick={() => setDayIndex(i)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={`-mb-px flex flex-none cursor-pointer flex-col items-start border-b-2 py-3 text-left transition-colors duration-500 ${
              i === dayIndex ? 'border-copper text-ink' : 'border-transparent text-ink-2 hover:text-ink'
            }`}
          >
            <span className="text-[15px] font-medium">
              {t('days.day', { n: d.dayNo })}
              {dayLabel(d, locale) && ` · ${dayLabel(d, locale)}`}
            </span>
            {d.title && <span className="text-[13px] text-ink-3">{d.title}</span>}
          </button>
        ))}
      </div>

      {day && (
        <div id="trip-day-panel" role="tabpanel" aria-labelledby={`trip-day-tab-${dayIndex}`} className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-label={t('days.day', { n: day.dayNo })}>
            <p className="text-sm text-ink-2" aria-live="polite">
              {t('days.summary', { stops: day.stops.length, transit: day.transitMin ? duration(day.transitMin) : t('days.noTransit') })}
            </p>
            {day.stops.length === 0 ? (
              <p className="mt-6 text-[15px] text-ink-2">{t('days.empty')}</p>
            ) : (
              <ol className="mt-4">
                {day.stops.map((s, i) => (
                  <StopRow key={s.id} stop={s} index={i} count={day.stops.length} days={trip.days} dayId={day.id} run={run} />
                ))}
              </ol>
            )}
          </section>

          <div className="flex flex-col gap-8 print:hidden">
            {day.offMap ? (
              <div className="rounded-[10px] border border-line bg-surface p-6">
                <p className="text-lg font-semibold">{t('map.offMapTitle')}</p>
                <p className="mt-2 text-sm leading-[1.6] text-ink-2">{t('map.offMapText')}</p>
              </div>
            ) : (
              styleUrl && day.stops.length > 0 && <DayMap styleUrl={styleUrl} stops={day.stops} label={t('map.label', { n: day.dayNo })} />
            )}

            <section aria-labelledby="trip-saved" className="rounded-[10px] border border-line p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="trip-saved" className="text-lg font-semibold">
                  {t('saved.title')}
                </h2>
                <span className="text-sm text-ink-2">{t('saved.count', { count: trip.savedUnscheduled.length })}</span>
              </div>
              {trip.savedUnscheduled.length === 0 ? (
                <p className="mt-3 text-sm text-ink-2">{t('saved.empty')}</p>
              ) : (
                <ul className="mt-3">
                  {trip.savedUnscheduled.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 border-t border-line-2 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-[13px] text-ink-2">
                          {[t.has(`type.${p.type}`) ? t(`type.${p.type}`) : p.type, p.area].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <Button variant="ghost" onClick={() => run(`/api/v1/me/trips/${trip.id}/days/${day.dayNo}/stops`, { method: 'POST', body: { place_id: p.id } })}>
                        {t('saved.add', { n: day.dayNo })}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
