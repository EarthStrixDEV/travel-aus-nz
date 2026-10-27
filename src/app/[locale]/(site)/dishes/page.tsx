import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { DishBrowser, DishFallback } from '@/components/dishes/dish-browser'
import { routing } from '@/i18n/routing'
import { getDishes } from '@/lib/content/dishes'
import type { Locale } from '@/lib/i18n/t'
import { pageMetadata } from '@/lib/seo/metadata'

// Static (ISR, tag `dishes`): the catalog is small and shipped whole; filters run on the client from the URL query.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'dishes' })
  return pageMetadata(locale, '/dishes', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function DishesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dishes')
  const data = await getDishes(locale as Locale)

  return (
    <>
      <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 pb-10 md:pt-24">
        <p className="eyebrow text-copper">{t('eyebrow')}</p>
        <h1 className="mt-4 max-w-[900px] text-[clamp(40px,5vw,68px)] leading-[1.04] font-semibold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-[18px] max-w-[620px] text-[17px] leading-[1.7] text-ink-2">{t('lede')}</p>
      </section>
      {/* The fallback is the unfiltered catalog, rendered on the server; filters read the URL on the client. */}
      <Suspense fallback={<DishFallback data={data} />}>
        <DishBrowser data={data} />
      </Suspense>
    </>
  )
}
