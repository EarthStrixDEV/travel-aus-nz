import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { TripList } from '@/components/trip/trip-list'
import { requireUser } from '@/lib/auth/profile'
import { createClient } from '@/lib/supabase/server'
import { listTrips } from '@/lib/trip/load'

// Signed-in only (GATED_PREFIXES). User data: rendered per request, never cached.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'trip' })
  return { title: t('metaTitle'), robots: { index: false } }
}

export default async function TripsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireUser()
  const t = await getTranslations('trip')
  const trips = await listTrips(await createClient(), user.id)

  return (
    <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 pb-24 md:pt-24 md:pb-36">
      <p className="eyebrow text-copper">{t('eyebrow')}</p>
      <h1 className="mt-4 mb-12 text-[clamp(40px,5vw,68px)] leading-[1.04] font-semibold tracking-[-0.02em]">{t('metaTitle')}</h1>
      <TripList trips={trips} />
    </div>
  )
}
