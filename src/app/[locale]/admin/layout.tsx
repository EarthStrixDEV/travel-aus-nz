import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/site/logo'
import { ThemeToggle } from '@/components/site/theme-toggle'
import { requireRole } from '@/lib/auth/profile'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireRole(['editor', 'admin'])
  const t = await getTranslations('admin')

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line-2 bg-surface">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-1 px-[clamp(16px,4vw,56px)] py-2">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="eyebrow text-copper">{t('eyebrow')}</span>
          </div>
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
            <AdminNav />
          </div>
          <div className="ml-auto flex items-center gap-2.5 sm:ml-0">
            <ThemeToggle />
            {/* POST only: GET sign-out could be triggered cross-site. */}
            <form method="post" action="/auth/sign-out">
              <Button type="submit" variant="ghost">
                {t('signOut')}
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-[clamp(16px,4vw,56px)] py-10">{children}</main>
    </div>
  )
}
