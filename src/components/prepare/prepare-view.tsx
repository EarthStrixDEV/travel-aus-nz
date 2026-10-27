'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/venues/venue-filters'
import { track } from '@/lib/analytics/track'
import {
  forCountry,
  MOMENTS,
  progress,
  SEASONS,
  southernSeason,
  type ChecklistTemplate,
  type PackingItem,
  type PrepareCountry,
  type PrepareData,
  type Season,
} from '@/lib/prepare/data'
import { BestTime } from './best-time'
import { AirportTransfers, Connectivity, Facts, Health, KeepPlanning } from './prepare-info'
import { useTicks } from './use-ticks'

const COUNTRIES: PrepareCountry[] = ['au', 'nz', 'both']

function Check({ on, label, note, onToggle }: { on: boolean; label: string; note?: string; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3.5 border-t border-line-2 py-3.5">
      <input type="checkbox" checked={on} onChange={onToggle} className="mt-1 size-[18px] flex-none accent-copper" />
      <span className="min-w-0">
        <span className={`block text-[15px] font-medium ${on ? 'text-ink-2 line-through decoration-ink-3' : ''}`}>{label}</span>
        {note && <span className="mt-0.5 block text-sm leading-[1.6] text-ink-2">{note}</span>}
      </span>
    </label>
  )
}

function Section({ id, eyebrow, title, children, className = '' }: { id: string; eyebrow: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-20 md:pt-28 ${className}`}>
      <p className="eyebrow text-copper">{eyebrow}</p>
      <h2 id={id} className="mt-3 mb-8 text-[clamp(28px,3vw,40px)] leading-[1.1] font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Checklist({ templates, ticked, onToggle, onReset }: { templates: ChecklistTemplate[]; ticked: ReadonlySet<number>; onToggle: (t: ChecklistTemplate) => void; onReset: () => void }) {
  const t = useTranslations('prepare.checklist')
  const [confirming, setConfirming] = useState(false)

  function print() {
    try {
      window.print()
    } catch {
      // Some embedded browsers block printing; nothing else to do.
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <p className="text-sm text-ink-2">{t('synced')}</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {confirming ? (
            <span role="group" aria-label={t('resetConfirm')} className="flex flex-wrap items-center gap-2">
              <span className="text-sm">{t('resetConfirm')}</span>
              <Button
                variant="ghost"
                onClick={() => {
                  onReset()
                  setConfirming(false)
                }}
              >
                {t('resetYes')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                {t('cancel')}
              </Button>
            </span>
          ) : (
            <Button variant="ghost" onClick={() => setConfirming(true)}>
              {t('reset')}
            </Button>
          )}
          <Button variant="ghost" onClick={print}>
            {t('pdf')}
          </Button>
        </div>
      </div>
      {templates.length === 0 ? (
        <p className="text-[15px] text-ink-2">{t('empty')}</p>
      ) : (
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {MOMENTS.map((m) => {
            const items = templates.filter((x) => x.moment === m)
            if (!items.length) return null
            const done = items.filter((x) => ticked.has(x.id)).length
            return (
              <fieldset key={m} className="min-w-0 break-inside-avoid">
                <legend className="flex w-full items-baseline justify-between pb-2">
                  <span className="text-lg font-semibold">{t(`moment.${m}`)}</span>
                  <span className="text-sm text-ink-3 tabular-nums">{t('groupCount', { done, count: items.length })}</span>
                </legend>
                {items.map((x) => (
                  <Check key={x.id} on={ticked.has(x.id)} label={x.title} note={x.note} onToggle={() => onToggle(x)} />
                ))}
              </fieldset>
            )
          })}
        </div>
      )}
    </>
  )
}

function Packing({ items, ticked, onToggle }: { items: PackingItem[]; ticked: ReadonlySet<number>; onToggle: (id: number) => void }) {
  const t = useTranslations('prepare')
  const [season, setSeason] = useState<Season>(() => southernSeason(new Date().getMonth() + 1))
  const list = items.filter((i) => i.season === season)
  const groups = [...new Set(list.map((i) => i.group))]
  const done = list.filter((i) => ticked.has(i.id)).length

  return (
    <>
      <div role="group" aria-label={t('packing.season')} className="mb-6 flex flex-wrap items-center gap-2">
        {SEASONS.map((s) => (
          <Chip key={s} pressed={season === s} onClick={() => setSeason(s)} label={t(`seasons.season.${s}`)} />
        ))}
        <span className="ml-auto text-sm text-ink-2 tabular-nums" aria-live="polite">
          {t('packing.packed', { done, count: list.length })}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="text-[15px] text-ink-2">{t('packing.empty')}</p>
      ) : (
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-3">
          {groups.map((g) => (
            <fieldset key={g} className="min-w-0">
              {g && <legend className="pb-2 text-lg font-semibold">{g}</legend>}
              {list
                .filter((i) => i.group === g)
                .map((i) => (
                  <Check key={i.id} on={ticked.has(i.id)} label={i.title} onToggle={() => onToggle(i.id)} />
                ))}
            </fieldset>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * Prepare (spec §12), signed in only: checklist and packing ticks live on the user's trip
 * (`trip_checklist_items` / `trip_packing_items`); everything else is the cached editorial payload.
 */
export function PrepareView({
  data,
  tripId: initialTripId,
  checked,
  packed,
}: {
  data: PrepareData
  tripId: string | null
  checked: number[]
  packed: number[]
}) {
  const t = useTranslations('prepare')
  const [country, setCountry] = useState<PrepareCountry>('both')
  const [tripId, setTripId] = useState(initialTripId)
  const view = useMemo(() => forCountry(data, country), [data, country])

  const checklist = useTicks({ initial: checked, tripId, onTripId: setTripId, endpoint: (id) => `/api/v1/me/checklist-items/${id}`, field: 'done' })
  const packing = useTicks({ initial: packed, tripId, onTripId: setTripId, endpoint: (id) => `/api/v1/me/packing-items/${id}`, field: 'packed' })
  const p = progress(view.templates, checklist.ticked)

  async function toggleItem(x: ChecklistTemplate) {
    const on = await checklist.toggle(x.id)
    track('checklist_toggle', { moment: x.moment, on })
    const after = progress(view.templates, new Set([...checklist.ticked, ...(on ? [x.id] : [])]))
    if (on && after.done === after.total) track('checklist_complete', { total: after.total })
  }

  return (
    <>
      {/* Sticky progress (spec §12): n of m ready, next up, %. */}
      <div role="region" aria-label={t('progress.label')} className="sticky top-[65px] z-20 border-b border-line-2 bg-bg/95 backdrop-blur lg:top-[73px] print:static print:border-0">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-[clamp(16px,4vw,56px)] py-3">
          <p className="text-sm font-medium tabular-nums" aria-live="polite">
            {t('progress.ready', { done: p.done, total: p.total })}
          </p>
          <p className="min-w-0 flex-1 truncate text-sm text-ink-2">{p.next ? t('progress.next', { item: p.next.title }) : t('progress.allDone')}</p>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="h-1.5 w-28 overflow-hidden rounded-full bg-line-2">
              <span className="block h-full bg-copper transition-[width] duration-500" style={{ width: `${p.pct}%` }} />
            </span>
            <span className="text-sm text-ink-2 tabular-nums">{t('progress.pct', { pct: p.pct })}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-10 print:hidden">
        <div role="group" aria-label={t('country.label')} className="flex flex-wrap gap-2">
          {COUNTRIES.map((c) => (
            <Chip key={c} pressed={country === c} onClick={() => setCountry(c)} label={t(`country.${c}`)} />
          ))}
        </div>
      </div>

      <Section id="prepare-checklist" eyebrow={t('checklist.eyebrow')} title={t('checklist.title')} className="!pt-10">
        {checklist.failed && (
          <p role="alert" className="mb-6 rounded-[10px] border border-copper bg-copper-tint px-5 py-4 text-sm print:hidden">
            {t('checklist.saveFailed')}
          </p>
        )}
        <Checklist
          templates={view.templates}
          ticked={checklist.ticked}
          onToggle={toggleItem}
          onReset={() => checklist.reset(tripId ? `/api/v1/me/trips/${tripId}/checklist` : null)}
        />
      </Section>

      <div className="print:hidden">
        <Section id="prepare-seasons" eyebrow={t('seasons.eyebrow')} title={t('seasons.title')}>
          <BestTime regions={view.regions} />
        </Section>

        <Section id="prepare-packing" eyebrow={t('packing.eyebrow')} title={t('packing.title')}>
          {packing.failed && (
            <p role="alert" className="mb-6 rounded-[10px] border border-copper bg-copper-tint px-5 py-4 text-sm">
              {t('checklist.saveFailed')}
            </p>
          )}
          <Packing items={view.packing} ticked={packing.ticked} onToggle={(id) => void packing.toggle(id)} />
        </Section>

        {view.facts.length > 0 && (
          <Section id="prepare-facts" eyebrow={t('facts.eyebrow')} title={t('facts.title')}>
            <Facts items={view.facts} />
          </Section>
        )}

        <Section id="prepare-connectivity" eyebrow={t('connectivity.eyebrow')} title={t('connectivity.title')}>
          <Connectivity options={view.connectivity} />
          {view.health.length > 0 && <Health items={view.health} />}
        </Section>

        {view.transfers.length > 0 && (
          <Section id="prepare-airport" eyebrow={t('airport.eyebrow')} title={t('airport.title')}>
            <AirportTransfers airports={view.transfers} />
          </Section>
        )}

        <KeepPlanning />
      </div>
    </>
  )
}
