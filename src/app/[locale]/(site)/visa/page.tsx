import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { VisaView } from '@/components/visa/visa-view'
import { routing } from '@/i18n/routing'
import { getEntryPageData } from '@/lib/content/entry'
import type { Locale } from '@/lib/i18n/t'

// Static (ISR): rules, permission types, documents and FAQ are rendered into the HTML. Editors and the
// link-check cron bust the `entry` tag; the hourly revalidate is the fallback.
export const revalidate = 3600

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: 'visa' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

export default async function VisaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('visa')
  // Never throws: a database error gives an empty payload and `failed`, and the page still renders.
  const { data, failed } = await getEntryPageData(locale as Locale)

  const verified = data.last_verified_at
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${data.last_verified_at}T00:00:00Z`))
    : null

  return (
    <>
      <section className="mx-auto max-w-[1440px] px-[clamp(16px,4vw,56px)] pt-16 md:pt-24 print:hidden">
        <div className="max-w-[760px]">
          <p className="eyebrow text-copper">{t('eyebrow')}</p>
          <h1 className="mt-[18px] text-[clamp(38px,5.2vw,72px)] leading-[1.04] font-semibold tracking-[-0.02em]">{t('title')}</h1>
          <p className="mt-5 max-w-[600px] text-[17px] leading-[1.7] text-ink-2">{t('lede')}</p>
          <p className="mt-4 text-[13px] text-ink-2">{verified ? t('lastVerified', { date: verified }) : t('notVerified')}</p>
        </div>
      </section>
      <VisaView data={data} failed={failed} />
    </>
  )
}
