import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CardsPasses } from '@/components/transport/cards-passes'
import { JourneyPlanner } from '@/components/transport/journey-planner'
import { LineExplorer } from '@/components/transport/line-explorer'
import { ScenicRoutes } from '@/components/transport/scenic-routes'
import { routing } from '@/i18n/routing'
import { getCityLines, getTransport } from '@/lib/content/transport'
import type { Locale } from '@/lib/i18n/t'
import { pageMetadata } from '@/lib/seo/metadata'

// Static (ISR, tag `transport`): cities, scenic routes, cards, tips and the first city's lines. The planner reads
// `?from=&to=&depart=` and calls the routing API on the client, so the page never renders per query.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'transport' })
  return pageMetadata(locale, '/transport', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function TransportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('transport')
  const { cities, scenic, cards, tips } = await getTransport(locale as Locale)
  const first = cities[0]
  const lines = first ? await getCityLines(first.slug) : null

  return (
    <>
      <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 pb-10 md:pt-24">
        <p className="eyebrow text-copper">{t('eyebrow')}</p>
        <h1 className="mt-4 max-w-[900px] text-[clamp(40px,5vw,68px)] leading-[1.04] font-semibold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-[18px] max-w-[600px] text-[17px] leading-[1.7] text-ink-2">{t('lede')}</p>
      </section>
      <JourneyPlanner cities={cities} />
      <LineExplorer cities={cities} initial={first && lines ? { city: first.slug, lines: lines.lines } : null} />
      <ScenicRoutes routes={scenic} />
      <CardsPasses cards={cards} tips={tips} />
    </>
  )
}
