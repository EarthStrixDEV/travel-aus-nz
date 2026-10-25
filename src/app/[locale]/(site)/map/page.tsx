import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { MapView } from '@/components/map/map-view'
import { JsonLd } from '@/components/seo/json-ld'
import { routing } from '@/i18n/routing'
import { getMapCities, resolveMapStyle } from '@/lib/content/places'
import { getSeoPlaces } from '@/lib/content/seo'
import type { Locale } from '@/lib/i18n/t'
import { placesJsonLd } from '@/lib/seo/jsonld'
import { pageMetadata } from '@/lib/seo/metadata'

// Static shell (cities cached under the `map` tag); places, transit and details load client-side.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'map' })
  return pageMetadata(locale, '/map', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function MapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const [cities, attractions] = await Promise.all([getMapCities(locale as Locale), getSeoPlaces('attractions', locale as Locale)])
  // R7: NEXT_PUBLIC_MAP_STYLE_URL, else the MapLibre demo style outside production, else list view only.
  const styleUrl = resolveMapStyle(process.env.NEXT_PUBLIC_MAP_STYLE_URL, process.env.NODE_ENV)

  return (
    <>
      {/* Every attraction as one ItemList: there is no per-place route, and reading `?place=` here would make the page dynamic. */}
      {attractions.length > 0 && <JsonLd data={placesJsonLd(attractions, locale as Locale)} />}
      {/* `?place=` is read client-side (useSearchParams), so the page itself stays static. */}
      <Suspense fallback={<div className="h-[calc(100dvh-65px-72px)] bg-ph-1 lg:h-[calc(100dvh-73px)]" />}>
        <MapView cities={cities} styleUrl={styleUrl} />
      </Suspense>
    </>
  )
}
