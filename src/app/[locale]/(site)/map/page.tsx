import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { MapView } from '@/components/map/map-view'
import { routing } from '@/i18n/routing'
import { getMapCities, resolveMapStyle } from '@/lib/content/places'
import type { Locale } from '@/lib/i18n/t'

// Static shell (cities cached under the `map` tag); places, transit and details load client-side.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'map' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

export default async function MapPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const cities = await getMapCities(locale as Locale)
  // R7: NEXT_PUBLIC_MAP_STYLE_URL, else the MapLibre demo style outside production, else list view only.
  const styleUrl = resolveMapStyle(process.env.NEXT_PUBLIC_MAP_STYLE_URL, process.env.NODE_ENV)

  return (
    // `?place=` is read client-side (useSearchParams), so the page itself stays static.
    <Suspense fallback={<div className="h-[calc(100dvh-65px-72px)] bg-ph-1 lg:h-[calc(100dvh-73px)]" />}>
      <MapView cities={cities} styleUrl={styleUrl} />
    </Suspense>
  )
}
