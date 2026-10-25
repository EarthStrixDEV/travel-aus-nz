import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { JsonLd } from '@/components/seo/json-ld'
import { VenueBrowser } from '@/components/venues/venue-browser'
import { VenueFallback } from '@/components/venues/venue-fallback'
import { routing } from '@/i18n/routing'
import { getSeoPlaces } from '@/lib/content/seo'
import { getVenues } from '@/lib/content/venues'
import type { Locale } from '@/lib/i18n/t'
import { placesJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/metadata'

// Static (ISR): the venue catalog is cached under the `venues` tag; filters are applied on the client
// from the URL query, so the page itself never re-renders per filter.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'eatDrink' })
  return pageMetadata(locale, '/eat-drink', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function EatDrinkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('eatDrink')
  const [venues, seoVenues] = await Promise.all([getVenues(locale as Locale), getSeoPlaces('venues', locale as Locale)])

  return (
    <>
      {/* Every venue as one ItemList (no per-venue route; `?venue=` deep links open the drawer client-side). */}
      {seoVenues.length > 0 && <JsonLd data={placesJsonLd(seoVenues, locale as Locale)} />}
      <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 md:pt-24">
        <p className="eyebrow text-copper">{t('eyebrow')}</p>
        <h1 className="mt-4 text-[clamp(40px,5vw,68px)] leading-[1.04] font-semibold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-[18px] max-w-[580px] text-[17px] leading-[1.7] text-ink-2">{t('lede')}</p>
      </section>
      <div className="mt-8 md:mt-12">
        {/* `?kind=` and the filters are read client-side (useSearchParams). The fallback is the server-rendered
            default view, so crawlers get real venue names and links in the static HTML. */}
        <Suspense fallback={<VenueFallback venues={venues} t={t as unknown as (key: string, values?: Record<string, string | number>) => string} />}>
          <VenueBrowser venues={venues} />
        </Suspense>
      </div>
    </>
  )
}
