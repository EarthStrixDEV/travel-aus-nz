import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PrepareView } from '@/components/prepare/prepare-view'
import { requireUser } from '@/lib/auth/profile'
import { getPrepare } from '@/lib/content/prepare'
import type { Locale } from '@/lib/i18n/t'
import { pageMetadata } from '@/lib/seo/metadata'
import { createClient } from '@/lib/supabase/server'
import { currentTripId } from '@/lib/trip/current-trip'
import { readTicks } from '@/lib/trip/ticks'

// Signed-in only (GATED_PREFIXES, plan decision 3): the editorial payload is cached under `prepare`, the user's
// ticks are read per request through their session.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'prepare' })
  return { ...pageMetadata(locale, '/prepare', { title: t('metaTitle'), description: t('metaDescription') }), robots: { index: false } }
}

export default async function PreparePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const user = await requireUser()
  const t = await getTranslations('prepare')
  const db = await createClient()

  const [data, tripId] = await Promise.all([getPrepare(locale as Locale), currentTripId(db, user.id, { create: false })])
  const [checked, packed] = tripId ? await Promise.all([readTicks(db, 'checklist', tripId), readTicks(db, 'packing', tripId)]) : [[], []]

  return (
    <>
      <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 pb-10 md:pt-24 print:pt-0">
        <p className="eyebrow text-copper print:hidden">{t('eyebrow')}</p>
        <h1 className="mt-4 max-w-[900px] text-[clamp(40px,5vw,68px)] leading-[1.04] font-semibold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-[18px] max-w-[620px] text-[17px] leading-[1.7] text-ink-2 print:hidden">{t('lede')}</p>
      </section>
      <PrepareView data={data} tripId={tripId} checked={checked} packed={packed} />
    </>
  )
}
