import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/lib/i18n/t'
import { createServiceClient } from '@/lib/supabase/service'
import { loadSharedTrip } from '@/lib/trip/share'

type Params = { params: Promise<{ locale: string; token: string }> }

// Read-only shared trip (spec §13), outside the gated /trip prefix (plan deviation 7). Never indexed; rendered
// per request so a revoked token stops working at once.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function SharedTripPage({ params }: Params) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const t = await getTranslations('trip')
  const trip = await loadSharedTrip(createServiceClient(), token, locale as Locale)
  if (!trip) notFound()

  const fmtDay = (date: string | null) =>
    date ? new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : null

  return (
    <article className="mx-auto max-w-[960px] px-[clamp(16px,4vw,56px)] pt-16 pb-24 md:pt-24 md:pb-36">
      <p className="eyebrow text-copper">{t('shared.eyebrow')}</p>
      <h1 className="mt-3 text-[clamp(36px,4.5vw,60px)] leading-[1.05] font-semibold tracking-[-0.02em]">{trip.title}</h1>
      <p className="mt-3 text-sm text-ink-2">{t('shared.readOnly')}</p>

      {trip.days.map((d) => (
        <section key={d.dayNo} aria-labelledby={`shared-day-${d.dayNo}`} className="mt-12">
          <h2 id={`shared-day-${d.dayNo}`} className="text-2xl font-semibold">
            {t('days.day', { n: d.dayNo })}
            {fmtDay(d.date) && <span className="font-normal text-ink-2"> · {fmtDay(d.date)}</span>}
            {d.title && <span className="block text-base font-normal text-ink-2">{d.title}</span>}
          </h2>
          {d.stops.length === 0 ? (
            <p className="mt-3 text-[15px] text-ink-2">{t('shared.emptyDay')}</p>
          ) : (
            <ol className="mt-4">
              {d.stops.map((s, i) => (
                <li key={i}>
                  <div className="flex items-start gap-4 border-t border-line-2 py-4">
                    <span aria-hidden="true" className="mt-0.5 flex size-7 flex-none items-center justify-center rounded-full border-[1.5px] border-ink text-[13px] font-semibold">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[13px] text-ink-2 tabular-nums">
                        {s.time && <span className="mr-2 font-medium text-ink">{s.time}</span>}
                        {t.has(`type.${s.place.type}`) ? t(`type.${s.place.type}`) : s.place.type}
                      </p>
                      <Link href={`/map?place=${encodeURIComponent(s.place.slug)}`} className="text-lg font-medium hover:text-copper">
                        {s.place.name}
                      </Link>
                      {s.place.area && <p className="text-sm text-ink-2">{s.place.area}</p>}
                    </div>
                  </div>
                  {s.leg?.summary && <p className="ml-[13px] border-l border-dashed border-line py-2 pl-6 text-[13px] text-ink-2">{s.leg.summary}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </article>
  )
}
