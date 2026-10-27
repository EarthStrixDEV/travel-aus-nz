import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Suspense } from 'react'
import { DishPhoto } from '@/components/dishes/dish-card'
import { SaveDish } from '@/components/dishes/save-dish'
import { WhereToTry, WhereToTryFallback } from '@/components/dishes/where-to-try'
import { PriceLevel } from '@/components/venues/venue-card'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { getDish, getDishSlugs } from '@/lib/content/dishes'
import type { Locale } from '@/lib/i18n/t'
import { pageMetadata } from '@/lib/seo/metadata'

// Static per published dish × locale (ISR, tag `dishes`); a dish published later renders on first request.
export async function generateStaticParams() {
  const slugs = await getDishSlugs()
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })))
}

type Params = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params
  const dish = await getDish(slug, locale as Locale)
  if (!dish) return {}
  return pageMetadata(locale, `/dishes/${slug}`, { title: dish.name, description: dish.line || dish.story.slice(0, 160) })
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line-2 py-6">
      <h2 className="eyebrow text-ink-2">{title}</h2>
      <div className="mt-3 text-[16px] leading-[1.7]">{children}</div>
    </section>
  )
}

export default async function DishPage({ params }: Params) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const t = await getTranslations('dishes')
  const dish = await getDish(slug, locale as Locale)
  if (!dish) notFound()

  const origin = [t(`country.${dish.country}`), dish.region?.name].filter(Boolean).join(' · ')
  const home = dish.region?.slug ?? null

  return (
    <article className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-10 pb-24 md:pt-16 md:pb-36">
      <Link href="/dishes" className="inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-copper">
        ← {t('detail.back')}
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16">
        <div className="md:sticky md:top-24 md:self-start">
          <DishPhoto image={dish.image} sizes="(min-width: 768px) 45vw, 100vw" />
        </div>

        <div>
          <p className="eyebrow text-copper">{origin}</p>
          <h1 className="mt-3 text-[clamp(36px,4.5vw,60px)] leading-[1.05] font-semibold tracking-[-0.02em]">{dish.name}</h1>
          {dish.line && <p className="mt-4 text-[18px] leading-[1.6] text-ink-2">{dish.line}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            {dish.priceText && <p className="text-[15px] font-medium">{dish.priceText}</p>}
            <PriceLevel level={dish.priceLevel} />
            {dish.dietary.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {dish.dietary.map((d) => (
                  <li key={d} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">
                    {t.has(`diet.${d}`) ? t(`diet.${d}`) : d.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <SaveDish id={dish.id} />
          </div>

          {dish.story && <p className="mt-10 text-[17px] leading-[1.75]">{dish.story}</p>}

          {dish.disputeNote && (
            <aside className="mt-8 rounded-[10px] border border-copper bg-copper-tint px-6 py-5">
              <h2 className="eyebrow text-copper">{t('detail.dispute')}</h2>
              <p className="mt-2 text-[15px] leading-[1.7]">{dish.disputeNote}</p>
            </aside>
          )}

          <div className="mt-10">
            {dish.taste && <Block title={t('detail.taste')}>{dish.taste}</Block>}
            {dish.served && <Block title={t('detail.served')}>{dish.served}</Block>}
            {/* Spec §9: the allergy block always tells readers to ask the venue, even with no editorial note. */}
            <Block title={t('detail.allergy')}>
              {dish.allergy && <p>{dish.allergy}</p>}
              <p className={`text-[15px] font-medium text-copper ${dish.allergy ? 'mt-2' : ''}`}>{t('detail.allergyWarning')}</p>
            </Block>
            {dish.pairings.length > 0 && (
              <Block title={t('detail.pairings')}>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                  {dish.pairings.map((p, i) => (
                    <div key={i} className="contents">
                      <dt className="text-ink-2">{p.k}</dt>
                      <dd>{p.v}</dd>
                    </div>
                  ))}
                </dl>
              </Block>
            )}
            <section className="border-t border-line-2 py-6">
              <h2 className="eyebrow mb-4 text-ink-2">{t('detail.whereToTry')}</h2>
              <Suspense fallback={<WhereToTryFallback groups={dish.venuesByRegion} home={home} />}>
                <WhereToTry groups={dish.venuesByRegion} home={home} />
              </Suspense>
            </section>
          </div>
        </div>
      </div>
    </article>
  )
}
