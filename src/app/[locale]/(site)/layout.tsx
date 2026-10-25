import { setRequestLocale } from 'next-intl/server'
import { AuthProvider } from '@/components/auth/auth-provider'
import { LoginRequiredDialogProvider } from '@/components/auth/login-required-dialog'
import { MobileTabBar } from '@/components/site/mobile-tab-bar'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  setRequestLocale((await params).locale)
  return (
    <AuthProvider>
      <LoginRequiredDialogProvider>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <MobileTabBar />
        </div>
      </LoginRequiredDialogProvider>
    </AuthProvider>
  )
}
