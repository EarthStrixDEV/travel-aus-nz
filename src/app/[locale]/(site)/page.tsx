import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CarFreeWidget } from '@/components/home/car-free-widget'
import { DiningEdit } from '@/components/home/dining-edit'
import { FeaturedRegions } from '@/components/home/featured-regions'
import { HeroSlider } from '@/components/home/hero-slider'
import { JourneyCards } from '@/components/home/journey-cards'
import { SearchBar } from '@/components/home/search-bar'
import { routing } from '@/i18n/routing'
import { getHome, getInterestTags } from '@/lib/content/home'
import type { Locale } from '@/lib/i18n/t'
import { pageMetadata } from '@/lib/seo/metadata'

// Fully static (SSG); content refreshes via the `home` cache tag.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  return pageMetadata(locale, '', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const loc = locale as Locale
  const t = await getTranslations('home.hero')

  // Both countries are rendered into the page, so the AU / NZ switch is client-side only.
  const [au, nz, interests] = await Promise.all([getHome(loc, 'au'), getHome(loc, 'nz'), getInterestTags(loc)])

  return (
    <>
      <HeroSlider slides={au.slides}>
        <p className="eyebrow mb-4 text-on-deep/80 md:mb-5">{t('eyebrow')}</p>
        <h1 className="max-w-[900px] text-[44px] leading-[1.04] font-semibold tracking-[-0.02em] md:text-[clamp(44px,6vw,84px)] md:leading-[1.02]">
          {t('titleLine1')}
          <br />
          {t('titleLine2')}
        </h1>
        <p className="mt-3 max-w-[520px] text-[15px] leading-[1.6] font-light text-on-deep/90 md:mt-5 md:text-lg">{t('lede')}</p>
        <SearchBar interests={interests} />
      </HeroSlider>
      <FeaturedRegions regions={{ au: au.regions, nz: nz.regions }} />
      <JourneyCards journeys={au.journeys} />
      <CarFreeWidget showcase={au.routeShowcase} />
      <DiningEdit edit={au.diningEdit} />
    </>
  )
}
