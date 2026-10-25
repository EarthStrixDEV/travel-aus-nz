import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { GalleryBrowser } from '@/components/gallery/gallery-browser'
import { GalleryFallback } from '@/components/gallery/gallery-fallback'
import type { T } from '@/components/gallery/labels'
import { routing } from '@/i18n/routing'
import { getGallery } from '@/lib/content/gallery'
import type { Locale } from '@/lib/i18n/t'
import { pageMetadata } from '@/lib/seo/metadata'

// Static (ISR): the photo list is cached under the `gallery` tag; filters are applied on the client from the
// URL query, so the page itself never re-renders per filter.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'gallery' })
  return pageMetadata(locale, '/gallery', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('gallery')
  const photos = await getGallery(locale as Locale)

  return (
    <>
      <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 pb-12 md:pt-24">
        <p className="eyebrow text-copper">{t('eyebrow')}</p>
        <h1 className="mt-4 text-[clamp(40px,5vw,68px)] leading-[1.04] font-semibold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-[18px] max-w-[560px] text-[17px] leading-[1.7] text-ink-2">{t('lede')}</p>
      </section>
      {/* The filters are read client-side (useSearchParams). The fallback is the server-rendered default view,
          so crawlers get real photo titles and place links in the static HTML. */}
      <Suspense fallback={<GalleryFallback photos={photos} t={t as unknown as T} />}>
        <GalleryBrowser photos={photos} />
      </Suspense>
    </>
  )
}
