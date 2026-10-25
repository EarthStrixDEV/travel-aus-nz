import { useTranslations } from 'next-intl'
import type { EntryPermission, EntryTimeline, LeadTime, TimelineStep } from '@/lib/entry/helper'
import type { CountryTab } from './country-tabs'
import { PlaceholderTag } from './placeholder-tag'

const STEP_KEYS = ['check', 'prepare', 'apply', 'wait', 'save', 'travel'] as const
const STEP_ICONS = [
  'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  'M6 2h9l5 5v15H6zM14 2v6h6M9 13h8M9 17h6',
  'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  'M6 3h12v18l-6-4-6 4z',
  'M2 16l20-6-3-3-6 2-6-5-2 1 4 6-5 2-2-1-1 1zM3 21h18',
]

// Used until editors fill `content_blocks.entry_timeline` (it ships empty). The chart axis is 12 weeks wide.
const AXIS_WEEKS = 12
const BUNDLED_LEAD = [
  { key: 'eta', weeksFrom: 6, weeksTo: 2, riskWeeks: 1, permissions: ['au-eta', 'au-evisitor', 'nzeta'] },
  { key: 'visa', weeksFrom: 12, weeksTo: 8, riskWeeks: 3, permissions: ['au-visitor-visa', 'nz-visitor-visa'] },
] as const

const pct = (weeks: number) => Math.max(0, Math.min(100, (weeks / AXIS_WEEKS) * 100))

/** Does this bar apply to the chosen country tab? Bars whose permissions we can't place stay visible. */
function shownFor(lead: LeadTime, country: CountryTab, permissions: EntryPermission[]): boolean {
  if (country === 'both' || !lead.permissions.length) return true
  const known = lead.permissions.flatMap((slug) => permissions.find((p) => p.slug === slug) ?? [])
  return !known.length || known.some((p) => p.country.toLowerCase() === country)
}

export function Timeline({
  timeline,
  country,
  permissions,
}: {
  timeline: EntryTimeline | null
  country: CountryTab
  /** Every permission (not the country-filtered list), to place each bar. */
  permissions: EntryPermission[]
}) {
  const t = useTranslations('visa.timeline')

  const steps: TimelineStep[] = timeline?.steps.length
    ? timeline.steps
    : STEP_KEYS.map((k) => ({ title: t(`steps.${k}.title`), text: t(`steps.${k}.text`) }))
  const lead: LeadTime[] = timeline?.lead.length
    ? timeline.lead
    : BUNDLED_LEAD.map((l) => ({
        name: t(`lead.items.${l.key}.name`),
        note: t(`lead.items.${l.key}.note`),
        weeksFrom: l.weeksFrom,
        weeksTo: l.weeksTo,
        riskWeeks: l.riskWeeks,
        permissions: [...l.permissions],
      }))
  const bars = lead.filter((l) => shownFor(l, country, permissions))

  return (
    <section aria-label={t('label')} className="mt-24 md:mt-[120px] print:hidden">
      <p className="eyebrow text-copper">{t('eyebrow')}</p>
      <h2 className="mt-3 text-[clamp(26px,3vw,40px)] leading-[1.1] font-semibold">{t('title')}</h2>
      <ol className="m-0 mt-12 grid list-none grid-cols-1 p-0 sm:grid-cols-6">
        {steps.map((s, i) => (
          <li key={`${i}-${s.title}`} className="relative flex flex-row items-start gap-4 pb-5 sm:flex-col sm:gap-3.5 sm:pb-0">
            <div className="relative flex flex-none flex-col items-center">
              <span
                className={`relative z-[1] flex size-10 items-center justify-center rounded-full border-[1.5px] bg-bg ${i === 0 ? 'border-copper text-copper' : 'border-ink text-ink'}`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                  <path d={STEP_ICONS[i % STEP_ICONS.length]} />
                </svg>
              </span>
              {i < steps.length - 1 ? <span aria-hidden="true" className="min-h-7 w-[1.5px] flex-1 bg-line sm:hidden" /> : null}
            </div>
            {i < steps.length - 1 ? <span aria-hidden="true" className="absolute top-5 right-1 left-11 border-t-[1.5px] border-line max-sm:hidden" /> : null}
            <div className="sm:pr-5">
              <p className="text-xs font-medium text-ink-2">{t('step', { n: i + 1 })}</p>
              <p className="mt-1 text-base font-semibold">{s.title}</p>
              <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-2">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 rounded-[10px] border border-line p-5 md:p-9">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-lg font-semibold">{t('lead.title')}</h3>
          <p className="text-[13px] text-ink-2">
            {t('lead.note')}
            {timeline?.verifiedAt ? null : <PlaceholderTag />}
          </p>
        </div>
        <div className="mt-7 flex flex-col gap-6">
          {bars.map((l, i) => {
            const from = Math.min(l.weeksFrom, AXIS_WEEKS)
            return (
              <div key={`${i}-${l.name}`}>
                <div className="mb-2.5 flex justify-between gap-3 text-sm">
                  <span className="font-medium">{l.name}</span>
                  <span className="text-ink-2">{l.note}</span>
                </div>
                <div
                  role="img"
                  aria-label={`${l.name}: ${t('lead.weeks', { from: l.weeksFrom, to: l.weeksTo })}`}
                  className="relative h-3.5 overflow-hidden rounded-full bg-line-2"
                >
                  <span className="absolute inset-y-0 rounded-full bg-copper" style={{ left: `${pct(AXIS_WEEKS - from)}%`, width: `${pct(from - l.weeksTo)}%` }} />
                  {l.riskWeeks > 0 ? (
                    <span
                      className="absolute inset-y-0 right-0"
                      style={{
                        width: `${pct(l.riskWeeks)}%`,
                        background: 'repeating-linear-gradient(135deg, var(--line) 0 2px, transparent 2px 7px)',
                      }}
                    />
                  ) : null}
                </div>
              </div>
            )
          })}
          <div className="flex justify-between text-xs text-ink-2" aria-hidden="true">
            <span>{t('lead.axis12')}</span>
            <span>{t('lead.axis8')}</span>
            <span>{t('lead.axis4')}</span>
            <span>{t('lead.axis0')}</span>
          </div>
          <div className="flex flex-wrap gap-6 text-xs text-ink-2">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2 w-6 rounded-full bg-copper" />
              {t('lead.ideal')}
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-6 rounded-full border border-line"
                style={{ background: 'repeating-linear-gradient(135deg, var(--line) 0 2px, transparent 2px 7px)' }}
              />
              {t('lead.risk')}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
