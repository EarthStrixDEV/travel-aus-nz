'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { formatMoney } from '@/lib/format/money'
import type { AirportTransfers as Airport, ConnectivityOption, TitledItem } from '@/lib/prepare/data'

function Placeholder({ label }: { label: string }) {
  return <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-3">{label}</span>
}

/** "Know before you go": editorial facts from `content_blocks.facts`. */
export function Facts({ items }: { items: TitledItem[] }) {
  return (
    <ul className="grid gap-x-10 gap-y-8 md:grid-cols-3">
      {items.map((f, i) => (
        <li key={i} className="border-t border-line-2 pt-5">
          <p className="text-[13px] text-ink-3 tabular-nums">{String(i + 1).padStart(2, '0')}</p>
          <h3 className="mt-2 text-lg font-semibold">{f.title}</h3>
          <p className="mt-1.5 text-[15px] leading-[1.65] text-ink-2">{f.text}</p>
        </li>
      ))}
    </ul>
  )
}

/** Connectivity table (spec §12); costs without `verified_at` carry the Placeholder tag. */
export function Connectivity({ options }: { options: ConnectivityOption[] }) {
  const t = useTranslations('prepare.connectivity')
  return (
    <>
      {options.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                {(['option', 'setup', 'cost', 'best', 'watch'] as const).map((k) => (
                  <th key={k} scope="col" className="eyebrow py-3 pr-6 font-normal text-ink-2">
                    {t(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.id} className="border-b border-line-2 align-top">
                  <th scope="row" className="py-4 pr-6 font-medium">
                    {o.name}
                  </th>
                  <td className="py-4 pr-6 text-ink-2">{o.setup}</td>
                  <td className="py-4 pr-6 whitespace-nowrap">
                    {o.cost}
                    {o.cost && !o.verified && <Placeholder label={t('placeholder')} />}
                  </td>
                  <td className="py-4 pr-6 text-ink-2">{o.best}</td>
                  <td className="py-4 text-ink-2">{o.watch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-6 max-w-[760px] text-[15px] leading-[1.7] text-ink-2">{t('note')}</p>
    </>
  )
}

export function Health({ items }: { items: TitledItem[] }) {
  const t = useTranslations('prepare.health')
  return (
    <div className="mt-14">
      <h3 className="text-2xl font-semibold">{t('title')}</h3>
      <ul className="mt-6 grid gap-6 md:grid-cols-3">
        {items.map((h, i) => (
          <li key={i} className="rounded-[10px] border border-line p-6">
            <p className="font-medium">{h.title}</p>
            <p className="mt-2 text-sm leading-[1.65] text-ink-2">{h.text}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * "From the airport, without a car": options per airport; Route details opens Transport for that city
 * (airports carry no coordinates, so the planner starts with the city selected).
 */
export function AirportTransfers({ airports }: { airports: Airport[] }) {
  const t = useTranslations('prepare.airport')
  const tc = useTranslations('prepare.country')
  return (
    <>
      <Link href="/transport" className="mb-6 inline-flex min-h-11 items-center text-sm font-medium text-copper hover:underline">
        {t('allTransport')} →
      </Link>
      <ul className="grid gap-6 md:grid-cols-3">
        {airports.map((a) => (
          <li key={a.airport} className="flex flex-col rounded-[10px] border border-line bg-surface p-6">
            <p className="eyebrow text-ink-2">
              {a.airport}
              {a.country && ` · ${tc(a.country)}`}
            </p>
            {a.city && <h3 className="mt-2 text-xl font-semibold">{a.city.name}</h3>}
            <ul className="mt-4 flex-1">
              {a.options.map((o, i) => {
                const fare =
                  o.fareMin !== null && o.currency
                    ? o.fareMax !== null && o.fareMax !== o.fareMin
                      ? `${formatMoney(o.fareMin, o.currency)}–${formatMoney(o.fareMax, o.currency)}`
                      : formatMoney(o.fareMin, o.currency)
                    : null
                return (
                  <li key={i} className="border-t border-line-2 py-3">
                    <p className="font-medium">{o.name}</p>
                    <p className="text-sm text-ink-2">
                      {[o.durationMin !== null ? t('minutes', { min: o.durationMin }) : null, fare].filter(Boolean).join(' · ')}
                      {fare && !o.verified && <Placeholder label={t('placeholder')} />}
                    </p>
                  </li>
                )
              })}
            </ul>
            {a.city && (
              <Link
                href={`/transport?city=${encodeURIComponent(a.city.slug)}`}
                aria-label={t('routeFor', { city: a.city.name })}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-copper hover:underline"
              >
                {t('route')} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}

const KEEP = [
  { key: 'visa', href: '/visa' },
  { key: 'money', href: '/money' },
  { key: 'dishes', href: '/dishes' },
  { key: 'trip', href: '/trip' },
] as const

export function KeepPlanning() {
  const t = useTranslations('prepare')
  return (
    <section aria-labelledby="prepare-keep" className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-20 pb-24 md:pt-28 md:pb-36">
      <h2 id="prepare-keep" className="eyebrow mb-6 text-copper">
        {t('keep.eyebrow')}
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
        {KEEP.map(({ key, href }) => (
          <Link key={key} href={href} className="flex flex-col gap-2 rounded-[10px] border border-line p-6 text-ink transition-colors duration-500 hover:border-ink">
            <span className="text-lg font-semibold">{t(`keep.${key}`)}</span>
            <span className="text-sm leading-[1.6] text-ink-2">{t(`keep.${key}Text`)}</span>
          </Link>
        ))}
      </div>
      <p className="mt-12 rounded-lg border border-line px-[22px] py-[18px] text-[13px] leading-[1.7] text-ink-2">{t('disclaimer')}</p>
    </section>
  )
}
