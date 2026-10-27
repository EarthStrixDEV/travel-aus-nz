import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { z } from 'zod'
import { ShareExport } from '@/components/trip/share-export'
import { TripView } from '@/components/trip/trip-view'
import { requireUser } from '@/lib/auth/profile'
import { resolveMapStyle } from '@/lib/content/places'
import type { Locale } from '@/lib/i18n/t'
import { createClient } from '@/lib/supabase/server'
import { loadTrip } from '@/lib/trip/load'

type Params = { params: Promise<{ locale: string; id: string }> }

export const metadata: Metadata = { robots: { index: false } }

// Signed-in only (GATED_PREFIXES). Another user's trip, a deleted one or a malformed id are all 404.
export default async function TripPage({ params }: Params) {
  const { locale, id } = await params
  setRequestLocale(locale)
  const user = await requireUser()
  if (!z.uuid().safeParse(id).success) notFound()
  const trip = await loadTrip(await createClient(), user.id, id, locale as Locale)
  if (!trip) notFound()

  return (
    <div className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 pb-24 md:pt-24 md:pb-36">
      <TripView
        trip={trip}
        styleUrl={resolveMapStyle(process.env.NEXT_PUBLIC_MAP_STYLE_URL, process.env.NODE_ENV)}
        header={<ShareExport tripId={trip.id} />}
      />
    </div>
  )
}
