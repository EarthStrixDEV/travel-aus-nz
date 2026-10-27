'use client'

import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useId, useState, type FormEvent } from 'react'
import { TextField } from '@/components/ui/text-field'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type { TripSummary } from '@/lib/trip/model'

export function formatTripDates(start: string | null, end: string | null, locale: string): string | null {
  if (!start || !end) return null
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return fmt.formatRange(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`))
}

function NewTripForm() {
  const t = useTranslations('trip.new')
  const locale = useLocale()
  const router = useRouter()
  const hintId = useId()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body = {
      title: String(fd.get('title') ?? ''),
      ...(fd.get('start_date') ? { start_date: String(fd.get('start_date')) } : {}),
      ...(fd.get('end_date') ? { end_date: String(fd.get('end_date')) } : {}),
    }
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/me/trips', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error?.message ?? t('failed'))
      router.push(`/${locale}/trip/${json.id}`)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('failed'))
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 rounded-[10px] border border-line bg-surface p-6 md:p-8">
      <h2 className="text-2xl font-semibold">{t('title')}</h2>
      <TextField label={t('name')} name="title" placeholder={t('namePlaceholder')} required maxLength={80} />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField label={t('start')} name="start_date" type="date" describedBy={hintId} />
        <TextField label={t('end')} name="end_date" type="date" describedBy={hintId} />
      </div>
      <p id={hintId} className="-mt-3 text-[13px] text-ink-2">
        {t('datesHint')}
      </p>
      <div aria-live="polite">{error && <p className="text-[13px] text-copper">{error}</p>}</div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t('creating') : t('submit')}
      </Button>
    </form>
  )
}

/** `/trip`: the user's trips (newest first) and the new-trip form. */
export function TripList({ trips }: { trips: TripSummary[] }) {
  const t = useTranslations('trip.list')
  const locale = useLocale()
  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section aria-labelledby="trip-list-title">
        <h2 id="trip-list-title" className="text-2xl font-semibold">
          {t('title')}
        </h2>
        {trips.length === 0 ? (
          <p className="mt-4 text-[15px] text-ink-2">{t('empty')}</p>
        ) : (
          <ul className="mt-4">
            {trips.map((trip) => (
              <li key={trip.id} className="border-t border-line-2">
                <Link href={`/trip/${trip.id}`} aria-label={t('open', { title: trip.title })} className="flex min-h-16 flex-col justify-center py-4 transition-colors duration-500 hover:text-copper">
                  <span className="text-lg font-medium">{trip.title}</span>
                  <span className="text-sm text-ink-2">{formatTripDates(trip.startDate, trip.endDate, locale) ?? t('undated')}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <NewTripForm />
    </div>
  )
}
