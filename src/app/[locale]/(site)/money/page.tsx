import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { MoneyView } from '@/components/money/money-view'
import { routing } from '@/i18n/routing'
import { getMoneyPageData } from '@/lib/fx/page-data'
import type { Locale } from '@/lib/i18n/t'

// Static (ISR): the rate snapshot, reference prices and default trend are rendered into the HTML. The cron
// busts the `fx` tag after every ingest; the hourly revalidate is the fallback if a cron run is missed.
export const revalidate = 3600

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'money' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

const TIP_KEYS = ['card', 'cash', 'tipping', 'fees', 'atm', 'gst'] as const

export default async function MoneyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('money')
  const { snapshot, reference, history } = await getMoneyPageData(locale as Locale)

  // Editors own `content_blocks.money_tips`; until it has content for the locale the bundled six tips show.
  const tips = reference.tips.length ? reference.tips : TIP_KEYS.map((k) => ({ title: t(`tips.${k}.title`), text: t(`tips.${k}.text`) }))

  return (
    <>
      <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 md:pt-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[680px]">
            <p className="eyebrow text-copper">{t('eyebrow')}</p>
            <h1 className="mt-4 text-[clamp(36px,5vw,64px)] leading-[1.05] font-semibold tracking-[-0.02em]">{t('title')}</h1>
            <p className="mt-4 max-w-[540px] text-[17px] leading-[1.7] text-ink-2">{t('lede')}</p>
          </div>
          <p className="flex items-center gap-2 text-[13px] text-ink-2 max-md:hidden">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16v.5" />
            </svg>
            {t('disclaimer')}
          </p>
        </div>
      </section>
      <MoneyView snapshot={snapshot} reference={reference} tips={tips} history={history} />
    </>
  )
}
