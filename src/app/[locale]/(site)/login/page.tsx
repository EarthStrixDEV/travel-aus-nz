import { getTranslations, setRequestLocale } from 'next-intl/server'
import { safeNextPath } from '@/lib/auth/safe-next'
import { LoginForm } from './login-form'

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const sp = await searchParams
  const t = await getTranslations('auth')
  const safe = safeNextPath(sp.next)
  const next = safe === '/' ? `/${locale}` : safe

  return (
    <div className="px-[clamp(16px,4vw,56px)] py-12 sm:py-20">
      <div className="mx-auto w-full max-w-[420px] rounded-[10px] bg-surface p-6 shadow-soft sm:p-10">
        <p className="eyebrow text-copper">{t('eyebrow')}</p>
        <h1 className="mt-3 text-4xl font-semibold text-ink">{t('title')}</h1>
        <p className="mt-3 text-base text-ink-2">{t('lede')}</p>
        {sp.error === 'auth' && (
          <p role="alert" className="mt-6 text-[13px] font-normal text-copper">
            {t('error')}
          </p>
        )}
        <LoginForm next={next} />
      </div>
    </div>
  )
}
